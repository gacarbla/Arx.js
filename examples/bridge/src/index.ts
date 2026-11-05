import { Client } from "@arx.js/discord.js";

const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error("Falta la variable de entorno DISCORD_TOKEN.");
}

const client = new Client({
    token,
    intents: ["Guilds", "GuildMessages"],
    // Caché segura por defecto: mensajes, miembros y presencias desactivados.
    cache: { messages: 0, members: 0, presences: 0 },
});

await client.loadCommands(new URL("./commands", import.meta.url));

client.once("ready", async (event) => {
    try {
        console.log(`Conectado como ${event.user.username}`);

        const result = await client.syncCommands();
        console.log(
            `Comandos: +${result.added.length} ~${result.updated.length} -${result.removed.length}`
        );
    } catch (error) {
        console.error("No se pudieron registrar los comandos:", error);
    }
});

client.on("error", (error) => console.error(error));

await client.start();
