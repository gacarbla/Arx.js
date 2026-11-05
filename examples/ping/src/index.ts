import { Bot } from "@arx.js/discord";

const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error("Falta la variable de entorno DISCORD_TOKEN.");
}

const client = new Bot({
    token,
    intents: ["Guilds", "GuildMessages"],
});

await client.loadCommands(new URL("./commands", import.meta.url));

client.once("ready", async (event) => {
    try {
        console.log(`Conectado como ${event.user.username}`);

        // La aplicación ya conoce su id; registra los comandos.
        const result = await client.syncCommands();
        console.log(
            `Comandos: +${result.added.length} ~${result.updated.length} -${result.removed.length}`
        );
    } catch (error) {
        console.error("No se pudieron registrar los comandos:", error);
    }
});

client.on("error", (error) => console.error(error));

await client.login();
