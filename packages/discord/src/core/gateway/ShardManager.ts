import { TypedEmitter } from "../../utils/typed-emitter";
import { IdentifyThrottle } from "./identify";
import { resolveIntents } from "./intents";
import type {
    GatewayDispatchEventMap,
    GatewayDispatchEventName,
} from "./dispatch-types";
import { Shard } from "./Shard";
import {
    defaultWebSocketFactory,
    type WebSocketFactory,
} from "./socket";
import type {
    GatewayEvents,
    GatewayInfo,
    GatewayOptions,
    GatewayReadyEvent,
    GatewayReadyPayload,
} from "./types";

/**
 * Owns every shard, fetches `/gateway/bot`, spaces IDENTIFY payloads and
 * exposes a single typed event stream.
 */
export class ShardManager extends TypedEmitter<GatewayEvents> {
    private readonly intents: number;
    private readonly webSocketFactory: WebSocketFactory;
    private readonly now: () => number;
    private readonly sleep: (ms: number) => Promise<void>;
    private readonly random: () => number;
    private readonly schedule: (fn: () => void, ms: number) => unknown;
    private readonly clearSchedule: (handle: unknown) => void;

    private shardInstances: Shard[] = [];
    private readonly readyShards = new Map<number, GatewayReadyPayload>();
    private connectPromise?: Promise<void>;
    private readyEmitted = false;
    private destroyed = false;

    constructor(private readonly options: GatewayOptions) {
        super();
        this.intents = resolveIntents(options.intents);
        this.webSocketFactory = options.webSocketFactory ?? defaultWebSocketFactory;
        this.now = options.now ?? (() => Date.now());
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.random = options.random ?? Math.random;
        this.schedule = options.schedule ?? ((fn, ms) => setTimeout(fn, ms));
        this.clearSchedule = options.clearSchedule ?? ((handle) => clearTimeout(handle as NodeJS.Timeout));
    }

    /** Shards created by `connect()`. */
    public get shards(): readonly Shard[] {
        return this.shardInstances;
    }

    /** True once every shard has received READY. */
    public get ready(): boolean {
        return (
            this.shardInstances.length > 0 &&
            this.readyShards.size === this.shardInstances.length
        );
    }

    /** Average heartbeat latency across shards, or null. */
    public get ping(): number | null {
        const latencies = this.shardInstances
            .map((shard) => shard.currentLatency)
            .filter((latency): latency is number => latency !== null);

        if (latencies.length === 0) return null;
        return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
    }

    /** Typed helper for a known dispatch event. */
    public onDispatch<K extends GatewayDispatchEventName>(
        event: K,
        listener: (data: GatewayDispatchEventMap[K], shardId: number) => void
    ): this {
        return this.on("dispatch", (name, data, shardId) => {
            if (name === event) {
                listener(data as GatewayDispatchEventMap[K], shardId);
            }
        });
    }

    /**
     * Fetches the gateway information and opens every shard.
     *
     * The promise resolves once the sockets have been created; READY arrives
     * later through the `ready` / `shardReady` events.
     */
    public connect(): Promise<void> {
        if (this.destroyed) {
            return Promise.reject(new Error("The gateway has been destroyed."));
        }
        if (!this.connectPromise) {
            this.connectPromise = this.doConnect().catch((error) => {
                this.connectPromise = undefined;
                throw error;
            });
        }
        return this.connectPromise;
    }

    public destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;

        for (const shard of this.shardInstances) {
            shard.destroy();
        }
        this.shardInstances = [];
        this.readyShards.clear();
        this.readyEmitted = false;
        this.connectPromise = undefined;
        this.removeAllListeners();
    }

    private async doConnect(): Promise<void> {
        const info = await this.fetchInfo();
        if (this.destroyed) return;

        const shardIds = this.resolveShardIds(info);
        const shardCount = this.resolveShardCount(info, shardIds);
        const maxConcurrency = Math.max(1, info.session_start_limit?.max_concurrency ?? 1);
        const identifyInterval =
            this.options.identifyInterval ??
            Math.max(1, Math.floor(5000 / maxConcurrency));

        const throttle = new IdentifyThrottle(identifyInterval, this.now, this.sleep);

        this.shardInstances = shardIds.map((id) => {
            const shard = new Shard({
                id,
                count: shardCount,
                token: this.options.token,
                intents: this.intents,
                url: info.url,
                compress: this.options.compress ?? false,
                presence: this.options.presence,
                webSocketFactory: this.webSocketFactory,
                throttle,
                now: this.now,
                random: this.random,
                schedule: this.schedule,
                clearSchedule: this.clearSchedule,
            });

            shard.on("ready", (payload) => this.handleShardReady(id, payload));
            shard.on("resumed", () => {
                const payload = this.readyShards.get(id);
                if (payload) this.emit("shardReady", id, payload);
            });
            shard.on("dispatch", (event, data, shardId) => this.emit("dispatch", event, data, shardId));
            shard.on("debug", (message) => this.emit("debug", message));
            shard.on("warn", (message) => this.emit("warn", message));
            shard.on("error", (error) => this.emit("error", error));
            shard.on("heartbeat", (info) => this.emit("heartbeat", info));
            shard.on("close", (info) => {
                if (!info.resumable) {
                    this.readyShards.delete(info.shardId);
                }
                this.emit("shardDisconnect", info);
            });

            return shard;
        });

        for (const shard of this.shardInstances) {
            shard.connect();
        }
    }

    private handleShardReady(shardId: number, payload: GatewayReadyPayload): void {
        this.readyShards.set(shardId, payload);
        this.emit("shardReady", shardId, payload);

        if (!this.readyEmitted && this.ready) {
            this.readyEmitted = true;
            this.emit("ready", this.buildReadyEvent(payload));
        }
    }

    private buildReadyEvent(payload: GatewayReadyPayload): GatewayReadyEvent {
        const unavailableGuilds = [...this.readyShards.values()].reduce(
            (sum, shardPayload) => sum + (shardPayload.guilds?.length ?? 0),
            0
        );

        return {
            user: payload.user,
            unavailableGuilds,
            shards: this.shardInstances.length,
            shardIds: [...this.readyShards.keys()].sort((a, b) => a - b),
            applicationId: payload.application?.id,
        };
    }

    private resolveShardIds(info: GatewayInfo): number[] {
        const configured = this.options.shards;

        if (Array.isArray(configured)) {
            if (configured.length === 0) {
                throw new Error("The shard list cannot be empty.");
            }
            return [...configured];
        }

        if (typeof configured === "number") {
            if (!Number.isInteger(configured) || configured < 1) {
                throw new RangeError("The shard count must be a positive integer.");
            }
            return Array.from({ length: configured }, (_, index) => index);
        }

        if (!Number.isInteger(info.shards) || info.shards < 1) {
            throw new RangeError(`Discord returned an invalid shard count: ${info.shards}`);
        }
        return Array.from({ length: info.shards }, (_, index) => index);
    }

    private resolveShardCount(info: GatewayInfo, ids: number[]): number {
        const configured = this.options.shards;

        if (Array.isArray(configured)) {
            return Math.max(...ids) + 1;
        }
        if (typeof configured === "number") {
            return configured;
        }
        return info.shards;
    }

    private async fetchInfo(): Promise<GatewayInfo> {
        if (this.options.gatewayInfo) return this.options.gatewayInfo;
        if (this.options.getGatewayInfo) return this.options.getGatewayInfo();

        if (!this.options.rest) {
            throw new Error("GatewayOptions requires either `rest`, `gatewayInfo` or `getGatewayInfo`.");
        }

        return this.options.rest.get<GatewayInfo>("/gateway/bot");
    }
}

/** Discord terminology alias. */
export { ShardManager as Gateway };
