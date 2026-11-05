import { describe, expect, it } from "vitest";
import {
    CacheStore,
    Channel,
    Guild,
    Member,
    Message,
    Role,
    RestClient,
    User,
    type StructureClient,
} from "@arx.js/discord";

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

interface Call {
    url: string;
    init: RequestInit;
    method: string;
    body: any;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function noContent(): Response {
    return new Response(null, { status: 204 });
}

function createClient(handler: FetchHandler) {
    const calls: Call[] = [];
    const cache = new CacheStore({
        guilds: 10,
        channels: 10,
        roles: 10,
        members: 10,
        messages: 10,
        users: 10,
    });

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({
            url,
            init: init ?? {},
            method: (init?.method ?? "GET").toUpperCase(),
            body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
        });
        return handler(url, init ?? {});
    };

    const rest = new RestClient("token", {
        fetch: fetchMock as unknown as typeof fetch,
        sleep: async () => undefined,
        now: () => 0,
        random: () => 0,
    });

    const client: StructureClient = { rest, cache, user: null, applicationId: "app" };
    return { client, cache, calls };
}

const channelRaw = {
    id: "200000000000000001",
    type: 0,
    guild_id: "100000000000000001",
    name: "general",
};

const messageRaw = {
    id: "500000000000000001",
    channel_id: "200000000000000001",
    guild_id: "100000000000000001",
    content: "hola",
    timestamp: "2026-01-01T00:00:00.000Z",
    edited_timestamp: null,
    pinned: false,
    tts: false,
    author: { id: "400000000000000001", username: "gabriel" },
};

describe("structures", () => {
    it("sends messages through a channel and caches them", async () => {
        const { client, cache, calls } = createClient(() => json(messageRaw));
        const channel = new Channel(client, channelRaw as any);

        const message = await channel.send("hola");

        expect(calls[0]!.method).toBe("POST");
        expect(calls[0]!.url).toContain("/channels/200000000000000001/messages");
        expect(calls[0]!.body).toEqual({ content: "hola" });
        expect(message.content).toBe("hola");
        expect(cache.messages.get("200000000000000001:500000000000000001")).toBeDefined();
    });

    it("replies to a message using message_reference", async () => {
        const { client, cache, calls } = createClient(() => json(messageRaw));
        cache.channels.set(channelRaw.id, channelRaw as any);

        const message = new Message(client, messageRaw as any);
        await message.reply("respuesta");

        expect(calls[0]!.body).toMatchObject({
            content: "respuesta",
            message_reference: { message_id: messageRaw.id },
        });
    });

    it("edits, deletes and reacts to messages", async () => {
        const { client, calls } = createClient((url, init) => {
            if ((init.method ?? "GET") === "PATCH") {
                return json({ ...messageRaw, content: "editado" });
            }
            return noContent();
        });

        const message = new Message(client, messageRaw as any);
        const edited = await message.edit("editado");
        await message.delete("limpieza");
        await message.react("👍");

        expect(edited.content).toBe("editado");
        expect(calls[0]!.url).toContain(`/channels/${messageRaw.channel_id}/messages/${messageRaw.id}`);
        expect(calls[1]!.method).toBe("DELETE");
        expect(new Headers(calls[1]!.init.headers).get("x-audit-log-reason")).toBe(
            encodeURIComponent("limpieza")
        );
        expect(calls[2]!.method).toBe("PUT");
        expect(calls[2]!.url).toContain("/reactions/");
    });

    it("fetches guild members and caches them", async () => {
        const { client, cache, calls } = createClient(() =>
            json({
                user: { id: "400000000000000001", username: "gabriel", global_name: "Gabriel" },
                nick: "Gabi",
                roles: ["300000000000000001"],
                joined_at: "2026-01-01T00:00:00.000Z",
            })
        );

        const guild = new Guild(client, { id: "100000000000000001", name: "Guild", owner_id: "1" } as any);
        const member = await guild.members.fetch("400000000000000001");

        expect(calls[0]!.url).toContain("/guilds/100000000000000001/members/400000000000000001");
        expect(member.displayName).toBe("Gabi");
        expect(member.user.globalName).toBe("Gabriel");
        expect(cache.members.get("100000000000000001:400000000000000001")).toBeDefined();
    });

    it("performs member moderation actions with audit log reasons", async () => {
        const { client, calls } = createClient(() => noContent());
        const member = new Member(client, "100000000000000001", {
            user: { id: "400000000000000001", username: "gabriel" },
            roles: [],
            joined_at: "2026-01-01T00:00:00.000Z",
        } as any);

        await member.kick("spam");
        await member.ban({ reason: "spam", deleteMessageSeconds: 60 });
        await member.addRole("300000000000000001", "promote");

        expect(calls[0]).toMatchObject({
            method: "DELETE",
            url: expect.stringContaining("/guilds/100000000000000001/members/400000000000000001"),
        });
        expect(calls[1]).toMatchObject({
            method: "PUT",
            url: expect.stringContaining("/guilds/100000000000000001/bans/400000000000000001"),
            body: { delete_message_seconds: 60 },
        });
        expect(calls[2]).toMatchObject({
            method: "PUT",
            url: expect.stringContaining(
                "/guilds/100000000000000001/members/400000000000000001/roles/300000000000000001"
            ),
        });
    });

    it("creates a DM before sending a user message", async () => {
        const { client, calls } = createClient((url) => {
            if (url.endsWith("/users/@me/channels")) {
                return json({ id: "600000000000000001", type: 1, recipients: [] });
            }
            return json({ ...messageRaw, channel_id: "600000000000000001" });
        });

        const user = new User(client, { id: "400000000000000001", username: "gabriel" } as any);
        const message = await user.send("hola por DM");

        expect(calls).toHaveLength(2);
        expect(calls[0]!.url).toContain("/users/@me/channels");
        expect(calls[0]!.body).toEqual({ recipient_id: "400000000000000001" });
        expect(calls[1]!.url).toContain("/channels/600000000000000001/messages");
        expect(message.content).toBe("hola");
    });

    it("edits roles", async () => {
        const { client, calls } = createClient(() =>
            json({ id: "300000000000000001", name: "Mods", color: 0xff0000, position: 1 })
        );
        const role = new Role(client, "100000000000000001", {
            id: "300000000000000001",
            name: "Mods",
            color: 0xff0000,
            hoist: false,
            position: 1,
            permissions: "0",
            managed: false,
            mentionable: false,
        } as any);

        const edited = await role.edit({ name: "Mods" }, "rename");

        expect(calls[0]!.method).toBe("PATCH");
        expect(calls[0]!.url).toContain("/guilds/100000000000000001/roles/300000000000000001");
        expect(edited.name).toBe("Mods");
    });

    it("computes CDN URLs", () => {
        const { client } = createClient(() => noContent());
        const user = new User(client, {
            id: "400000000000000001",
            username: "gabriel",
            discriminator: "0",
            avatar: "abc",
        } as any);
        const guild = new Guild(client, {
            id: "100000000000000001",
            name: "Guild",
            icon: "def",
        } as any);

        expect(user.avatarURL({ size: 128 })).toContain("/avatars/400000000000000001/abc.png?size=128");
        expect(guild.iconURL({ format: "webp" })).toContain("/icons/100000000000000001/def.webp");
    });
});
