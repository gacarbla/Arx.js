import type { CommandRegistry, CommandSyncResult } from "../framework/CommandRegistry";
import type { RestLike } from "../core/rest/RestClient";
import { defaultLogger, type Logger } from "../framework/logger";
import { collectFiles, importModule, pickExport } from "./moduleLoader";

interface CommandLoaderBot {
    commands: CommandRegistry;
    rest: RestLike;
}

/**
 * Loads command modules from a directory and synchronizes them with Discord.
 *
 * A module may export `default` or `command`; the object only needs a
 * `data.name` and a `toJSON()` method, so duplicated package copies do not
 * break the loader.
 */
export class CommandLoader {
    constructor(
        private readonly bot: CommandLoaderBot,
        private readonly logger: Logger = defaultLogger
    ) {}

    /** Loads every command module and returns the number of commands added. */
    public async loadSlashCommands(absolutePath: string): Promise<number> {
        const files = await collectFiles(absolutePath);
        let loaded = 0;

        for (const file of files) {
            try {
                const module = await importModule(file);
                const command = pickExport(module, ["command"]);

                if (!command || typeof command.toJSON !== "function" || !command.data?.name) {
                    this.logger.warn(`[CommandLoader] ${file} does not export a valid command.`);
                    continue;
                }

                const name = String(command.data.name);
                if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
                    this.logger.error(
                        `[CommandLoader] /${name} violates Discord's name rules (1-32 lowercase characters).`
                    );
                    continue;
                }

                if (this.bot.commands.has(name)) {
                    this.logger.error(`[CommandLoader] Duplicate command "${name}" in ${file}.`);
                    continue;
                }

                this.bot.commands.set(name, command);
                loaded += 1;
            } catch (error) {
                this.logger.error(`[CommandLoader] Failed to import ${file}:`, error);
            }
        }

        return loaded;
    }

    /** Alias for {@link loadSlashCommands}. */
    public loadCommands(directory: string): Promise<number> {
        return this.loadSlashCommands(directory);
    }

    /** Synchronizes the registry with Discord. */
    public async registerSlashCommands(options: {
        applicationId: string;
        guildId?: string;
        /** @deprecated The bot's RestClient already holds the token. */
        token?: string;
        deleteMissing?: boolean;
        dryRun?: boolean;
    }): Promise<CommandSyncResult> {
        if (this.bot.commands.size === 0) {
            return { added: [], updated: [], removed: [] };
        }

        return this.bot.commands.sync(this.bot.rest, {
            applicationId: options.applicationId,
            guildId: options.guildId,
            deleteMissing: options.deleteMissing,
            dryRun: options.dryRun,
        });
    }
}
