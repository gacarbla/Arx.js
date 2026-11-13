import type {
    APIApplicationCommandSubcommandOption,
    LocalizationMap,
} from "discord-api-types/v10";
import type { CommandContext } from "../framework/CommandContext";
import {
    OptionBuilder,
    buildBasicOption,
    type CommandOptionData,
} from "./CommandOptions";
import { ApplicationCommandOptionType } from "../types/components";
import { assertCommandDescription, assertCommandName, assertCount } from "../utils/validation";

export type MiddlewareFn = (
    ctx: CommandContext,
    next: () => Promise<void>
) => Promise<boolean | void> | boolean | void;

export type ExecutionFn = (ctx: CommandContext, bot: any) => Promise<void> | void;

export type AutocompleteFn = (ctx: CommandContext) => Promise<void> | void;

export type DeferMode = "public" | "ephemeral" | false;

export interface SubcommandData {
    name: string;
    description: string;
    nameLocalizations?: LocalizationMap | null;
    descriptionLocalizations?: LocalizationMap | null;
}

export class Subcommand {
    public data: SubcommandData;
    public options: CommandOptionData[] = [];
    public middlewares: MiddlewareFn[] = [];
    public execution?: ExecutionFn;
    public autocomplete?: AutocompleteFn;
    public deferMode?: DeferMode;

    constructor(data?: Partial<SubcommandData>) {
        this.data = {
            name: data?.name ?? "",
            description: data?.description ?? "",
            nameLocalizations: data?.nameLocalizations ?? null,
            descriptionLocalizations: data?.descriptionLocalizations ?? null,
        };
    }

    public setName(name: string): this {
        this.data.name = name;
        return this;
    }

    public setDescription(description: string): this {
        this.data.description = description;
        return this;
    }

    public setNameLocalizations(localizations: LocalizationMap | null): this {
        this.data.nameLocalizations = localizations;
        return this;
    }

    public setDescriptionLocalizations(localizations: LocalizationMap | null): this {
        this.data.descriptionLocalizations = localizations;
        return this;
    }

    public addMiddleware(fn: MiddlewareFn): this {
        this.middlewares.push(fn);
        return this;
    }

    public addOption(builder: (opt: OptionBuilder) => OptionBuilder): this {
        const opt = builder(new OptionBuilder("", "", ApplicationCommandOptionType.String));
        this.options.push(opt.data);
        return this;
    }

    public setExecution(fn: ExecutionFn): this {
        this.execution = fn;
        return this;
    }

    public setAutocomplete(fn: AutocompleteFn): this {
        this.autocomplete = fn;
        return this;
    }

    public setDefer(mode: DeferMode = "public"): this {
        this.deferMode = mode;
        return this;
    }

    public toJSON(): APIApplicationCommandSubcommandOption {
        assertCommandName(this.data.name, "Subcommand name");
        assertCommandDescription(this.data.description, "Subcommand description");
        assertCount(this.options, 0, 25, `Options of subcommand "${this.data.name}"`);

        const payload: APIApplicationCommandSubcommandOption = {
            type: ApplicationCommandOptionType.Subcommand,
            name: this.data.name,
            description: this.data.description,
        };

        if (this.data.nameLocalizations) payload.name_localizations = this.data.nameLocalizations;
        if (this.data.descriptionLocalizations) {
            payload.description_localizations = this.data.descriptionLocalizations;
        }
        if (this.options.length > 0) {
            payload.options = this.options.map(buildBasicOption) as unknown as APIApplicationCommandSubcommandOption["options"];
        }

        return payload;
    }
}
