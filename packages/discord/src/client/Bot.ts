import { EventEmitter } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RestClient } from "../core/rest/RestClient";
import type { RestClientOptions } from "../core/rest/RestClient";
import { ShardManager } from "../core/gateway/ShardManager";
import type { GatewayOptions } from "../core/gateway/types";
import type { IntentName } from "../core/gateway/intents";
import { CacheStore } from "../cache/CacheStore";
import type { CacheOptions } from "../cache/CacheStore";
import { applyDispatch } from "../cache/updaters";
import { User } from "../structures/User";
import { NativeInteractionAdapter } from "../structures/interactions/NativeInteractionAdapter";
import { I18n, type I18nOptions } from "../framework/i18n";
import { defaultLogger, type Logger } from "../framework/logger";
import { CommandRegistry } from "../framework/CommandRegistry";
import type { CommandSyncOptions, CommandSyncResult } from "../framework/CommandRegistry";
import { InteractionRouter } from "../framework/InteractionRouter";
import { EventLoader } from "../loaders/eventLoader";
import { ComponentLoader } from "../loaders/componentLoader";
import type { APIUser } from "discord-api-types/v10";
import { CommandLoader } from "../loaders/commandLoader";
import { CommandRunner } from "../builders/CommandRunner";

export interface BotOptions {
    token: string;
    intents?: number | readonly IntentName[];
    rest?: RestClientOptions;
    cache?: CacheOptions;
    i18n?: I18nOptions;
    logger?: Logger;
    /** Gateway-specific options. `token`, `intents` and `rest` come from the bot. */
    gateway?: Omit<GatewayOptions, "token" | "intents" | "rest">;
}

export interface DirsConfig {
    slashCommands?: string;
}

export class Bot extends EventEmitter {
    public readonly rest: RestClient;
    public readonly cache: CacheStore;
    public readonly i18n: I18n;
    public readonly logger: Logger;
    public readonly commands = new CommandRegistry();
    public readonly router = new InteractionRouter();
    public user: User | null = null;
    public applicationId: string | null = null;
    private readonly gateway: ShardManager;
    private readonly commandLoader: CommandLoader;
    private readonly token: string;

    constructor(options: BotOptions) {
        super();
        if (!options.token) throw new Error("[Bot] El token es obligatorio.");

        this.token = options.token;
        this.rest = new RestClient(options.token, options.rest);
        this.cache = new CacheStore(options.cache);
        this.cache.startSweeper(options.cache?.sweepInterval);
        this.i18n = new I18n(options.i18n);
        this.logger = options.logger ?? defaultLogger;
        this.gateway = new ShardManager({
            ...options.gateway,
            token: options.token,
            intents: options.intents ?? 513,
            rest: this.rest,
        });
        this.commandLoader = new CommandLoader(this, this.logger);

        // Node EventEmitter throws when "error" has no listener. Keep a
        // default logger so a gateway error never crashes the process.
        this.on("error", (error: unknown) => {
            this.logger.error("[Bot] Unhandled error:", error);
        });

        this.setupGatewayEvents();
    }

    /** Average gateway latency, or null before the first heartbeat ACK. */
    public get ping(): number | null {
        return this.gateway.ping;
    }

    /** True once every shard has received READY. */
    public get ready(): boolean {
        return this.gateway.ready;
    }

    /** Shards created by the gateway. */
    public get shards() {
        return this.gateway.shards;
    }

    /**
     * @deprecated Use {@link loadCommands} with an explicit directory
     * (for example `new URL("./commands", import.meta.url)`).
     */
    public async dirs(config: DirsConfig): Promise<this> {
        if (config.slashCommands) {
            const callerDir = this.getCallerFilePath();
            const absolutePath = resolve(callerDir, config.slashCommands);

            await this.commandLoader.loadSlashCommands(absolutePath);
        }
        return this;
    }

    private getCallerFilePath(): string {
        const originalPrepare = Error.prepareStackTrace;
        try {
            Error.prepareStackTrace = (_, stack) => stack;
            const err = new Error();
            const stack = err.stack as unknown as NodeJS.CallSite[];

            const caller = stack[2];
            const fileName = caller?.getFileName();

            if (fileName) {
                if (fileName.startsWith("file://")) {
                    return dirname(fileURLToPath(fileName));
                }
                return dirname(fileName);
            }
        } catch {
        } finally {
            Error.prepareStackTrace = originalPrepare;
        }

        return process.cwd();
    }

    private setupGatewayEvents(): void {
        this.gateway.on("dispatch", (event, data, shardId) => {
            applyDispatch(this.cache, event, data);
            this.emit(event, data, shardId);

            if (event === "INTERACTION_CREATE") {
                void this.handleInteraction(data);
            }
        });

        this.gateway.on("ready", (event) => {
            this.user = new User(this, event.user as APIUser);
            this.applicationId = event.applicationId ?? this.applicationId;
            this.emit("ready", event);
        });
        this.gateway.on("shardReady", (shardId, payload) => this.emit("shardReady", shardId, payload));
        this.gateway.on("shardDisconnect", (info) => this.emit("shardDisconnect", info));
        this.gateway.on("heartbeat", (info) => this.emit("heartbeat", info));
        this.gateway.on("debug", (message) => this.emit("debug", message));
        this.gateway.on("warn", (message) => this.emit("warn", message));
        this.gateway.on("error", (error) => this.emit("error", error));
    }

    private async handleInteraction(rawInteraction: any): Promise<void> {
        const interaction = new NativeInteractionAdapter(this, rawInteraction);
        this.emit("interactionCreate", interaction);

        try {
            if (interaction.type === 2 || interaction.type === 4) {
                const command = this.commands.get(rawInteraction.data?.name);
                if (command) {
                    await CommandRunner.execute(command, interaction, this);
                }
                return;
            }

            if (interaction.type === 3 || interaction.type === 5) {
                const handled = await this.router.route(interaction, this);
                if (!handled) this.emit("unhandledInteraction", interaction);
            }
        } catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error));
            this.emit(
                "error",
                new Error(`Failed to handle interaction ${interaction.id}: ${cause.message}`, {
                    cause,
                })
            );
        }
    }

    /** Loads commands from a directory (string or file URL). */
    public async loadCommands(directory: string | URL): Promise<number> {
        return this.commandLoader.loadSlashCommands(toDirectory(directory));
    }

    /** Loads event modules from a directory. */
    public async loadEvents(directory: string | URL): Promise<number> {
        return new EventLoader(this, this.logger).load(toDirectory(directory));
    }

    /** Loads component modules from a directory into the router. */
    public async loadComponents(directory: string | URL): Promise<number> {
        return new ComponentLoader(this.router, this.logger).load(toDirectory(directory));
    }

    /** Synchronizes the command registry with Discord. */
    public async syncCommands(
        options: Omit<CommandSyncOptions, "applicationId"> = {}
    ): Promise<CommandSyncResult> {
        if (!this.applicationId) {
            throw new Error("Cannot sync commands before the application id is known (wait for READY).");
        }
        return this.commands.sync(this.rest, {
            ...options,
            applicationId: this.applicationId,
        });
    }

    public async login(token?: string): Promise<void> {
        if (token && token !== this.token) {
            throw new Error("[Bot] No se puede cambiar el token después de construir el cliente.");
        }

        this.logger.info("[Bot] Iniciando conexión con Discord...");
        await this.gateway.connect();
    }

    /** Alias for {@link login}, matching the bridge client. */
    public async start(token?: string): Promise<void> {
        return this.login(token);
    }

    public destroy(): void {
        this.cache.stopSweeper();
        this.gateway.destroy();
        this.removeAllListeners();
    }
}

function toDirectory(directory: string | URL): string {
    return typeof directory === "string" ? directory : fileURLToPath(directory);
}
