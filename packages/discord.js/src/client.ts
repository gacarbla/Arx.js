import { EventEmitter } from "node:events";
import { fileURLToPath } from "node:url";
import {
    Client as DiscordJsClient,
    Events,
    type ClientOptions as DiscordJsClientOptions,
    type Interaction,
} from "discord.js";
import {
    CacheStore,
    CommandLoader,
    CommandRegistry,
    CommandRunner,
    ComponentLoader,
    EventLoader,
    I18n,
    InteractionRouter,
    User,
    applyDispatch,
    defaultLogger,
    resolveIntents,
    type CacheOptions,
    type CommandSyncOptions,
    type CommandSyncResult,
    type ContextClient,
    type GatewayReadyEvent,
    type I18nOptions,
    type IntentName,
    type Logger,
    type RestLike,
} from "@arx.js/discord";
import { DiscordJsRestAdapter } from "./rest";
import { DiscordJsInteractionAdapter } from "./interaction";
import { createCacheFactory } from "./cache";
import {
    toRawChannel,
    toRawGuild,
    toRawMember,
    toRawMessage,
    toRawRole,
    toRawUser,
} from "./raw";

export interface ArxClientOptions {
    token: string;
    intents?: number | readonly IntentName[];
    cache?: CacheOptions;
    i18n?: I18nOptions;
    logger?: Logger;
    /** Options forwarded to discord.js. `intents`, `makeCache` and `sweepers` are managed by the bridge. */
    native?: Omit<DiscordJsClientOptions, "intents" | "makeCache" | "sweepers">;
}

/**
 * Developer-friendly ARX client on top of discord.js.
 *
 * It exposes the same command framework, contexts, router and cache as
 * `@arx.js/discord`, but delegates gateway/REST to discord.js. The original
 * client is always available through {@link Client.native}.
 */
export class Client extends EventEmitter implements ContextClient {
    public readonly native: DiscordJsClient;
    public readonly rest: RestLike;
    public readonly cache: CacheStore;
    public readonly i18n: I18n;
    public readonly logger: Logger;
    public readonly commands = new CommandRegistry();
    public readonly router = new InteractionRouter();
    public user: User | null = null;
    public applicationId: string | null = null;

    private readonly token: string;
    private readonly commandLoader: CommandLoader;

    constructor(options: ArxClientOptions) {
        super();
        if (!options.token) throw new Error("[Client] El token es obligatorio.");

        this.token = options.token;
        this.cache = new CacheStore(options.cache);
        this.cache.startSweeper(options.cache?.sweepInterval);
        this.i18n = new I18n(options.i18n);
        this.logger = options.logger ?? defaultLogger;

        this.native = new DiscordJsClient({
            ...options.native,
            intents: resolveIntents(options.intents ?? ["Guilds", "GuildMessages"]),
            makeCache: createCacheFactory(options.cache),
            sweepers: {},
        });

        this.rest = new DiscordJsRestAdapter(this.native.rest as any);
        this.commandLoader = new CommandLoader(this, this.logger);

        this.on("error", (error: unknown) => {
            this.logger.error("[discord.js bridge] Unhandled error:", error);
        });

        this.registerNativeEvents();
    }

    /** discord.js ping, in milliseconds, or null before the first heartbeat. */
    public get ping(): number | null {
        const ping = this.native.ws.ping;
        return ping < 0 ? null : ping;
    }

    /** True once discord.js has received READY. */
    public get ready(): boolean {
        return this.native.isReady();
    }

    /** discord.js guild manager, as an escape hatch. */
    public get guilds() {
        return this.native.guilds;
    }

    /** Alias for {@link native}. */
    public get discord(): DiscordJsClient {
        return this.native;
    }

    public async login(token?: string): Promise<void> {
        await this.native.login(token ?? this.token);
    }

    public async start(token?: string): Promise<void> {
        return this.login(token);
    }

    public destroy(): void {
        this.cache.stopSweeper();
        this.native.destroy();
        this.removeAllListeners();
    }

    public async loadCommands(directory: string | URL): Promise<number> {
        return this.commandLoader.loadSlashCommands(toDirectory(directory));
    }

    public async loadEvents(directory: string | URL): Promise<number> {
        return new EventLoader(this, this.logger).load(toDirectory(directory));
    }

    public async loadComponents(directory: string | URL): Promise<number> {
        return new ComponentLoader(this.router, this.logger).load(toDirectory(directory));
    }

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

    private registerNativeEvents(): void {
        this.native.once(Events.ClientReady, () => this.handleReady());
        this.native.on(Events.InteractionCreate, (interaction) => {
            void this.handleInteraction(interaction);
        });

        for (const [nativeEvent, rawEvent] of RAW_EVENTS) {
            this.native.on(nativeEvent as any, (payload: any) => {
                const data = toRawEvent(nativeEvent, payload);
                if (!data) return;

                applyDispatch(this.cache, rawEvent, data);
                this.emit(rawEvent, data, 0);
                this.emit(nativeEvent, payload);
            });
        }
    }

    private handleReady(): void {
        const nativeUser = this.native.user;
        if (!nativeUser) return;

        const rawUser = toRawUser(nativeUser);
        if (!rawUser) return;
        this.user = new User(this, rawUser);
        this.applicationId = this.native.application?.id ?? nativeUser.id;

        for (const guild of this.native.guilds.cache.values()) {
            const rawGuild = toRawGuild(guild);
            if (rawGuild) applyDispatch(this.cache, "GUILD_CREATE", rawGuild);
        }

        const ready: GatewayReadyEvent = {
            user: rawUser as any,
            unavailableGuilds: 0,
            shards: 1,
            shardIds: [0],
            applicationId: this.applicationId ?? undefined,
        };

        this.emit("ready", ready);
        this.emit(Events.ClientReady, this.native);
    }

    private async handleInteraction(native: Interaction): Promise<void> {
        const interaction = new DiscordJsInteractionAdapter(this, native);
        this.emit("interactionCreate", interaction);

        const raw = interaction.raw as any;

        try {
            if (interaction.type === 2 || interaction.type === 4) {
                const command = this.commands.get(raw.data?.name);
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
}

const RAW_EVENTS: ReadonlyArray<readonly [string, string]> = [
    [Events.MessageCreate, "MESSAGE_CREATE"],
    [Events.MessageUpdate, "MESSAGE_UPDATE"],
    [Events.MessageDelete, "MESSAGE_DELETE"],
    [Events.GuildCreate, "GUILD_CREATE"],
    [Events.GuildUpdate, "GUILD_UPDATE"],
    [Events.GuildDelete, "GUILD_DELETE"],
    [Events.GuildMemberAdd, "GUILD_MEMBER_ADD"],
    [Events.GuildMemberUpdate, "GUILD_MEMBER_UPDATE"],
    [Events.GuildMemberRemove, "GUILD_MEMBER_REMOVE"],
    [Events.ChannelCreate, "CHANNEL_CREATE"],
    [Events.ChannelUpdate, "CHANNEL_UPDATE"],
    [Events.ChannelDelete, "CHANNEL_DELETE"],
    [Events.GuildRoleCreate, "GUILD_ROLE_CREATE"],
    [Events.GuildRoleUpdate, "GUILD_ROLE_UPDATE"],
    [Events.GuildRoleDelete, "GUILD_ROLE_DELETE"],
    [Events.PresenceUpdate, "PRESENCE_UPDATE"],
    [Events.TypingStart, "TYPING_START"],
];

function toDirectory(directory: string | URL): string {
    return typeof directory === "string" ? directory : fileURLToPath(directory);
}

function toRawEvent(nativeEvent: string, payload: any): any {
    if (!payload) return undefined;

    switch (nativeEvent) {
        case Events.MessageCreate:
        case Events.MessageUpdate:
        case Events.MessageDelete:
            return toRawMessage(payload);

        case Events.GuildCreate:
        case Events.GuildUpdate:
            return toRawGuild(payload);

        case Events.GuildDelete:
            return { id: payload.id, unavailable: false };

        case Events.GuildMemberAdd:
        case Events.GuildMemberUpdate:
        case Events.GuildMemberRemove:
            return {
                ...toRawMember(payload),
                guild_id: payload.guild?.id ?? payload.guildId,
            };

        case Events.ChannelCreate:
        case Events.ChannelUpdate:
        case Events.ChannelDelete:
            return toRawChannel(payload);

        case Events.GuildRoleCreate:
        case Events.GuildRoleUpdate:
            return {
                guild_id: payload.guild?.id ?? payload.guildId,
                role: toRawRole(payload),
            };

        case Events.GuildRoleDelete:
            return {
                guild_id: payload.guild?.id ?? payload.guildId,
                role_id: payload.id,
            };

        case Events.PresenceUpdate:
            return {
                guild_id: payload.guild?.id ?? payload.guildId,
                user: toRawUser(payload.user),
                status: payload.status,
                activities: payload.activities?.map((activity: any) => activity.toJSON?.() ?? activity),
            };

        case Events.TypingStart:
            return {
                channel_id: payload.channel?.id ?? payload.channelId,
                guild_id: payload.guild?.id ?? payload.guildId,
                user_id: payload.user?.id,
            };

        default:
            return payload;
    }
}
