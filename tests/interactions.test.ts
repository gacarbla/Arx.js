import { describe, expect, it, vi } from "vitest";
import {
    CacheStore,
    Guild,
    Message,
    NativeInteractionAdapter,
    type RestClient,
    type StructureClient,
} from "@arx.js/discord";

const messageRaw = {
    id: "500000000000000001",
    channel_id: "200000000000000001",
    guild_id: "100000000000000001",
    content: "respuesta",
    timestamp: "2026-01-01T00:00:00.000Z",
    author: { id: "400000000000000001", username: "bot" },
};

function createClient() {
    const cache = new CacheStore({
        guilds: 10,
        channels: 10,
        messages: 10,
    });

    const rest = {
        requestWithResponse: vi.fn(async () => ({
            data: { resource: { message: messageRaw } },
            response: new Response(null, { status: 200 }),
        })),
        post: vi.fn(async () => messageRaw),
        patch: vi.fn(async () => messageRaw),
        put: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
        get: vi.fn(async () => undefined),
    } as unknown as RestClient;

    const client: StructureClient = { rest, cache, user: null, applicationId: "app" };
    return { client, cache, rest };
}

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
} as any;

describe("NativeInteractionAdapter", () => {
    it("exposes interaction context from the cache", () => {
        const { client, cache } = createClient();
        cache.guilds.set("100000000000000001", { id: "100000000000000001", name: "Guild" } as any);
        cache.channels.set("200000000000000001", {
            id: "200000000000000001",
            type: 0,
            guild_id: "100000000000000001",
            name: "general",
        } as any);

        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        expect(interaction.id).toBe("900000000000000001");
        expect(interaction.guildId).toBe("100000000000000001");
        expect(interaction.channelId).toBe("200000000000000001");
        expect(interaction.userId).toBe("400000000000000001");
        expect(interaction.locale).toBe("es-ES");
        expect(interaction.guild).toBeInstanceOf(Guild);
        expect(interaction.channel?.name).toBe("general");
        expect(interaction.user?.id).toBe("400000000000000001");
        expect(interaction.member?.displayName).toBe("user");
    });

    it("replies with a message and supports ephemeral replies", async () => {
        const { client, rest } = createClient();
        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        const message = await interaction.reply("hola");
        await interaction.reply({ content: "privado", ephemeral: true });

        expect(message).toBeInstanceOf(Message);
        expect(message?.content).toBe("respuesta");

        expect(rest.requestWithResponse).toHaveBeenNthCalledWith(
            1,
            "/interactions/900000000000000001/interaction-token/callback?with_response=true",
            {
                method: "POST",
                auth: false,
                body: { type: 4, data: { content: "hola" } },
            }
        );
        expect((rest.requestWithResponse as any).mock.calls[1][1].body).toEqual({
            type: 4,
            data: { content: "privado", flags: 64 },
        });
    });

    it("defers ephemeral and public responses", async () => {
        const { client, rest } = createClient();
        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        await interaction.defer();
        await interaction.defer({ ephemeral: true });

        expect(rest.post).toHaveBeenNthCalledWith(
            1,
            "/interactions/900000000000000001/interaction-token/callback",
            { type: 5, data: {} },
            { auth: false }
        );
        expect((rest.post as any).mock.calls[1][1]).toEqual({
            type: 5,
            data: { flags: 64 },
        });
    });

    it("edits the original reply and follows up", async () => {
        const { client, rest } = createClient();
        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        const edited = await interaction.editReply("editado");
        const followUp = await interaction.followUp("seguimiento");

        expect(edited.content).toBe("respuesta");
        expect(followUp.content).toBe("respuesta");

        expect(rest.patch).toHaveBeenCalledWith(
            "/webhooks/app/interaction-token/messages/@original",
            { content: "editado" }
        );
        expect(rest.post).toHaveBeenCalledWith(
            "/webhooks/app/interaction-token",
            { content: "seguimiento" }
        );
    });

    it("updates a component message", async () => {
        const { client, rest } = createClient();
        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        const message = await interaction.update({ content: "actualizado" });

        expect(message).toBeInstanceOf(Message);
        expect((rest.requestWithResponse as any).mock.calls[0][1].body).toEqual({
            type: 7,
            data: { content: "actualizado" },
        });
    });

    it("shows modals and answers autocomplete", async () => {
        const { client, rest } = createClient();
        const interaction = new NativeInteractionAdapter(client, interactionRaw);

        await interaction.showModal({
            custom_id: "modal",
            title: "Título",
            components: [],
        });
        await interaction.autocomplete([{ name: "Uno", value: "1" }]);

        expect((rest.post as any).mock.calls[0][1]).toEqual({
            type: 9,
            data: { custom_id: "modal", title: "Título", components: [] },
        });
        expect((rest.post as any).mock.calls[1][1]).toEqual({
            type: 8,
            data: { choices: [{ name: "Uno", value: "1" }] },
        });
    });
});
