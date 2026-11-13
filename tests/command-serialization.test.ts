import { describe, expect, it } from "vitest";
import {
    ApplicationCommandOptionType,
    Command,
    OptionBuilder,
} from "@arx.js/discord";

function leafExecution() {
    return async () => {
        // no-op
    };
}

describe("command serialization", () => {
    it("includes root options in the API payload", () => {
        const command = new Command({
            name: "buscar",
            description: "Busca algo",
        }).addOption((option) =>
            option
                .setName("texto")
                .setDescription("Texto a buscar")
                .setType(ApplicationCommandOptionType.String)
                .setRequired()
                .setMinLength(2)
                .setMaxLength(100)
        );

        const json = command.toJSON();

        expect(json).toMatchObject({
            name: "buscar",
            description: "Busca algo",
            type: 1,
            options: [
                {
                    type: 3,
                    name: "texto",
                    description: "Texto a buscar",
                    required: true,
                    min_length: 2,
                    max_length: 100,
                },
            ],
        });
    });

    it("serializes subcommand groups and subcommands", () => {
        const command = new Command({
            name: "config",
            description: "Configura el bot",
        })
            .addCategory((group) =>
                group
                    .setName("admin")
                    .setDescription("Ajustes de administración")
                    .addSubcommand((sub) =>
                        sub
                            .setName("set")
                            .setDescription("Cambia un ajuste")
                            .addOption((option) =>
                                option
                                    .setName("clave")
                                    .setDescription("Clave a cambiar")
                                    .setRequired()
                                    .addChoice("Logs", "logs")
                            )
                            .setExecution(leafExecution())
                    )
                    .addSubcommand((sub) =>
                        sub
                            .setName("get")
                            .setDescription("Lee un ajuste")
                            .setExecution(leafExecution())
                    )
            )
            .addSubcommand((sub) =>
                sub
                    .setName("info")
                    .setDescription("Muestra información")
                    .setExecution(leafExecution())
            );

        const json = command.toJSON();

        expect(json.options).toEqual([
            {
                type: 2,
                name: "admin",
                description: "Ajustes de administración",
                options: [
                    {
                        type: 1,
                        name: "set",
                        description: "Cambia un ajuste",
                        options: [
                            {
                                type: 3,
                                name: "clave",
                                description: "Clave a cambiar",
                                required: true,
                                choices: [{ name: "Logs", value: "logs" }],
                            },
                        ],
                    },
                    {
                        type: 1,
                        name: "get",
                        description: "Lee un ajuste",
                    },
                ],
            },
            {
                type: 1,
                name: "info",
                description: "Muestra información",
            },
        ]);
    });

    it("rejects mixing root options with subcommands", () => {
        const command = new Command({ name: "mixed", description: "Mezcla" }) as Command<any>;
        command.addOption((option) => option.setName("value").setDescription("Valor"));
        command.addSubcommand((sub) =>
            sub.setName("sub").setDescription("Sub").setExecution(leafExecution())
        );

        expect(() => command.toJSON()).toThrow(/cannot mix root options/i);
    });

    it("rejects invalid command names", () => {
        expect(() => new Command({ name: "Nombre Inválido", description: "x" }).toJSON()).toThrow(
            /lowercase/i
        );
    });

    it("rejects choices combined with autocomplete", () => {
        const option = new OptionBuilder("q", "Query", ApplicationCommandOptionType.String)
            .setAutocomplete()
            .addChoice("A", "a");

        expect(() => option.toJSON()).toThrow(/autocomplete/i);
    });

    it("rejects too many choices", () => {
        const option = new OptionBuilder("q", "Query", ApplicationCommandOptionType.String);
        for (let index = 0; index < 26; index += 1) {
            option.addChoice(`Choice ${index}`, String(index));
        }

        expect(() => option.toJSON()).toThrow(/between 1 and 25/i);
    });

    it("rejects channel types on non-channel options", () => {
        const option = new OptionBuilder("text", "Texto").addChannelType(0);

        expect(() => option.toJSON()).toThrow(/channelTypes/i);
    });

    it("serializes context menu commands with an empty description", () => {
        const command = new Command({
            name: "Ver perfil",
            description: "",
            type: 2,
        });

        expect(command.toJSON()).toMatchObject({
            name: "Ver perfil",
            description: "",
            type: 2,
        });
    });

    it("rejects options on context menu commands", () => {
        const command = new Command({
            name: "Ver perfil",
            description: "",
            type: 2,
        }).addOption((option) => option.setName("x").setDescription("x"));

        expect(() => command.toJSON()).toThrow(/cannot declare options/i);
    });

    it("serializes localizations and permissions", () => {
        const command = new Command({ name: "hola", description: "Saluda" })
            .setNameLocalizations({ "es-ES": "hola", "en-US": "hello" })
            .setDefaultMemberPermissions("8")
            .setDMPermission(false)
            .setNSFW()
            .setExecution(leafExecution());

        expect(command.toJSON()).toMatchObject({
            name_localizations: { "es-ES": "hola", "en-US": "hello" },
            default_member_permissions: "8",
            dm_permission: false,
            nsfw: true,
        });
    });
});
