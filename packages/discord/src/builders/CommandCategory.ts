import type {
    APIApplicationCommandSubcommandGroupOption,
    LocalizationMap,
} from "discord-api-types/v10";
import { Subcommand, type MiddlewareFn } from "./Subcommand";
import { ApplicationCommandOptionType } from "../types/components";
import { assertCommandDescription, assertCommandName, assertCount } from "../utils/validation";

export type { MiddlewareFn };

export interface CategoryData {
    name: string;
    description: string;
    nameLocalizations?: LocalizationMap | null;
    descriptionLocalizations?: LocalizationMap | null;
}

/**
 * Subcommand group (Discord option type 2).
 *
 * The name "category" is kept for backwards compatibility, but this maps to a
 * `SUB_COMMAND_GROUP` in the API. Prefer {@link SubcommandGroup} in new code.
 */
export class CommandCategory {
    public data: CategoryData;
    public middlewares: MiddlewareFn[] = [];
    public subcommands = new Map<string, Subcommand>();

    constructor(data?: Partial<CategoryData>) {
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

    public addSubcommand(builder: (sub: Subcommand) => Subcommand): this {
        const sub = builder(new Subcommand());
        if (!sub.data.name) throw new Error("[CommandCategory] El subcomando requiere un nombre.");
        if (!sub.execution) {
            throw new Error(`[CommandCategory] El subcomando '${sub.data.name}' requiere setExecution().`);
        }
        if (this.subcommands.has(sub.data.name)) {
            throw new Error(`[CommandCategory] Subcomando duplicado: '${sub.data.name}'.`);
        }

        this.subcommands.set(sub.data.name, sub);
        return this;
    }

    public toJSON(): APIApplicationCommandSubcommandGroupOption {
        assertCommandName(this.data.name, "Subcommand group name");
        assertCommandDescription(this.data.description, "Subcommand group description");
        assertCount(Array.from(this.subcommands.values()), 1, 25, `Subcommands of group "${this.data.name}"`);

        const payload: APIApplicationCommandSubcommandGroupOption = {
            type: ApplicationCommandOptionType.SubcommandGroup,
            name: this.data.name,
            description: this.data.description,
            options: Array.from(this.subcommands.values()).map((sub) => sub.toJSON()),
        };

        if (this.data.nameLocalizations) payload.name_localizations = this.data.nameLocalizations;
        if (this.data.descriptionLocalizations) {
            payload.description_localizations = this.data.descriptionLocalizations;
        }

        return payload;
    }
}

/** Discord terminology alias for {@link CommandCategory}. */
export { CommandCategory as SubcommandGroup };
