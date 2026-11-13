import type { APIInteractionDataResolved } from "discord-api-types/v10";
import type { Command } from "../builders/Command";
import type { CommandCategory } from "../builders/CommandCategory";
import type { Subcommand } from "../builders/Subcommand";
import type { InteractionAdapter } from "../structures/interactions/InteractionAdapter";
import { User } from "../structures/User";
import { Member } from "../structures/Member";
import { Channel } from "../structures/Channel";
import { Role } from "../structures/Role";
import { InteractionContext, type ContextClient } from "./InteractionContext";
import type { FocusedOption, ParsedInteractionOptions } from "./parseOptions";

export interface CommandContextMeta {
    command: Command<any>;
    category?: CommandCategory;
    subcommand?: Subcommand;
}

/**
 * Context passed to command middlewares and handlers.
 *
 * `ctx.options` is the same object (`ctx.options.getString(...)` is a
 * convenience alias for `ctx.getString(...)`).
 */
export class CommandContext extends InteractionContext {
    public readonly command: Command<any>;
    public readonly category?: CommandCategory;
    public readonly subcommandInstance?: Subcommand;
    public readonly parsed: ParsedInteractionOptions;
    public readonly focused?: FocusedOption;

    constructor(
        client: ContextClient,
        interaction: InteractionAdapter,
        parsed: ParsedInteractionOptions,
        meta: CommandContextMeta
    ) {
        super(client, interaction);
        this.parsed = parsed;
        this.command = meta.command;
        this.category = meta.category;
        this.subcommandInstance = meta.subcommand;
        this.focused = parsed.focused;
    }

    public get options(): this {
        return this;
    }

    public get args(): Record<string, unknown> {
        return this.parsed.values;
    }

    public get resolved(): APIInteractionDataResolved {
        return this.parsed.resolved;
    }

    public get groupName(): string | undefined {
        return this.parsed.group;
    }

    public get subcommandName(): string | undefined {
        return this.parsed.subcommand;
    }

    public get commandName(): string {
        return this.command.data.name;
    }

    public getRaw(name: string): unknown {
        return this.parsed.values[name];
    }

    public getString(name: string, required = false): string | null {
        const value = this.parsed.values[name];
        if (value === undefined || value === null) return this.missing(name, required);
        return String(value);
    }

    public getInteger(name: string, required = false): number | null {
        const value = this.parsed.values[name];
        if (value === undefined || value === null) return this.missing(name, required);
        return Math.trunc(Number(value));
    }

    public getNumber(name: string, required = false): number | null {
        const value = this.parsed.values[name];
        if (value === undefined || value === null) return this.missing(name, required);
        return Number(value);
    }

    public getBoolean(name: string, required = false): boolean | null {
        const value = this.parsed.values[name];
        if (value === undefined || value === null) return this.missing(name, required);
        return Boolean(value);
    }

    public getUser(name: string, required = false): User | null {
        const id = this.parsed.values[name];
        if (typeof id !== "string") return this.missing(name, required);

        const raw = this.parsed.resolved.users?.[id] ?? this.client.cache.users.get(id);
        return raw ? new User(this.client, raw) : this.missing(name, required);
    }

    public getMember(name: string, required = false): Member | null {
        const id = this.parsed.values[name];
        if (typeof id !== "string" || !this.guildId) return this.missing(name, required);

        const cached = this.client.cache.members.get(`${this.guildId}:${id}`);
        if (cached) return new Member(this.client, this.guildId, cached);

        const raw = this.parsed.resolved.members?.[id];
        if (!raw) return this.missing(name, required);

        const user = this.parsed.resolved.users?.[id];
        return new Member(this.client, this.guildId, (user ? { ...raw, user } : raw) as any);
    }

    public getChannel(name: string, required = false): Channel | null {
        const id = this.parsed.values[name];
        if (typeof id !== "string") return this.missing(name, required);

        const raw = this.parsed.resolved.channels?.[id] ?? this.client.cache.channels.get(id);
        return raw ? new Channel(this.client, raw as any) : this.missing(name, required);
    }

    public getRole(name: string, required = false): Role | null {
        const id = this.parsed.values[name];
        if (typeof id !== "string" || !this.guildId) return this.missing(name, required);

        const raw =
            this.parsed.resolved.roles?.[id] ??
            this.client.cache.roles.get(`${this.guildId}:${id}`);
        return raw ? new Role(this.client, this.guildId, raw) : this.missing(name, required);
    }

    public getAttachment(name: string, required = false): Record<string, unknown> | null {
        const id = this.parsed.values[name];
        if (typeof id !== "string") return this.missing(name, required);

        const raw = this.parsed.resolved.attachments?.[id];
        return raw ? (raw as unknown as Record<string, unknown>) : this.missing(name, required);
    }

    public getFocused(): string | number | null {
        return this.focused?.value ?? null;
    }

    private missing<T>(name: string, required: boolean): T | null {
        if (required) {
            throw new Error(`Missing required option "${name}" for command "${this.commandName}".`);
        }
        return null;
    }
}
