import {
    ActionRow,
    Bot,
    Button,
    Command,
    Container,
    OutboundMessage,
    Section,
    Separator,
    TextDisplay,
    Thumbnail,
    encodeCustomId,
} from "@arx.js/discord";

const token = process.env.DISCORD_TOKEN;
if (!token) {
    throw new Error("Falta la variable de entorno DISCORD_TOKEN.");
}

const REFRESH_ID = encodeCustomId("panel", "refresh");

function panel() {
    return new OutboundMessage()
        .addComponent(
            new Container()
                .setAccentColor(0x5865f2)
                .addComponent(new TextDisplay("# Estado del servicio"))
                .addComponent(
                    new Section()
                        .setText("Todo operativo")
                        .setAccessory(
                            new Thumbnail().setUrl(
                                "https://cdn.discordapp.com/embed/avatars/0.png"
                            )
                        )
                )
                .addComponent(new Separator())
                .addComponent(
                    new ActionRow().addComponent(
                        new Button().setCustomId(REFRESH_ID).setLabel("Recargar")
                    )
                )
        )
        .toJSON();
}

const panelCommand = new Command({
    name: "panel",
    description: "Muestra un panel con Components V2",
}).setExecution(async (ctx) => {
    await ctx.reply(panel());
});

const client = new Bot({
    token,
    intents: ["Guilds", "GuildMessages"],
});

client.commands.add(panelCommand);

client.router.button("panel:refresh", async (ctx) => {
    await ctx.update(panel());
});

client.once("ready", async (event) => {
    try {
        console.log(`Conectado como ${event.user.username}`);
        await client.syncCommands();
    } catch (error) {
        console.error("No se pudieron registrar los comandos:", error);
    }
});

client.on("error", (error) => console.error(error));

await client.login();
