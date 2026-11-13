import { describe, expect, it, vi } from "vitest";
import { Client as DiscordJsClient } from "discord.js";
import {
    CacheStore,
    CommandRegistry,
    I18n,
    InteractionRouter,
    Message,
    type ContextClient,
} from "@arx.js/discord";
import {
    Client,
    DiscordJsInteractionAdapter,
    DiscordJsRestAdapter,
} from "@arx.js/discord.js";
import { toRawMessage } from "../packages/discord.js/src/raw";

const messageRaw = {
    id: "500000000000000001",
    channel_id: "200000000000000001",
    guild_id: "100000000000000001",
    content: "respuesta",
    timestamp: "2026-01-01T00:00:00.000Z",
    author: { id: "400000000000000001", username: "bot" },
};

const interactionRaw = {
    id: "900000000000000001",
    application_id: "app",
    type: 2,
    token: "interaction-token",
    guild_id: "100000000000000001",
    channel_id: "200000000000000001",
    locale: "es-ES",
    member: {
        user: { id: "400000000000000001", username: "user" },
        roles: [],
        joined_at: "2026-01-01T00:00:00.000Z",
    },
    data: { name: "ping" },
};

function contextClient(): ContextClient {
    return {
        rest: {} as any,
        cache: new CacheStore({ messages: 10 }),
        user: null,
        applicationId: "app",
        i18n: new I18n(),
    };
}

function nativeInteraction() {
    return {
        id: interactionRaw.id,
        applicationId: interactionRaw.application_id,
        type: interactionRaw.type,
        token: interactionRaw.token,
        guildId: interactionRaw.guild_id,
        channelId: interactionRaw.channel_id,
        locale: interactionRaw.locale,
        version: 1,
        member: {
            user: interactionRaw.member.user,
            roles: [],
            joinedAt: new Date(interactionRaw.member.joined_at),
        },
        user: interactionRaw.member.user,
        isChatInputCommand: () => true,
        commandId: "command-id",
        commandName: "ping",
        commandType: 1,
        options: { data: [], resolved: {} },
        toJSON: () => interactionRaw,
        reply: vi.fn(async () => ({ toJSON: () => messageRaw })),
        deferReply: vi.fn(async () => undefined),
        editReply: vi.fn(async () => ({ toJSON: () => messageRaw })),
        followUp: vi.fn(async () => ({ toJSON: () => messageRaw })),
        update: vi.fn(async () => ({ toJSON: () => messageRaw })),
        showModal: vi.fn(async () => undefined),
        respond: vi.fn(async () => undefined),
    };
}

describe("DiscordJsRestAdapter", () => {
    it("delegates methods and maps reason/files", async () => {
        const rest = {
            get: vi.fn(async () => ({ ok: 1 })),
            post: vi.fn(async () => ({ id: "1" })),
            put: vi.fn(async () => undefined),
            patch: vi.fn(async () => ({ id: "1" })),
            delete: vi.fn(async () => undefined),
        };
        const adapter = new DiscordJsRestAdapter(rest as any);

        await expect(adapter.get("/gateway/bot")).resolves.toEqual({ ok: 1 });
        await adapter.post(
            "/channels/1/messages",
            { content: "hola" },
            {
                reason: "prueba",
                files: [{ data: Buffer.from("abc"), filename: "a.txt", contentType: "text/plain" }],
            }
        );

        expect(rest.post).toHaveBeenCalledWith(
            "/channels/1/messages",
            expect.objectContaining({
                body: { content: "hola" },
                reason: "prueba",
                files: [expect.objectContaining({ name: "a.txt", contentType: "text/plain" })],
            })
        );
    });

    it("synthesizes a response for requestWithResponse", async () => {
        const rest = { get: vi.fn(async () => ({ ok: 1 })) };
        const adapter = new DiscordJsRestAdapter(rest as any);

        const result = await adapter.requestWithResponse<{ ok: number }>("/x");
        expect(result.data).toEqual({ ok: 1 });
        await expect(result.response.json()).resolves.toEqual({ ok: 1 });
    });
});

describe("DiscordJsInteractionAdapter", () => {
    it("exposes context from the raw interaction", () => {
        const client = contextClient();
        const adapter = new DiscordJsInteractionAdapter(client, nativeInteraction() as any);

        expect(adapter.id).toBe(interactionRaw.id);
        expect(adapter.guildId).toBe(interactionRaw.guild_id);
        expect(adapter.channelId).toBe(interactionRaw.channel_id);
        expect(adapter.userId).toBe("400000000000000001");
        expect(adapter.locale).toBe("es-ES");
        expect(adapter.user?.id).toBe("400000000000000001");
    });

    it("delegates replies, defers and webhook responses", async () => {
        const client = contextClient();
        const native = nativeInteraction();
        const adapter = new DiscordJsInteractionAdapter(client, native as any);

        const message = await adapter.reply("hola");
        await adapter.defer({ ephemeral: true });
        const edited = await adapter.editReply("editado");
        const followUp = await adapter.followUp("seguimiento");

        expect(message).toBeInstanceOf(Message);
        expect(message?.content).toBe("respuesta");
        expect(edited.content).toBe("respuesta");
        expect(followUp.content).toBe("respuesta");

        expect(native.reply).toHaveBeenCalledWith({ content: "hola" });
        expect(native.deferReply).toHaveBeenCalledWith({ flags: 64 });
        expect(native.editReply).toHaveBeenCalledWith({ content: "editado" });
        expect(native.followUp).toHaveBeenCalledWith({ content: "seguimiento" });
    });

    it("delegates updates, modals and autocomplete", async () => {
        const client = contextClient();
        const native = nativeInteraction();
        const adapter = new DiscordJsInteractionAdapter(client, native as any);

        await adapter.update({ content: "update" });
        await adapter.showModal({ custom_id: "m", title: "T", components: [] });
        await adapter.autocomplete([{ name: "A", value: "1" }]);

        expect(native.update).toHaveBeenCalledWith({ content: "update" });
        expect(native.showModal).toHaveBeenCalledWith({
            custom_id: "m",
            title: "T",
            components: [],
        });
        expect(native.respond).toHaveBeenCalledWith([{ name: "A", value: "1" }]);
    });
});

describe("discord.js Client", () => {
    it("exposes the same ARX API without connecting", () => {
        const client = new Client({ token: "test-token" });

        try {
            expect(client.native).toBeInstanceOf(DiscordJsClient);
            expect(client.commands).toBeInstanceOf(CommandRegistry);
            expect(client.router).toBeInstanceOf(InteractionRouter);
            expect(client.cache).toBeInstanceOf(CacheStore);
            expect(client.i18n).toBeInstanceOf(I18n);
            expect(client.user).toBeNull();
            expect(client.ready).toBe(false);
        } finally {
            client.destroy();
        }
    });
});

describe("raw discord.js message mapping", () => {
    it("keeps attachments, embeds and references", () => {
        const raw = toRawMessage({
            id: "m1",
            channelId: "c1",
            guildId: "g1",
            content: "hola",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
            author: { id: "u1", username: "user" },
            attachments: new Map([
                [
                    "a1",
                    {
                        id: "a1",
                        name: "file.txt",
                        size: 3,
                        url: "https://example.com/file.txt",
                        proxyURL: "https://example.com/proxy",
                        contentType: "text/plain",
                    },
                ],
            ]),
            embeds: [{ toJSON: () => ({ title: "T" }) }],
            components: [],
            mentions: { users: new Map(), roles: new Map(), everyone: false },
            reference: { messageId: "m0", channelId: "c1", guildId: "g1" },
        });

        expect(raw?.attachments?.[0]).toMatchObject({
            filename: "file.txt",
            proxy_url: "https://example.com/proxy",
        });
        expect(raw?.embeds?.[0]).toEqual({ title: "T" });
        expect(raw?.message_reference).toMatchObject({ message_id: "m0" });
    });
});
