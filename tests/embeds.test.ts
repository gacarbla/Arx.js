import { describe, expect, it } from "vitest";
import { EmbedBuilder } from "@arx.js/discord";

describe("EmbedBuilder", () => {
    it("serializes every supported field with API naming", () => {
        const embed = new EmbedBuilder()
            .setTitle("Título")
            .setDescription("Descripción")
            .setURL("https://example.com")
            .setColor("#5865F2")
            .setTimestamp(new Date("2026-01-01T00:00:00.000Z"))
            .setAuthor({
                name: "Autor",
                url: "https://example.com/author",
                iconUrl: "https://example.com/author.png",
            })
            .setFooter({ text: "Pie", iconUrl: "https://example.com/footer.png" })
            .setImage("https://example.com/image.png")
            .setThumbnail("https://example.com/thumb.png")
            .addField({ name: "Campo", value: "Valor", inline: true })
            .addFields([{ name: "Otro", value: "Más" }]);

        expect(embed.toJSON()).toEqual({
            title: "Título",
            description: "Descripción",
            url: "https://example.com",
            color: 0x5865f2,
            timestamp: "2026-01-01T00:00:00.000Z",
            author: {
                name: "Autor",
                url: "https://example.com/author",
                icon_url: "https://example.com/author.png",
            },
            footer: {
                text: "Pie",
                icon_url: "https://example.com/footer.png",
            },
            image: { url: "https://example.com/image.png" },
            thumbnail: { url: "https://example.com/thumb.png" },
            fields: [
                { name: "Campo", value: "Valor", inline: true },
                { name: "Otro", value: "Más", inline: false },
            ],
        });
    });

    it("accepts numeric colors", () => {
        expect(new EmbedBuilder().setColor(0x00ff00).toJSON().color).toBe(0x00ff00);
    });

    it("rejects invalid colors and URLs", () => {
        expect(() => new EmbedBuilder().setColor("verde")).toThrow(/color/i);
        expect(() => new EmbedBuilder().setURL("no-es-url")).toThrow(/valid absolute URL/i);
    });

    it("rejects more than 25 fields", () => {
        const embed = new EmbedBuilder();
        for (let index = 0; index < 26; index += 1) {
            embed.addField({ name: `Campo ${index}`, value: "x" });
        }

        expect(() => embed.toJSON()).toThrow(/at most 25 fields/i);
    });

    it("rejects embeds over 6000 characters", () => {
        const embed = new EmbedBuilder().setDescription("x".repeat(4096)).addField({
            name: "Campo",
            value: "y".repeat(1024),
        })
            .setFooter({ text: "z".repeat(2048) });

        expect(() => embed.toJSON()).toThrow(/6000 characters/i);
    });
});
