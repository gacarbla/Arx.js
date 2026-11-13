import { describe, expect, it, vi } from "vitest";
import {
    CacheStore,
    Command,
    CommandContext,
    CommandRunner,
    I18n,
    Member,
    Permissions,
    type ContextClient,
    type InteractionAdapter,
} from "@arx.js/discord";

function createClient(cache = new CacheStore({ members: 10 })): ContextClient {
    return {
        rest: {} as any,
        cache,
        user: null,
        applicationId: "app",
        i18n: new I18n({
            messages: {
                "es-ES": { greet: "Hola {name}" },
            },
        }),
    };
}

function createInteraction(raw: any, overrides: Partial<InteractionAdapter> = {}): InteractionAdapter {
    const adapter = {
        raw,
        id: "interaction",
        type: raw.type ?? 2,
        guildId: "100000000000000001",
        channelId: "200000000000000001",
        userId: "400000000000000001",
        locale: "es-ES",
        guild: null,
        channel: null,
        member: null,
        user: null,
        reply: vi.fn(async () => null),
        defer: vi.fn(async () => undefined),
        editReply: vi.fn(async () => null),
        followUp: vi.fn(async () => null),
        update: vi.fn(async () => null),
        showModal: vi.fn(async () => undefined),
        autocomplete: vi.fn(async () => undefined),
        ...overrides,
    } as unknown as InteractionAdapter;

    return adapter;
}

const rawInteraction = {
    type: 2,
    data: {
        name: "test",
        options: [
            { type: 3, name: "text", value: "hola" },
            { type: 4, name: "count", value: 5 },
            { type: 10, name: "ratio", value: 1.5 },
            { type: 5, name: "flag", value: true },
            { type: 6, name: "user", value: "400000000000000001" },
            { type: 7, name: "channel", value: "200000000000000001" },
            { type: 8, name: "role", value: "300000000000000001" },
        ],
        resolved: {
            users: { "400000000000000001": { id: "400000000000000001", username: "gabriel" } },
            members: { "400000000000000001": { roles: [], joined_at: "2026-01-01T00:00:00.000Z" } },
            channels: {
                "200000000000000001": {
                    id: "200000000000000001",
                    type: 0,
                    guild_id: "100000000000000001",
                    name: "general",
                },
            },
            roles: {
                "300000000000000001": {
                    id: "300000000000000001",
                    name: "Admin",
                    color: 0,
                    position: 0,
                    permissions: "8",
                    managed: false,
                    mentionable: false,
                    hoist: false,
                },
            },
        },
    },
};

describe("CommandContext", () => {
    it("parses and resolves typed options", () => {
        const client = createClient();
        const interaction = createInteraction(rawInteraction);
        const command = new Command({ name: "test", description: "Test" });
        const ctx = new CommandContext(client, interaction, {
            values: Object.fromEntries(
                rawInteraction.data.options.map((option) => [option.name, option.value])
            ),
            resolved: rawInteraction.data.resolved as any,
        }, { command });

        expect(ctx.options.getString("text")).toBe("hola");
        expect(ctx.getInteger("count")).toBe(5);
        expect(ctx.getNumber("ratio")).toBe(1.5);
        expect(ctx.getBoolean("flag")).toBe(true);
        expect(ctx.getUser("user")?.username).toBe("gabriel");
        expect(ctx.getMember("user")?.id).toBe("400000000000000001");
        expect(ctx.getChannel("channel")?.name).toBe("general");
        expect(ctx.getRole("role")?.name).toBe("Admin");
        expect(ctx.getRaw("missing")).toBeUndefined();
        expect(ctx.getString("missing")).toBeNull();
        expect(() => ctx.getString("missing", true)).toThrow(/missing required option/i);
    });

    it("translates messages with the interaction locale", () => {
        const client = createClient();
        const ctx = new CommandContext(
            client,
            createInteraction(rawInteraction),
            { values: {}, resolved: {} },
            { command: new Command({ name: "test", description: "Test" }) }
        );

        expect(ctx.t("greet", { name: "Gabriel" })).toBe("Hola Gabriel");
        expect(ctx.t("unknown")).toBe("unknown");
    });

    it("computes member permissions from cached roles", () => {
        const cache = new CacheStore({ members: 10 });
        cache.guilds.set("100000000000000001", {
            id: "100000000000000001",
            name: "Guild",
            owner_id: "1",
        } as any);
        cache.roles.set("100000000000000001:300000000000000001", {
            id: "300000000000000001",
            name: "Admin",
            color: 0,
            position: 0,
            permissions: String(Permissions.Administrator),
            managed: false,
            mentionable: false,
            hoist: false,
        } as any);

        const client = createClient(cache);
        const member = new Member(client, "100000000000000001", {
            user: { id: "400000000000000001", username: "gabriel" },
            roles: ["300000000000000001"],
            joined_at: "2026-01-01T00:00:00.000Z",
        } as any);
        const interaction = createInteraction(rawInteraction, { member });
        const ctx = new CommandContext(
            client,
            interaction,
            {
                values: {},
                resolved: {
                    members: { "400000000000000001": { roles: ["300000000000000001"], joined_at: "2026-01-01T00:00:00.000Z" } },
                    users: { "400000000000000001": { id: "400000000000000001", username: "gabriel" } },
                } as any,
            },
            { command: new Command({ name: "test", description: "Test" }) }
        );

        expect(ctx.hasPermission(Permissions.ManageGuild)).toBe(true);
    });

    it("runs middlewares in order and auto-defers", async () => {
        const client = createClient();
        const order: string[] = [];
        const interaction = createInteraction(rawInteraction);

        const command = new Command({ name: "test", description: "Test" })
            .addMiddleware(async (_ctx, next) => {
                order.push("command");
                await next();
            })
            .setDefer("ephemeral")
            .setExecution(async (ctx) => {
                order.push("handler");
                expect(ctx.isDeferred).toBe(true);
            });

        await CommandRunner.execute(command, interaction, client);

        expect(order).toEqual(["command", "handler"]);
        expect(interaction.defer).toHaveBeenCalledWith({ ephemeral: true });
    });

    it("replies with a generic error when the handler throws", async () => {
        const client = createClient();
        const interaction = createInteraction(rawInteraction);
        const command = new Command({ name: "test", description: "Test" }).setExecution(async () => {
            throw new Error("boom");
        });

        await expect(CommandRunner.execute(command, interaction, client)).rejects.toThrow("boom");
        expect(interaction.reply).toHaveBeenCalledWith({
            content: expect.stringMatching(/error/i),
            ephemeral: true,
        });
    });
});
