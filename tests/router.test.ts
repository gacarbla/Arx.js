import { describe, expect, it, vi } from "vitest";
import {
    CacheStore,
    ComponentContext,
    I18n,
    InteractionRouter,
    decodeCustomId,
    encodeCustomId,
    type ContextClient,
    type InteractionAdapter,
} from "@arx.js/discord";

function createClient(): ContextClient {
    return {
        rest: {} as any,
        cache: new CacheStore(),
        user: null,
        applicationId: "app",
        i18n: new I18n(),
    };
}

function createInteraction(raw: any, overrides: Partial<InteractionAdapter> = {}): InteractionAdapter {
    return {
        raw,
        id: "interaction",
        type: raw.type,
        guildId: "g",
        channelId: "c",
        userId: "u",
        locale: "en-US",
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
}

describe("custom id codec", () => {
    it("round-trips namespace, action and payload", () => {
        const id = encodeCustomId("confirm", "delete", { id: "123", force: true });
        const decoded = decodeCustomId(id);

        expect(id.startsWith("arx:confirm:delete:")).toBe(true);
        expect(decoded).toMatchObject({
            namespace: "confirm",
            action: "delete",
            payload: { id: "123", force: true },
            encoded: true,
        });
    });

    it("round-trips a payload without an action", () => {
        const id = encodeCustomId("modal", undefined, { id: "1" });
        const decoded = decodeCustomId(id);

        expect(decoded).toMatchObject({
            namespace: "modal",
            action: undefined,
            payload: { id: "1" },
            encoded: true,
        });
    });

    it("leaves raw ids untouched", () => {
        const decoded = decodeCustomId("confirm:delete");
        expect(decoded).toMatchObject({
            namespace: "confirm:delete",
            encoded: false,
            raw: "confirm:delete",
        });
    });

    it("rejects invalid namespaces and oversized ids", () => {
        expect(() => encodeCustomId("bad name")).toThrow(/invalid custom id namespace/i);
        expect(() => encodeCustomId("x", "y", "z".repeat(100))).toThrow(/at most 100/i);
    });
});

describe("InteractionRouter", () => {
    it("routes buttons by encoded key and exposes the payload", async () => {
        const client = createClient();
        const router = new InteractionRouter();
        const id = encodeCustomId("confirm", "delete", { id: "123" });

        let seen: ComponentContext | undefined;
        router.button("confirm:delete", async (ctx) => {
            seen = ctx;
            await ctx.reply("ok");
        });

        const interaction = createInteraction({
            type: 3,
            data: { custom_id: id, component_type: 2 },
        });

        await expect(router.route(interaction, client)).resolves.toBe(true);
        expect(seen).toBeInstanceOf(ComponentContext);
        expect(seen?.payload).toEqual({ id: "123" });
        expect(interaction.reply).toHaveBeenCalledWith("ok");
    });

    it("routes select values", async () => {
        const client = createClient();
        const router = new InteractionRouter();
        let values: readonly string[] = [];

        router.select("roles", (ctx) => {
            values = ctx.values;
        });

        const interaction = createInteraction({
            type: 3,
            data: { custom_id: "roles", component_type: 3, values: ["a", "b"] },
        });

        await expect(router.route(interaction, client)).resolves.toBe(true);
        expect(values).toEqual(["a", "b"]);
    });

    it("flattens modal fields including Label wrappers", async () => {
        const client = createClient();
        const router = new InteractionRouter();
        let fields: Record<string, unknown> = {};

        router.modal("feedback", (ctx) => {
            fields = ctx.fields;
        });

        const interaction = createInteraction({
            type: 5,
            data: {
                custom_id: "feedback",
                components: [
                    { type: 18, label: "Nombre", component: { type: 4, custom_id: "name", value: "Gabriel" } },
                    { type: 1, components: [{ type: 4, custom_id: "age", value: "30" }] },
                ],
            },
        });

        await expect(router.route(interaction, client)).resolves.toBe(true);
        expect(fields).toEqual({ name: "Gabriel", age: "30" });
    });

    it("returns false for unhandled interactions", async () => {
        const client = createClient();
        const router = new InteractionRouter();
        const interaction = createInteraction({
            type: 3,
            data: { custom_id: "missing", component_type: 2 },
        });

        await expect(router.route(interaction, client)).resolves.toBe(false);
    });
});
