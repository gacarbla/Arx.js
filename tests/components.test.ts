import { describe, expect, it } from "vitest";
import {
    ActionRow,
    Button,
    Checkbox,
    CheckboxGroup,
    Container,
    Emoji,
    File,
    FileUpload,
    Label,
    MediaGallery,
    MessageFlags,
    OutboundMessage,
    RadioGroup,
    Section,
    Separator,
    StringSelect,
    TextDisplay,
    TextInput,
    Thumbnail,
} from "@arx.js/discord";

describe("Components V2 builders", () => {
    it("serializes a container with numeric component types", () => {
        const container = new Container()
            .setAccentColor(0x5865f2)
            .addComponent(new TextDisplay("# Estado"))
            .addComponent(
                new Section()
                    .setText(new TextDisplay("Todo operativo"))
                    .setAccessory(new Thumbnail().setUrl("https://example.com/ok.png"))
            )
            .addComponent(new Separator())
            .addComponent(
                new ActionRow().addComponent(
                    new Button().setCustomId("refresh").setLabel("Recargar")
                )
            );

        expect(container.toJSON()).toEqual({
            type: 17,
            accent_color: 0x5865f2,
            components: [
                { type: 10, content: "# Estado" },
                {
                    type: 9,
                    components: [{ type: 10, content: "Todo operativo" }],
                    accessory: {
                        type: 11,
                        media: { url: "https://example.com/ok.png" },
                    },
                },
                { type: 14, divider: true },
                {
                    type: 1,
                    components: [
                        { type: 2, style: 1, label: "Recargar", custom_id: "refresh" },
                    ],
                },
            ],
        });
    });

    it("adds the IS_COMPONENTS_V2 flag to messages", () => {
        const payload = new OutboundMessage()
            .addComponent(new Container().addComponent(new TextDisplay("Hola")))
            .toJSON();

        expect(payload.flags & MessageFlags.IS_COMPONENTS_V2).toBe(MessageFlags.IS_COMPONENTS_V2);
        expect(payload.content).toBeUndefined();
    });

    it("allows content with V2 but rejects embeds", () => {
        const message = new OutboundMessage()
            .setContent("Hola")
            .addComponent(new Container().addComponent(new TextDisplay("Mundo")));

        expect(message.toJSON().content).toBe("Hola");
        expect(() => message.addEmbed({ title: "No" }).toJSON()).toThrow(/cannot contain embeds/i);
    });

    it("validates container children", () => {
        const container = new Container().addComponent(
            new Button().setCustomId("x").setLabel("X")
        );

        expect(() => container.toJSON()).toThrow(/cannot be placed inside a Container/i);
    });

    it("rejects non-top-level components in a message", () => {
        const message = new OutboundMessage().addComponent(
            new Button().setCustomId("x").setLabel("X")
        );

        expect(() => message.toJSON()).toThrow(/top level of a message/i);
    });

    it("validates section accessories and text count", () => {
        const section = new Section().setText("Hola").setAccessory(new TextDisplay("No"));

        expect(() => section.toJSON()).toThrow(/accessory/i);
    });

    it("validates action row select rules", () => {
        const row = new ActionRow()
            .addComponent(new StringSelect().setCustomId("s").addOption({ label: "A", value: "a" }))
            .addComponent(new Button().setCustomId("b").setLabel("B"));

        expect(() => row.toJSON()).toThrow(/select menu cannot share/i);
    });

    it("serializes emojis as plain component payloads", () => {
        const button = new Button()
            .setCustomId("wave")
            .setLabel("Saludar")
            .setEmoji(new Emoji({ id: "123", name: "wave", animated: true }));

        expect(button.toJSON()).toMatchObject({
            emoji: { id: "123", name: "wave", animated: true },
        });
    });

    it("serializes media gallery, file, separator and selects", () => {
        expect(
            new MediaGallery().addItem({ url: "https://example.com/a.png", spoiler: true }).toJSON()
        ).toMatchObject({ type: 12, items: [{ spoiler: true }] });

        expect(new Thumbnail().setUrl("attachment://ok.png").toJSON()).toMatchObject({
            type: 11,
            media: { url: "attachment://ok.png" },
        });

        expect(new File().setFile("attachment://report.pdf").toJSON()).toMatchObject({
            type: 13,
            file: { url: "attachment://report.pdf" },
        });

        expect(new Separator({ spacing: "Large" }).toJSON()).toMatchObject({
            type: 14,
            spacing: 2,
        });

        expect(
            new StringSelect()
                .setCustomId("roles")
                .addOption({ label: "Admin", value: "admin", description: "Acceso total" })
                .toJSON()
        ).toMatchObject({
            type: 3,
            custom_id: "roles",
            options: [{ label: "Admin", value: "admin", description: "Acceso total" }],
        });
    });
});

describe("modal builders", () => {
    it("wraps modal components in a Label", () => {
        const label = new Label()
            .setLabel("Nombre")
            .setDescription("Tu nombre visible")
            .setComponent(new TextInput().setCustomId("name").setPlaceholder("Gabriel"));

        expect(label.toJSON()).toMatchObject({
            type: 18,
            label: "Nombre",
            description: "Tu nombre visible",
            component: {
                type: 4,
                custom_id: "name",
                style: 1,
                placeholder: "Gabriel",
            },
        });
    });

    it("serializes checkbox, checkbox group, radio group and file upload", () => {
        expect(new Checkbox().setCustomId("ok").setDefault().toJSON()).toMatchObject({
            type: 23,
            custom_id: "ok",
            default: true,
        });

        expect(
            new CheckboxGroup()
                .setCustomId("features")
                .addOptions([
                    { label: "Uno", value: "1" },
                    { label: "Dos", value: "2" },
                ])
                .setMinValues(0)
                .toJSON()
        ).toMatchObject({
            type: 22,
            custom_id: "features",
            min_values: 0,
            options: [{ label: "Uno", value: "1" }, { label: "Dos", value: "2" }],
        });

        expect(
            new RadioGroup()
                .setCustomId("size")
                .addOptions([
                    { label: "Pequeño", value: "s" },
                    { label: "Grande", value: "l" },
                ])
                .toJSON()
        ).toMatchObject({ type: 21, custom_id: "size" });

        expect(
            new FileUpload()
                .setCustomId("files")
                .setMinValues(0)
                .setMaxValues(3)
                .setFileTypes(["image", ".pdf"])
                .toJSON()
        ).toMatchObject({
            type: 19,
            custom_id: "files",
            min_values: 0,
            max_values: 3,
            file_types: ["image", ".pdf"],
        });
    });

    it("rejects non-modal components inside a Label", () => {
        const label = new Label().setLabel("Inválido").setComponent(new TextDisplay("No"));

        expect(() => label.toJSON()).toThrow(/cannot be placed inside a Label/i);
    });
});
