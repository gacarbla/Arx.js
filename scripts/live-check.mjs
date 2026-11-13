/**
 * Read-only live check against Discord.
 *
 * Usage:
 *   DISCORD_TOKEN=... node scripts/live-check.mjs
 *
 * Requires a previous `npm run build`.
 */
import { Bot, RestClient } from "../packages/discord/dist/index.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
    console.error("Falta DISCORD_TOKEN.");
    process.exit(1);
}

const rest = new RestClient(token, { userAgent: "arx.js-live-check/1.0" });

const me = await rest.get("/users/@me");
const application = await rest.get("/oauth2/applications/@me");
const guilds = await rest.get("/users/@me/guilds");
const gateway = await rest.get("/gateway/bot");

console.log(
    "REST",
    JSON.stringify({
        bot: me.username,
        id: me.id,
        application: application.name,
        guilds: guilds.map((guild) => ({ id: guild.id, name: guild.name })),
        shards: gateway.shards,
        maxConcurrency: gateway.session_start_limit?.max_concurrency,
    })
);

const bot = new Bot({
    token,
    intents: ["Guilds", "GuildMessages"],
    cache: { guilds: 10, channels: 100, roles: 100, users: 100, members: 0, messages: 0 },
    logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: (message) => console.warn(message),
        error: (message, ...args) => console.error(message, ...args),
    },
});

const timeout = setTimeout(() => {
    console.error("Gateway timeout.");
    bot.destroy();
    process.exit(2);
}, 30_000);

bot.once("ready", async (event) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));

    console.log(
        "GATEWAY",
        JSON.stringify({
            user: event.user.username,
            shards: event.shards,
            applicationId: event.applicationId,
            ping: bot.ping,
            cache: {
                guilds: bot.cache.guilds.size,
                channels: bot.cache.channels.size,
                roles: bot.cache.roles.size,
                users: bot.cache.users.size,
                members: bot.cache.members.size,
                messages: bot.cache.messages.size,
            },
        })
    );

    clearTimeout(timeout);
    bot.destroy();
    setTimeout(() => process.exit(0), 200);
});

await bot.login();
