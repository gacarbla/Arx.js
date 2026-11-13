import type {
    APIApplicationCommand,
    ApplicationCommandType,
    ApplicationIntegrationType,
    InteractionContextType,
    LocalizationMap,
    Permissions,
} from "discord-api-types/v10";
import { Subcommand, type MiddlewareFn, type ExecutionFn, type AutocompleteFn, type DeferMode } from "./Subcommand";
import { CommandCategory } from "./CommandCategory";
import {
    OptionBuilder,
    buildBasicOption,
    type CommandOptionData,
} from "./CommandOptions";
import { ApplicationCommandOptionType } from "../types/components";
import {
    assertCommandDescription,
    assertCommandName,
    assertCount,
} from "../utils/validation";

export type CommandState = "EMPTY" | "LEAF" | "PARENT";

export interface CommandData {
    name: string;
    description: string;
    type?: ApplicationCommandType;
    nameLocalizations?: LocalizationMap | null;
    descriptionLocalizations?: LocalizationMap | null;
    defaultMemberPermissions?: Permissions | null;
    dmPermission?: boolean;
    nsfw?: boolean;
    integrationTypes?: ApplicationIntegrationType[];
    contexts?: InteractionContextType[] | null;
}

/**
 * Payload accepted by `POST/PUT /applications/{id}/commands`.
 *
 * It is intentionally the create shape: `id`, `application_id` and `version`
 * are assigned by Discord, not by the builder.
 */
export type ApplicationCommandPayload = Pick<APIApplicationCommand, "name" | "description"> &
    Partial<
        Omit<
            APIApplicationCommand,
            | "id"
            | "application_id"
            | "version"
            | "guild_id"
            | "name"
            | "description"
            | "name_localized"
            | "description_localized"
            | "handler"
        >
    >;

export class Command<State extends CommandState = "EMPTY"> {
    public data: CommandData;
    public options: CommandOptionData[] = [];
    public middlewares: MiddlewareFn[] = [];
    public execution?: ExecutionFn;
    public autocomplete?: AutocompleteFn;
    public deferMode?: DeferMode;
    public subcommands = new Map<string, Subcommand>();
    public categories = new Map<string, CommandCategory>();

    constructor(data: CommandData) {
        this.data = { ...data };
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

    public setDefaultMemberPermissions(permissions: Permissions | null): this {
        this.data.defaultMemberPermissions = permissions;
        return this;
    }

    public setDMPermission(enabled = true): this {
        this.data.dmPermission = enabled;
        return this;
    }

    public setNSFW(nsfw = true): this {
        this.data.nsfw = nsfw;
        return this;
    }

    public setContexts(contexts: InteractionContextType[] | null): this {
        this.data.contexts = contexts;
        return this;
    }

    public setIntegrationTypes(types: ApplicationIntegrationType[]): this {
        this.data.integrationTypes = [...types];
        return this;
    }

    public addMiddleware(fn: MiddlewareFn): this {
        this.middlewares.push(fn);
        return this;
    }

    public addOption(
        this: State extends "PARENT" ? never : Command<any>,
        builder: (opt: OptionBuilder) => OptionBuilder
    ): Command<"LEAF"> {
        const opt = builder(new OptionBuilder("", "", ApplicationCommandOptionType.String));
        this.options.push(opt.data);
        return this as any;
    }

    public setExecution(
        this: State extends "PARENT" ? never : Command<any>,
        fn: ExecutionFn
    ): Command<"LEAF"> {
        this.execution = fn;
        return this as any;
    }

    public setAutocomplete(fn: AutocompleteFn): this {
        this.autocomplete = fn;
        return this;
    }

    public setDefer(mode: DeferMode = "public"): this {
        this.deferMode = mode;
        return this;
    }

    public addSubcommand(
        this: State extends "LEAF" ? never : Command<any>,
        builder: (sub: Subcommand) => Subcommand
    ): Command<"PARENT"> {
        const sub = builder(new Subcommand());
        if (!sub.data.name) throw new Error("[Command] El subcomando requiere un nombre.");
        if (!sub.execution) {
            throw new Error(`[Command] El subcomando '${sub.data.name}' requiere setExecution().`);
        }
        if (this.subcommands.has(sub.data.name)) {
            throw new Error(`[Command] Subcomando duplicado: '${sub.data.name}'.`);
        }

        this.subcommands.set(sub.data.name, sub);
        return this as any;
    }

    public addCategory(
        this: State extends "LEAF" ? never : Command<any>,
        builder: (cat: CommandCategory) => CommandCategory
    ): Command<"PARENT"> {
        const cat = builder(new CommandCategory());
        if (!cat.data.name) throw new Error("[Command] La categoría requiere un nombre.");
        if (this.categories.has(cat.data.name)) {
            throw new Error(`[Command] Categoría duplicada: '${cat.data.name}'.`);
        }

        this.categories.set(cat.data.name, cat);
        return this as any;
    }

    public toJSON(): ApplicationCommandPayload {
        const type = this.data.type ?? 1;
        const isChatInput = type === 1;

        assertCommandName(this.data.name, "Command name", isChatInput);
        if (isChatInput) {
            assertCommandDescription(this.data.description);
        } else if (this.data.description !== "") {
            throw new Error("Context menu commands must have an empty description.");
        }

        const hasChildren = this.subcommands.size > 0 || this.categories.size > 0;

        if (hasChildren && this.options.length > 0) {
            throw new Error(
                `Command "${this.data.name}" cannot mix root options with subcommands/subcommand groups.`
            );
        }

        const rootOptions: unknown[] = [];

        if (hasChildren) {
            rootOptions.push(
                ...Array.from(this.categories.values()).map((group) => group.toJSON()),
                ...Array.from(this.subcommands.values()).map((sub) => sub.toJSON())
            );
        } else {
            rootOptions.push(...this.options.map(buildBasicOption));
        }

        if (!isChatInput && rootOptions.length > 0) {
            throw new Error("Context menu commands cannot declare options or subcommands.");
        }

        assertCount(rootOptions, 0, 25, `Options of command "${this.data.name}"`);

        const payload: ApplicationCommandPayload = {
            name: this.data.name,
            description: isChatInput ? this.data.description : "",
            type: type as ApplicationCommandPayload["type"],
        };

        if (rootOptions.length > 0) {
            payload.options = rootOptions as APIApplicationCommand["options"];
        }
        if (this.data.nameLocalizations) payload.name_localizations = this.data.nameLocalizations;
        if (this.data.descriptionLocalizations) {
            payload.description_localizations = this.data.descriptionLocalizations;
        }
        if (this.data.defaultMemberPermissions !== undefined) {
            payload.default_member_permissions = this.data.defaultMemberPermissions;
        }
        if (this.data.dmPermission !== undefined) payload.dm_permission = this.data.dmPermission;
        if (this.data.nsfw !== undefined) payload.nsfw = this.data.nsfw;
        if (this.data.integrationTypes) payload.integration_types = [...this.data.integrationTypes];
        if (this.data.contexts !== undefined) payload.contexts = this.data.contexts;

        return payload;
    }
}
