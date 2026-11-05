import { TypedEmitter } from "../../utils/typed-emitter";
import { IdentifyThrottle } from "./identify";
import type {
    GatewayDispatchEventMap,
    GatewayDispatchEventName,
} from "./dispatch-types";
import {
    WS_OPEN,
    type WebSocketData,
    type WebSocketFactory,
    type WebSocketLike,
} from "./socket";
import type {
    GatewayPayload,
    GatewayPresence,
    GatewayReadyPayload,
    ShardEvents,
} from "./types";
import { ZlibStream } from "./zlib";

export interface ShardOptions {
    id: number;
    count: number;
    token: string;
    intents: number;
    url: string;
    compress: boolean;
    presence?: GatewayPresence;
    webSocketFactory: WebSocketFactory;
    throttle: IdentifyThrottle;
    now: () => number;
    random: () => number;
    schedule: (fn: () => void, ms: number) => unknown;
    clearSchedule: (handle: unknown) => void;
}

const FATAL_CLOSE_CODES = new Set([4004, 4010, 4011, 4012, 4013, 4014]);
const NON_RESUMABLE_CLOSE_CODES = new Set([1000, 1001, 4007, 4009]);

export type ShardState =
    | "idle"
    | "connecting"
    | "identifying"
    | "resuming"
    | "ready"
    | "disconnected"
    | "destroyed";

/**
 * One gateway connection.
 *
 * The shard owns its sequence, session id and heartbeat. Reconnection is
 * handled internally with exponential backoff; `destroy()` is final.
 */
export class Shard extends TypedEmitter<ShardEvents> {
    public readonly id: number;
    public readonly count: number;

    private readonly token: string;
    private readonly intents: number;
    private readonly baseUrl: string;
    private readonly compress: boolean;
    private readonly presence?: GatewayPresence;
    private readonly webSocketFactory: WebSocketFactory;
    private readonly throttle: IdentifyThrottle;
    private readonly now: () => number;
    private readonly random: () => number;
    private readonly schedule: (fn: () => void, ms: number) => unknown;
    private readonly clearSchedule: (handle: unknown) => void;

    private socket?: WebSocketLike;
    private zlib?: ZlibStream;
    private zlibQueue: Promise<void> = Promise.resolve();
    private heartbeatHandle?: unknown;
    private reconnectHandle?: unknown;
    private heartbeatInterval = 0;
    private ackReceived = true;
    private lastHeartbeatAt: number | null = null;
    private latency: number | null = null;
    private sequence: number | null = null;
    private sessionId: string | null = null;
    private resumeUrl: string | null = null;
    private attempt = 0;
    private generation = 0;
    private destroyed = false;
    private ready = false;
    private authenticated = false;
    private state: ShardState = "idle";

    constructor(options: ShardOptions) {
        super();
        this.id = options.id;
        this.count = options.count;
        this.token = options.token;
        this.intents = options.intents;
        this.baseUrl = options.url;
        this.compress = options.compress;
        this.presence = options.presence;
        this.webSocketFactory = options.webSocketFactory;
        this.throttle = options.throttle;
        this.now = options.now;
        this.random = options.random;
        this.schedule = options.schedule;
        this.clearSchedule = options.clearSchedule;
    }

    public get currentSequence(): number | null {
        return this.sequence;
    }

    public get currentSessionId(): string | null {
        return this.sessionId;
    }

    public get currentLatency(): number | null {
        return this.latency;
    }

    public get isReady(): boolean {
        return this.ready;
    }

    /** Current connection state. */
    public get status(): ShardState {
        return this.state;
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

    /** Opens a new socket. Must not be called after {@link destroy}. */
    public connect(): void {
        if (this.destroyed) return;

        this.generation += 1;
        const generation = this.generation;
        this.authenticated = false;
        this.ready = false;
        this.state = "connecting";

        this.clearHeartbeat();
        this.clearReconnect();

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close(4000, "reconnecting");
            this.socket = undefined;
        }

        if (this.compress) {
            this.zlib?.close();
            this.zlib = new ZlibStream();
            this.zlibQueue = Promise.resolve();
        }

        const url = this.buildUrl();
        this.emit("debug", `[Shard ${this.id}] connecting to ${url}`);

        const socket = this.webSocketFactory(url);
        this.socket = socket;

        socket.on("open", () => {
            if (generation !== this.generation) return;
            this.emit("debug", `[Shard ${this.id}] socket open`);
        });

        socket.on("message", (data) => {
            if (generation !== this.generation) return;
            this.handleMessage(data);
        });

        socket.on("close", (code, reason) => {
            if (generation !== this.generation) return;
            this.handleClose(code, reason);
        });

        socket.on("error", (error) => {
            if (generation !== this.generation) return;
            this.emit("error", toError(error));
        });
    }

    /** Closes the connection permanently. */
    public destroy(): void {
        if (this.destroyed) return;
        this.destroyed = true;
        this.ready = false;
        this.state = "destroyed";

        this.clearHeartbeat();
        this.clearReconnect();
        this.zlib?.close();
        this.zlib = undefined;

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close(1000, "destroy");
            this.socket = undefined;
        }

        this.removeAllListeners();
    }

    private buildUrl(): string {
        const base = this.sessionId && this.resumeUrl ? this.resumeUrl : this.baseUrl;
        const url = new URL(base);
        url.searchParams.set("v", "10");
        url.searchParams.set("encoding", "json");
        if (this.compress) url.searchParams.set("compress", "zlib-stream");
        return url.toString();
    }

    private handleMessage(data: WebSocketData): void {
        if (!this.compress) {
            this.handleRaw(toBuffer(data).toString("utf8"));
            return;
        }

        this.zlib ??= new ZlibStream();
        const zlib = this.zlib;
        const generation = this.generation;

        this.zlibQueue = this.zlibQueue
            .then(() => zlib.push(toBuffer(data)))
            .then((text) => {
                if (text && generation === this.generation) this.handleRaw(text);
            })
            .catch((error) => {
                this.emit("error", toError(error));
            });
    }

    private handleRaw(raw: string): void {
        let payload: GatewayPayload;
        try {
            payload = JSON.parse(raw) as GatewayPayload;
        } catch (error) {
            this.emit("error", new Error(`Invalid gateway payload: ${toError(error).message}`));
            return;
        }

        if (payload.s !== undefined && payload.s !== null) {
            this.sequence = payload.s;
        }

        switch (payload.op) {
            case 0:
                this.handleDispatch(payload);
                break;
            case 1:
                this.sendHeartbeat();
                break;
            case 7:
                this.emit("warn", `[Shard ${this.id}] Discord requested a reconnect.`);
                this.reconnectNow(4000, "reconnect requested");
                break;
            case 9:
                this.handleInvalidSession(Boolean(payload.d));
                break;
            case 10:
                this.handleHello(payload.d as { heartbeat_interval?: number });
                break;
            case 11:
                this.handleAck();
                break;
            default:
                this.emit("debug", `[Shard ${this.id}] unknown opcode ${payload.op}`);
        }
    }

    private handleHello(data: { heartbeat_interval?: number }): void {
        const interval = Number(data?.heartbeat_interval);
        if (!Number.isFinite(interval) || interval <= 0) {
            this.emit("error", new Error(`[Shard ${this.id}] HELLO did not include a heartbeat interval.`));
            return;
        }

        this.heartbeatInterval = interval;
        this.ackReceived = true;
        this.clearHeartbeat();

        const jitter = Math.floor(this.random() * interval);
        this.scheduleHeartbeat(jitter);
        this.authenticate();
    }

    private authenticate(): void {
        if (this.authenticated) return;

        if (this.sessionId && this.sequence !== null) {
            this.sendResume();
            return;
        }

        const generation = this.generation;
        void this.throttle
            .acquire()
            .then(() => {
                if (this.destroyed || generation !== this.generation) return;
                this.sendIdentify();
            })
            .catch((error) => this.emit("error", toError(error)));
    }

    private sendIdentify(): void {
        const data: Record<string, unknown> = {
            token: this.token,
            intents: this.intents,
            properties: {
                os: process.platform,
                browser: "arx.js",
                device: "arx.js",
            },
            shard: [this.id, this.count],
        };

        if (this.presence) data.presence = this.presence;

        this.authenticated = true;
        this.state = "identifying";
        this.send({ op: 2, d: data });
        this.emit("debug", `[Shard ${this.id}] IDENTIFY sent`);
    }

    private sendResume(): void {
        if (!this.sessionId) return;
        this.authenticated = true;
        this.state = "resuming";
        this.send({
            op: 6,
            d: {
                token: this.token,
                session_id: this.sessionId,
                seq: this.sequence,
            },
        });
        this.emit("debug", `[Shard ${this.id}] RESUME sent`);
    }

    private handleDispatch(payload: GatewayPayload): void {
        const event = payload.t;
        if (!event) return;

        if (event === "READY") {
            const ready = payload.d as GatewayReadyPayload;
            this.sessionId = ready.session_id;
            this.resumeUrl = ready.resume_gateway_url ?? this.baseUrl;
            this.attempt = 0;
            this.ready = true;
            this.state = "ready";
            this.emit("ready", ready);
            return;
        }

        if (event === "RESUMED") {
            this.attempt = 0;
            this.ready = true;
            this.state = "ready";
            this.emit("resumed", payload.d);
            return;
        }

        this.emit("dispatch", event, payload.d, this.id);
    }

    private handleInvalidSession(resumable: boolean): void {
        this.emit("warn", `[Shard ${this.id}] invalid session (resumable: ${resumable})`);
        this.clearHeartbeat();
        this.authenticated = false;
        this.ready = false;
        this.state = "disconnected";
        this.emit("close", {
            shardId: this.id,
            code: 4000,
            reason: "invalid session",
            resumable,
        });

        if (!resumable) {
            this.sessionId = null;
            this.sequence = null;
            this.resumeUrl = null;
        }

        const delay = 1000 + Math.floor(this.random() * 4000);
        this.emit("debug", `[Shard ${this.id}] reconnecting after invalid session in ${delay}ms`);

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close(4000, "invalid session");
            this.socket = undefined;
        }

        this.scheduleReconnect(delay);
    }

    private handleAck(): void {
        this.ackReceived = true;
        this.latency = this.lastHeartbeatAt === null ? null : this.now() - this.lastHeartbeatAt;
        this.emit("debug", `[Shard ${this.id}] heartbeat ACK (${this.latency ?? "?"} ms)`);
    }

    private scheduleHeartbeat(delay: number): void {
        this.clearHeartbeat();
        this.heartbeatHandle = this.schedule(() => {
            this.heartbeatHandle = undefined;
            this.heartbeatTick();
        }, delay);
    }

    private heartbeatTick(): void {
        if (this.destroyed) return;

        if (!this.ackReceived) {
            this.emit("warn", `[Shard ${this.id}] zombie connection; reconnecting.`);
            this.reconnectNow(4000, "zombie connection");
            return;
        }

        this.sendHeartbeat();
        this.scheduleHeartbeat(this.heartbeatInterval);
    }

    private sendHeartbeat(): void {
        this.ackReceived = false;
        this.lastHeartbeatAt = this.now();
        this.send({ op: 1, d: this.sequence });
        this.emit("heartbeat", {
            shardId: this.id,
            sequence: this.sequence,
            latency: this.latency,
        });
    }

    private handleClose(code: number, reason: Buffer): void {
        const reasonText = reason?.toString() ?? "";
        this.ready = false;
        this.authenticated = false;
        this.state = "disconnected";
        this.clearHeartbeat();
        this.socket = undefined;

        const resumable = this.isResumable(code) && this.sessionId !== null;
        this.emit("close", {
            shardId: this.id,
            code,
            reason: reasonText,
            resumable,
        });

        if (this.destroyed || code === 1000 || code === 1001) {
            return;
        }

        if (FATAL_CLOSE_CODES.has(code)) {
            this.sessionId = null;
            this.sequence = null;
            this.resumeUrl = null;
            this.emit("error", new Error(`[Shard ${this.id}] fatal close code ${code}: ${reasonText}`));
            return;
        }

        if (!this.isResumable(code)) {
            this.sessionId = null;
            this.sequence = null;
            this.resumeUrl = null;
        }

        const delay = this.backoffDelay();
        this.emit(
            "debug",
            `[Shard ${this.id}] closed with ${code}; reconnecting in ${delay}ms (${resumable ? "resume" : "identify"})`
        );
        this.scheduleReconnect(delay);
    }

    private reconnectNow(code: number, reason: string): void {
        this.ready = false;
        this.state = "disconnected";
        this.clearHeartbeat();

        this.emit("close", {
            shardId: this.id,
            code,
            reason,
            resumable: this.isResumable(code) && this.sessionId !== null,
        });

        if (this.socket) {
            this.socket.removeAllListeners();
            this.socket.close(code, reason);
            this.socket = undefined;
        }

        this.scheduleReconnect(this.backoffDelay());
    }

    private scheduleReconnect(delay: number): void {
        if (this.destroyed || this.reconnectHandle !== undefined) return;

        this.reconnectHandle = this.schedule(() => {
            this.reconnectHandle = undefined;
            this.connect();
        }, delay);
    }

    private clearHeartbeat(): void {
        if (this.heartbeatHandle !== undefined) {
            this.clearSchedule(this.heartbeatHandle);
            this.heartbeatHandle = undefined;
        }
    }

    private clearReconnect(): void {
        if (this.reconnectHandle !== undefined) {
            this.clearSchedule(this.reconnectHandle);
            this.reconnectHandle = undefined;
        }
    }

    private isResumable(code: number): boolean {
        if (NON_RESUMABLE_CLOSE_CODES.has(code)) return false;
        if (FATAL_CLOSE_CODES.has(code)) return false;
        return true;
    }

    private backoffDelay(): number {
        this.attempt += 1;
        const base = Math.min(30_000, 1000 * 2 ** (this.attempt - 1));
        return Math.round(base * (0.5 + this.random() / 2));
    }

    private send(payload: GatewayPayload): boolean {
        if (!this.socket || this.socket.readyState !== WS_OPEN) return false;

        try {
            this.socket.send(JSON.stringify(payload));
            return true;
        } catch (error) {
            this.emit("error", toError(error));
            return false;
        }
    }
}

function toBuffer(data: WebSocketData): Buffer {
    if (typeof data === "string") return Buffer.from(data);
    if (Buffer.isBuffer(data)) return data;
    if (Array.isArray(data)) return Buffer.concat(data);
    if (data instanceof ArrayBuffer) return Buffer.from(data);
    return Buffer.from(data as ArrayBuffer);
}

function toError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}
