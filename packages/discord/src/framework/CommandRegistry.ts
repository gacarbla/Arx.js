import type { APIApplicationCommand } from "discord-api-types/v10";
import type { RestLike } from "../core/rest/RestClient";
import { Command, type ApplicationCommandPayload } from "../builders/Command";

export interface CommandSyncOptions {
    applicationId: string;
    /** Omit for global commands. */
    guildId?: string;
    /** When false, stale commands are left untouched (default true). */
    deleteMissing?: boolean;
    /** Returns the diff without sending anything to Discord. */
    dryRun?: boolean;
}

export interface CommandSyncResult {
    added: ApplicationCommandPayload[];
    updated: ApplicationCommandPayload[];
    removed: APIApplicationCommand[];
    commands?: APIApplicationCommand[];
}

/**
 * Map of commands keyed by name, plus Discord synchronization.
 */
export class CommandRegistry extends Map<string, Command<any>> {
    /** Adds a command and rejects duplicate names. */
    public add(command: Command<any>): Command<any> {
        const name = command.data.name;
        if (this.has(name)) {
            throw new Error(`A command named "${name}" is already registered.`);
        }
        this.set(name, command);
        return command;
    }

    /** Serializes every command into an API payload. */
    public toJSON(): ApplicationCommandPayload[] {
        return [...this.values()].map((command) => command.toJSON());
    }

    /**
     * Compares the registry with Discord and optionally applies the changes.
     *
     * With `deleteMissing` (the default), a single `PUT` replaces the command
     * list, which also removes stale commands. With `deleteMissing: false`,
     * commands are created or patched individually.
     */
    public async sync(rest: RestLike, options: CommandSyncOptions): Promise<CommandSyncResult> {
        const endpoint = options.guildId
            ? `/applications/${options.applicationId}/guilds/${options.guildId}/commands`
            : `/applications/${options.applicationId}/commands`;

        const desired = this.toJSON();
        const existing = await rest.get<APIApplicationCommand[]>(endpoint);
        const existingByKey = new Map(
            existing.map((command) => [commandKey(command.name, command.type), command])
        );

        const desiredKeys = new Set(desired.map((command) => commandKey(command.name, command.type ?? 1)));
        const added: ApplicationCommandPayload[] = [];
        const updated: ApplicationCommandPayload[] = [];

        for (const command of desired) {
            const current = existingByKey.get(commandKey(command.name, command.type ?? 1));
            if (!current) added.push(command);
            else if (commandChanged(current, command)) updated.push(command);
        }

        const removed = existing.filter(
            (command) => !desiredKeys.has(commandKey(command.name, command.type))
        );

        if (options.dryRun) {
            return { added, updated, removed };
        }

        // Avoid consuming the command-registration rate limit when nothing changed.
        if (added.length === 0 && updated.length === 0 && removed.length === 0) {
            return { added, updated, removed, commands: existing };
        }

        if (options.deleteMissing !== false) {
            const commands = await rest.put<APIApplicationCommand[]>(endpoint, desired);
            return { added, updated, removed, commands };
        }

        for (const command of desired) {
            const current = existingByKey.get(commandKey(command.name, command.type ?? 1));
            if (current) {
                await rest.patch(`${endpoint}/${current.id}`, command);
            } else {
                await rest.post(endpoint, command);
            }
        }

        return { added, updated, removed };
    }
}

function commandKey(name: string, type: number | undefined): string {
    return `${name}:${type ?? 1}`;
}

function commandChanged(existing: APIApplicationCommand, desired: ApplicationCommandPayload): boolean {
    return JSON.stringify(normalize(existing)) !== JSON.stringify(normalize(desired));
}

function normalize(command: any): Record<string, unknown> {
    return {
        name: command.name,
        description: command.description,
        type: command.type ?? 1,
        options: command.options ?? [],
        default_member_permissions: command.default_member_permissions ?? null,
        dm_permission: command.dm_permission ?? null,
        nsfw: command.nsfw ?? false,
        contexts: command.contexts ?? null,
        integration_types: command.integration_types ?? null,
    };
}
