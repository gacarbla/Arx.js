import { Command } from "@arx.js/discord";

const command = new Command({
    name: "ping",
    description: "Mide la latencia del bot",
}).setExecution(async (ctx) => {
    await ctx.reply(`Pong · ${ctx.client.ping ?? "?"} ms`);
});

export default command;
