export interface GatewayPayload<T = unknown> {
    op: number;
    d: T;
    s?: number | null;
    t?: string | null;
}

export interface GatewayUser {
    id: string;
    username: string;
    discriminator?: string;
    global_name?: string | null;
    avatar?: string | null;
    bot?: boolean;
}

export interface GatewayReadyPayload {
    v: number;
    user: GatewayUser;
    guilds: unknown[];
    session_id: string;
    resume_gateway_url: string;
    shard?: [number, number];
    application?: { id: string; flags?: number };
}

export interface GatewayInfo {
    url: string;
    shards: number;
    session_start_limit?: {
        total?: number;
        remaining?: number;
        reset_after?: number;
        max_concurrency?: number;
    };
}

export interface GatewayPresence {
    since?: number | null;
    activities?: unknown[];
    status?: "online" | "idle" | "dnd" | "invisible" | "offline";
    afk?: boolean;
}

export interface ShardCloseInfo {
    shardId: number;
    code: number;
    reason: string;
    resumable: boolean;
}

export interface ShardHeartbeatInfo {
    shardId: number;
    sequence: number | null;
    latency: number | null;
}

export interface ShardEvents {
    ready: [payload: GatewayReadyPayload];
    resumed: [payload: unknown];
    dispatch: [event: string, data: unknown, shardId: number];
    debug: [message: string];
    warn: [message: string];
    error: [error: Error];
    close: [info: ShardCloseInfo];
    heartbeat: [info: ShardHeartbeatInfo];
}

export interface GatewayReadyEvent {
    user: GatewayUser;
    /** Guilds that Discord still has to send through GUILD_CREATE. */
    unavailableGuilds: number;
    shards: number;
    shardIds: number[];
    applicationId?: string;
}

export interface GatewayEvents {
    ready: [event: GatewayReadyEvent];
    shardReady: [shardId: number, payload: GatewayReadyPayload];
    dispatch: [event: string, data: unknown, shardId: number];
    debug: [message: string];
    warn: [message: string];
    error: [error: Error];
    shardDisconnect: [info: ShardCloseInfo];
    heartbeat: [info: ShardHeartbeatInfo];
}

export interface GatewayOptions {
    token: string;
    intents: number | readonly import("./intents").IntentName[];
    /** Used to fetch `/gateway/bot` and for the shard HTTP calls. */
    rest?: import("../rest/RestClient").RestClient;
    /** `"auto"`, a shard count, or an explicit list of shard ids. */
    shards?: "auto" | number | readonly number[];
    /** Enables `compress=zlib-stream`. */
    compress?: boolean;
    presence?: GatewayPresence;
    /** Override for tests. */
    gatewayInfo?: GatewayInfo;
    /** Override for tests. */
    getGatewayInfo?: () => Promise<GatewayInfo>;
    /** Override for tests. */
    webSocketFactory?: import("./socket").WebSocketFactory;
    /** Override for tests. */
    now?: () => number;
    /** Override for tests. */
    sleep?: (ms: number) => Promise<void>;
    /** Override for tests. */
    random?: () => number;
    /** Override for tests. */
    schedule?: (fn: () => void, ms: number) => unknown;
    /** Override for tests. */
    clearSchedule?: (handle: unknown) => void;
    /** Milliseconds between identify payloads. Defaults to 5000 / max_concurrency. */
    identifyInterval?: number;
}
