import { describe, expect, it } from "vitest";
import { Config } from "@arx.js/core";

describe("public entry points", () => {
    it("importar @arx.js/discord no arranca ningún bot", async () => {
        const discord = await import("@arx.js/discord");
        Config.loadSync("", { optional: true });

        expect(typeof discord.Bot).toBe("function");
        expect(discord.config.current).toMatchObject({ arxconsole: false });
        expect(Config.get("DISCORD").arxconsole).toBe(false);
    });

    it("expone los builders y estructuras principales", async () => {
        const discord = await import("@arx.js/discord");

        expect(typeof discord.Command).toBe("function");
        expect(typeof discord.EmbedBuilder).toBe("function");
        expect(typeof discord.ReceivedMessage).toBe("function");
    });
});
