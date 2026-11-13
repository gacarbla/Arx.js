import type {
    APIApplicationCommandBasicOption,
    LocalizationMap,
} from "discord-api-types/v10";
import type { ChannelType } from "../types/channels";
import {
    ApplicationCommandOptionType,
    type CommandOptionChoice,
} from "../types/components";
import {
    assertCommandDescription,
    assertCommandName,
    assertCount,
    assertInteger,
    assertRange,
} from "../utils/validation";

export { ApplicationCommandOptionType };
export type { CommandOptionChoice };

export interface CommandOptionData {
    name: string;
    description: string;
    type: ApplicationCommandOptionType;
    required?: boolean;
    choices?: CommandOptionChoice[];
    minValue?: number;
    maxValue?: number;
    minLength?: number;
    maxLength?: number;
    autocomplete?: boolean;
    channelTypes?: ChannelType[];
    nameLocalizations?: LocalizationMap | null;
    descriptionLocalizations?: LocalizationMap | null;
}

const CHOICE_TYPES: ReadonlySet<number> = new Set([
    ApplicationCommandOptionType.String,
    ApplicationCommandOptionType.Integer,
    ApplicationCommandOptionType.Number,
]);

const NUMERIC_TYPES: ReadonlySet<number> = new Set([
    ApplicationCommandOptionType.Integer,
    ApplicationCommandOptionType.Number,
]);

/**
 * Fluent builder for a single application command option.
 *
 * Validation happens in {@link OptionBuilder.toJSON}, so chaining is cheap and
 * errors point at the exact field that violates Discord's limits.
 */
export class OptionBuilder {
    public readonly data: CommandOptionData;

    constructor(
        name = "",
        description = "",
        type: ApplicationCommandOptionType = ApplicationCommandOptionType.String
    ) {
        this.data = { name, description, type };
    }

    setName(name: string): this {
        this.data.name = name;
        return this;
    }

    setDescription(description: string): this {
        this.data.description = description;
        return this;
    }

    setType(type: ApplicationCommandOptionType): this {
        this.data.type = type;
        return this;
    }

    setRequired(required = true): this {
        this.data.required = required;
        return this;
    }

    addChoice(name: string, value: string | number): this {
        if (!this.data.choices) this.data.choices = [];
        this.data.choices.push({ name, value });
        return this;
    }

    addChoices(choices: readonly CommandOptionChoice[]): this {
        for (const choice of choices) {
            this.addChoice(choice.name, choice.value);
        }
        return this;
    }

    setChoices(choices: readonly CommandOptionChoice[]): this {
        this.data.choices = [...choices];
        return this;
    }

    setAutocomplete(autocomplete = true): this {
        this.data.autocomplete = autocomplete;
        return this;
    }

    setMinValue(minValue: number): this {
        this.data.minValue = minValue;
        return this;
    }

    setMaxValue(maxValue: number): this {
        this.data.maxValue = maxValue;
        return this;
    }

    setMinLength(minLength: number): this {
        this.data.minLength = minLength;
        return this;
    }

    setMaxLength(maxLength: number): this {
        this.data.maxLength = maxLength;
        return this;
    }

    setChannelTypes(types: readonly ChannelType[]): this {
        this.data.channelTypes = [...types];
        return this;
    }

    addChannelType(type: ChannelType): this {
        if (!this.data.channelTypes) this.data.channelTypes = [];
        this.data.channelTypes.push(type);
        return this;
    }

    setNameLocalizations(localizations: LocalizationMap | null): this {
        this.data.nameLocalizations = localizations;
        return this;
    }

    setDescriptionLocalizations(localizations: LocalizationMap | null): this {
        this.data.descriptionLocalizations = localizations;
        return this;
    }

    toJSON(): APIApplicationCommandBasicOption {
        return buildBasicOption(this.data) as unknown as APIApplicationCommandBasicOption;
    }
}

/** Serializes and validates one basic option (never a subcommand/group). */
export function buildBasicOption(data: CommandOptionData): Record<string, unknown> {
    assertCommandName(data.name, "Option name");
    assertCommandDescription(data.description, "Option description");

    if (
        data.type === ApplicationCommandOptionType.Subcommand ||
        data.type === ApplicationCommandOptionType.SubcommandGroup
    ) {
        throw new Error(
            `Option "${data.name}" cannot use type ${data.type}: subcommands are built with addSubcommand/addCategory.`
        );
    }

    const payload: Record<string, unknown> = {
        type: data.type,
        name: data.name,
        description: data.description,
    };

    if (data.required !== undefined) payload.required = data.required;
    if (data.nameLocalizations) payload.name_localizations = data.nameLocalizations;
    if (data.descriptionLocalizations) payload.description_localizations = data.descriptionLocalizations;
    if (data.autocomplete !== undefined) payload.autocomplete = data.autocomplete;

    if (data.choices && data.choices.length > 0) {
        if (!CHOICE_TYPES.has(data.type)) {
            throw new Error(`Option "${data.name}" of type ${data.type} cannot have choices.`);
        }
        if (data.autocomplete) {
            throw new Error(`Option "${data.name}" cannot combine autocomplete with choices.`);
        }
        assertCount(data.choices, 1, 25, `Choices of option "${data.name}"`);

        payload.choices = data.choices.map((choice) => {
            assertCommandDescription(choice.name, `Choice name of "${data.name}"`);
            if (typeof choice.value === "string") {
                if (choice.value.length > 100) {
                    throw new RangeError(
                        `Choice "${choice.name}" of option "${data.name}" must be at most 100 characters.`
                    );
                }
            } else if (!Number.isFinite(choice.value)) {
                throw new TypeError(`Choice "${choice.name}" of option "${data.name}" must be finite.`);
            }
            return { name: choice.name, value: choice.value };
        });
    }

    if (data.minValue !== undefined || data.maxValue !== undefined) {
        if (!NUMERIC_TYPES.has(data.type)) {
            throw new Error(`Option "${data.name}" cannot use minValue/maxValue: it is not numeric.`);
        }
        if (data.minValue !== undefined) {
            if (data.type === ApplicationCommandOptionType.Integer) assertInteger(data.minValue, "minValue");
            assertRange(data.minValue, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, `minValue of "${data.name}"`);
            payload.min_value = data.minValue;
        }
        if (data.maxValue !== undefined) {
            if (data.type === ApplicationCommandOptionType.Integer) assertInteger(data.maxValue, "maxValue");
            assertRange(data.maxValue, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, `maxValue of "${data.name}"`);
            payload.max_value = data.maxValue;
        }
        if (data.minValue !== undefined && data.maxValue !== undefined && data.minValue > data.maxValue) {
            throw new RangeError(`Option "${data.name}" has minValue greater than maxValue.`);
        }
    }

    if (data.minLength !== undefined || data.maxLength !== undefined) {
        if (data.type !== ApplicationCommandOptionType.String) {
            throw new Error(`Option "${data.name}" cannot use minLength/maxLength: it is not a string.`);
        }
        if (data.minLength !== undefined) {
            assertRange(data.minLength, 0, 6000, `minLength of "${data.name}"`);
            payload.min_length = data.minLength;
        }
        if (data.maxLength !== undefined) {
            assertRange(data.maxLength, 1, 6000, `maxLength of "${data.name}"`);
            payload.max_length = data.maxLength;
        }
        if (data.minLength !== undefined && data.maxLength !== undefined && data.minLength > data.maxLength) {
            throw new RangeError(`Option "${data.name}" has minLength greater than maxLength.`);
        }
    }

    if (data.channelTypes && data.channelTypes.length > 0) {
        if (data.type !== ApplicationCommandOptionType.Channel) {
            throw new Error(`Option "${data.name}" cannot use channelTypes: it is not a channel option.`);
        }
        payload.channel_types = [...data.channelTypes];
    }

    return payload;
}
