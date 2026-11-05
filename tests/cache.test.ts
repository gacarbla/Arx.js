import { describe, expect, it } from "vitest";
import {
    applyDispatch,
    CacheStore,
    LruTtlMap,
    memberKey,
    messageKey,
    roleKey,
} from "@arx.js/discord";

describe("LruTtlMap", () => {
    it("evicts the least recently used entry", () => {
        const map = new LruTtlMap<string, number>({ max: 2 });

        map.set("a", 1);
        map.set("b", 2);
        expect(map.get("a")).toBe(1); // refresh a
        map.set("c", 3);

        expect(map.has("b")).toBe(false);
        expect(map.get("a")).toBe(1);
        expect(map.get("c")).toBe(3);
        expect(map.size).toBe(2);
    });

    it("expires entries using the injected clock", () => {
        const clock = { now: 0 };
        const map = new LruTtlMap<string, string>({ max: 10, ttl: 1000 }, () => clock.now);

        map.set("a", "value");
        clock.now = 500;
        expect(map.get("a")).toBe("value");

        clock.now = 1500;
        expect(map.get("a")).toBeUndefined();
        expect(map.size).toBe(0);
    });

    it("is disabled with max: 0", () => {
        const map = new LruTtlMap<string, number>({ max: 0 });
        map.set("a", 1);

        expect(map.get("a")).toBeUndefined();
        expect(map.size).toBe(0);
    });
});

describe("CacheStore", () => {
    it("disables members, messages and presences by default", () => {
        const cache = new CacheStore();

        cache.members.set("g:u", { user: { id: "u" } } as any);
        cache.messages.set("c:m", { id: "m" } as any);
        cache.presences.set("g:u", {} as any);

        expect(cache.members.size).toBe(0);
        expect(cache.messages.size).toBe(0);
        expect(cache.presences.size).toBe(0);
        expect(cache.guilds.enabled).toBe(true);
    });

    it("applies GUILD_CREATE to channels, roles and members", () => {
        const cache = new CacheStore({ members: 10 });
        const guildId = "100000000000000001";
        const channelId = "200000000000000001";
        const roleId = "300000000000000001";
        const userId = "400000000000000001";

        applyDispatch(cache, "GUILD_CREATE", {
            id: guildId,
            name: "Guild",
            channels: [{ id: channelId, type: 0, guild_id: guildId, name: "general" }],
            roles: [{ id: roleId, name: "Admin" }],
            members: [{ user: { id: userId, username: "gabriel" }, roles: [roleId] }],
        });

        expect(cache.guilds.get(guildId)?.name).toBe("Guild");
        expect(cache.channels.get(channelId)?.name).toBe("general");
        expect(cache.roles.get(roleKey(guildId, roleId))?.name).toBe("Admin");
        expect(cache.members.get(memberKey(guildId, userId))?.user.username).toBe("gabriel");
        expect(cache.users.get(userId)?.username).toBe("gabriel");
    });

    it("applies message and member updates", () => {
        const cache = new CacheStore({ messages: 10, members: 10 });
        const guildId = "100000000000000001";
        const channelId = "200000000000000001";
        const userId = "400000000000000001";
        const messageId = "500000000000000001";

        applyDispatch(cache, "MESSAGE_CREATE", {
            id: messageId,
            channel_id: channelId,
            guild_id: guildId,
            content: "hola",
            author: { id: userId, username: "gabriel" },
        });

        expect(cache.messages.get(messageKey(channelId, messageId))?.content).toBe("hola");
        expect(cache.users.get(userId)?.username).toBe("gabriel");

        applyDispatch(cache, "MESSAGE_DELETE", { id: messageId, channel_id: channelId });
        expect(cache.messages.get(messageKey(channelId, messageId))).toBeUndefined();

        applyDispatch(cache, "MESSAGE_CREATE", {
            id: messageId,
            channel_id: channelId,
            content: "original",
            author: { id: userId, username: "gabriel" },
        });
        applyDispatch(cache, "MESSAGE_UPDATE", {
            id: messageId,
            channel_id: channelId,
            content: "editado",
        });
        expect(cache.messages.get(messageKey(channelId, messageId))).toMatchObject({
            content: "editado",
            author: { id: userId },
        });

        applyDispatch(cache, "GUILD_MEMBER_ADD", {
            guild_id: guildId,
            user: { id: userId, username: "gabriel" },
            roles: [],
        });
        expect(cache.members.get(memberKey(guildId, userId))).toBeDefined();
    });

    it("sweeps every collection", () => {
        const clock = { now: 0 };
        const cache = new CacheStore({ guilds: { max: 10, ttl: 100 }, now: () => clock.now });
        cache.guilds.set("g", { id: "g" } as any);

        clock.now = 200;
        cache.sweep();

        expect(cache.guilds.get("g")).toBeUndefined();
    });
});
