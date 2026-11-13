import type {
    APIChannel,
    APIGuild,
    APIGuildMember,
    APIMessage,
    APIRole,
    APIUser,
} from "discord-api-types/v10";
import type { GatewayPresenceUpdateData } from "discord-api-types/gateway/v10";
import { LruTtlMap, type LruTtlOptions } from "./LruTtlMap";

export type CachePolicyInput = number | LruTtlOptions;

export interface CacheOptions {
    guilds?: CachePolicyInput;
    channels?: CachePolicyInput;
    roles?: CachePolicyInput;
    /** Member cache is disabled by default. */
    members?: CachePolicyInput;
    /** Message cache is disabled by default. */
    messages?: CachePolicyInput;
    /** Presence cache is disabled by default. */
    presences?: CachePolicyInput;
    users?: CachePolicyInput;
    /** How often sweepers run when started. Defaults to 5 minutes. */
    sweepInterval?: number;
    /** Injected clock for tests. */
    now?: () => number;
}

const DEFAULT_POLICIES = {
    guilds: 100,
    channels: 1000,
    roles: 1000,
    users: 1000,
    members: 0,
    messages: 0,
    presences: 0,
} as const;

/**
 * Opt-in cache. Every collection has its own LRU/TTL policy and can be
 * disabled with `max: 0`.
 */
export class CacheStore {
    public readonly guilds: LruTtlMap<string, APIGuild>;
    public readonly channels: LruTtlMap<string, APIChannel>;
    public readonly roles: LruTtlMap<string, APIRole>;
    public readonly members: LruTtlMap<string, APIGuildMember>;
    public readonly messages: LruTtlMap<string, APIMessage>;
    public readonly users: LruTtlMap<string, APIUser>;
    public readonly presences: LruTtlMap<string, GatewayPresenceUpdateData>;
    public readonly sweepInterval: number;

    private readonly now: () => number;
    private sweeper?: NodeJS.Timeout;

    constructor(options: CacheOptions = {}) {
        this.now = options.now ?? (() => Date.now());
        this.sweepInterval = options.sweepInterval ?? 300_000;

        const policy = (name: keyof typeof DEFAULT_POLICIES): LruTtlOptions =>
            normalizePolicy(options[name], DEFAULT_POLICIES[name]);

        this.guilds = new LruTtlMap(policy("guilds"), this.now);
        this.channels = new LruTtlMap(policy("channels"), this.now);
        this.roles = new LruTtlMap(policy("roles"), this.now);
        this.members = new LruTtlMap(policy("members"), this.now);
        this.messages = new LruTtlMap(policy("messages"), this.now);
        this.users = new LruTtlMap(policy("users"), this.now);
        this.presences = new LruTtlMap(policy("presences"), this.now);
    }

    /** Total number of cached entries. */
    public get size(): number {
        return (
            this.guilds.size +
            this.channels.size +
            this.roles.size +
            this.members.size +
            this.messages.size +
            this.users.size +
            this.presences.size
        );
    }

    public sweep(): void {
        this.guilds.sweep();
        this.channels.sweep();
        this.roles.sweep();
        this.members.sweep();
        this.messages.sweep();
        this.users.sweep();
        this.presences.sweep();
    }

    public clear(): void {
        this.guilds.clear();
        this.channels.clear();
        this.roles.clear();
        this.members.clear();
        this.messages.clear();
        this.users.clear();
        this.presences.clear();
    }

    /** Starts a periodic sweeper. Safe to call more than once. */
    public startSweeper(interval = this.sweepInterval): void {
        if (interval <= 0) return;
        this.stopSweeper();
        this.sweeper = setInterval(() => this.sweep(), interval);
        this.sweeper.unref?.();
    }

    public stopSweeper(): void {
        if (this.sweeper) {
            clearInterval(this.sweeper);
            this.sweeper = undefined;
        }
    }
}

function normalizePolicy(input: CachePolicyInput | undefined, fallback: number): LruTtlOptions {
    if (input === undefined) return { max: fallback };
    if (typeof input === "number") return { max: input };
    return { max: input.max ?? fallback, ttl: input.ttl };
}
