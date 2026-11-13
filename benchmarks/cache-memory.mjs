import { CacheStore, applyDispatch } from "../packages/discord/dist/index.js";

const GUILD_COUNTS = [1, 100];
const MESSAGES_PER_GUILD = 50;
const MEMBERS_PER_GUILD = 25;
const CHANNELS_PER_GUILD = 10;
const ROLES_PER_GUILD = 5;

function measure(cache, apply) {
    global.gc?.();
    const before = process.memoryUsage().heapUsed;

    apply(cache);

    global.gc?.();
    const after = process.memoryUsage().heapUsed;

    return {
        heapMB: (after - before) / 1024 / 1024,
        entries: cache.size,
        guilds: cache.guilds.size,
        members: cache.members.size,
        messages: cache.messages.size,
    };
}

function guildPayload(index) {
    const guildId = String(100000000000000000n + BigInt(index));
    const roles = Array.from({ length: ROLES_PER_GUILD }, (_, role) => ({
        id: String(200000000000000000n + BigInt(index * 100 + role)),
        name: `Role ${role}`,
        color: 0,
        hoist: false,
        position: role,
        permissions: "0",
        managed: false,
        mentionable: false,
    }));
    const channels = Array.from({ length: CHANNELS_PER_GUILD }, (_, channel) => ({
        id: String(300000000000000000n + BigInt(index * 100 + channel)),
        type: 0,
        guild_id: guildId,
        name: `channel-${channel}`,
    }));
    const members = Array.from({ length: MEMBERS_PER_GUILD }, (_, member) => ({
        user: {
            id: String(400000000000000000n + BigInt(index * 1000 + member)),
            username: `user-${member}`,
        },
        roles: [],
        joined_at: "2026-01-01T00:00:00.000Z",
    }));

    return { id: guildId, name: `Guild ${index}`, roles, channels, members };
}

function fill(cache, guildCount) {
    for (let guildIndex = 0; guildIndex < guildCount; guildIndex += 1) {
        const guild = guildPayload(guildIndex);
        applyDispatch(cache, "GUILD_CREATE", guild);

        for (let messageIndex = 0; messageIndex < MESSAGES_PER_GUILD; messageIndex += 1) {
            applyDispatch(cache, "MESSAGE_CREATE", {
                id: String(500000000000000000n + BigInt(guildIndex * 1000 + messageIndex)),
                channel_id: guild.channels[0].id,
                guild_id: guild.id,
                content: `Message ${messageIndex}`,
                author: guild.members[0].user,
                timestamp: "2026-01-01T00:00:00.000Z",
            });
        }
    }
}

const scenarios = [
    {
        name: "cache off (defaults)",
        create: () => new CacheStore(),
    },
    {
        name: "messages on",
        create: () => new CacheStore({ messages: 100_000 }),
    },
    {
        name: "members on",
        create: () => new CacheStore({ members: 100_000 }),
    },
    {
        name: "messages + members",
        create: () => new CacheStore({ messages: 100_000, members: 100_000 }),
    },
];

console.log(
    `Cache benchmark · ${MESSAGES_PER_GUILD} messages/guild · ` +
        `${MEMBERS_PER_GUILD} members/guild · ${CHANNELS_PER_GUILD} channels/guild\n`
);
console.log(
    "scenario".padEnd(28),
    "guilds".padStart(7),
    "heap MB".padStart(9),
    "entries".padStart(10),
    "guilds".padStart(7),
    "members".padStart(8),
    "messages".padStart(9)
);

for (const scenario of scenarios) {
    for (const guildCount of GUILD_COUNTS) {
        const cache = scenario.create();
        const result = measure(cache, (target) => fill(target, guildCount));

        console.log(
            scenario.name.padEnd(28),
            String(guildCount).padStart(7),
            result.heapMB.toFixed(2).padStart(9),
            String(result.entries).padStart(10),
            String(result.guilds).padStart(7),
            String(result.members).padStart(8),
            String(result.messages).padStart(9)
        );

        cache.stopSweeper();
    }
}
