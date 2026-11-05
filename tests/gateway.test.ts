import { afterEach, describe, expect, it, vi } from "vitest";
import {
    Intents,
    resolveIntents,
    ShardManager,
    type GatewayInfo,
    type GatewayOptions,
    type WebSocketData,
    type WebSocketLike,
} from "@arx.js/discord";

class FakeSocket {
    public readyState = 0;
    public sent: any[] = [];

    private handlers = new Map<string, Array<(...args: any[]) => void>>();

    public on(event: string, listener: (...args: any[]) => void): this {
        const list = this.handlers.get(event) ?? [];
        list.push(listener);
        this.handlers.set(event, list);
        return this;
    }

    public removeAllListeners(): this {
        this.handlers.clear();
        return this;
    }

    public send(data: string | Uint8Array): void {
        this.sent.push(typeof data === "string" ? JSON.parse(data) : data);
    }

    public close(code = 1000, reason = ""): void {
        this.readyState = 3;
        this.emit("close", code, Buffer.from(reason));
    }

    public open(): void {
        this.readyState = 1;
        this.emit("open");
    }

    public message(payload: unknown): void {
        this.emit("message", Buffer.from(JSON.stringify(payload)) as WebSocketData);
    }

    public emit(event: string, ...args: any[]): void {
        for (const listener of this.handlers.get(event) ?? []) {
            listener(...args);
        }
    }
}

interface ScheduledTask {
    handle: symbol;
    fn: () => void;
    ms: number;
}

function createScheduler() {
    const tasks: ScheduledTask[] = [];

    return {
        tasks,
        schedule(fn: () => void, ms: number) {
            const handle = Symbol("timer");
            tasks.push({ handle, fn, ms });
            return handle;
        },
        clear(handle: unknown) {
            const index = tasks.findIndex((task) => task.handle === handle);
            if (index >= 0) tasks.splice(index, 1);
        },
        runNext() {
            const task = tasks.shift();
            task?.fn();
            return task;
        },
    };
}

const gatewayInfo: GatewayInfo = {
    url: "wss://gateway.test",
    shards: 1,
    session_start_limit: { max_concurrency: 1 },
};

const readyPayload = {
    v: 10,
    user: { id: "1", username: "bot" },
    guilds: [],
    session_id: "session-1",
    resume_gateway_url: "wss://resume.test",
};

const activeGateways: ShardManager[] = [];

function createGateway(options: Partial<GatewayOptions> = {}) {
    const sockets: FakeSocket[] = [];
    const urls: string[] = [];
    const scheduler = createScheduler();
    const clock = { now: 0 };

    const gateway = new ShardManager({
        token: "token",
        intents: ["Guilds", "GuildMessages"],
        gatewayInfo,
        identifyInterval: 0,
        webSocketFactory: (url) => {
            urls.push(url);
            const socket = new FakeSocket();
            sockets.push(socket);
            return socket as unknown as WebSocketLike;
        },
        now: () => clock.now,
        sleep: async (ms) => {
            clock.now += ms;
        },
        random: () => 0,
        schedule: scheduler.schedule,
        clearSchedule: scheduler.clear,
        ...options,
    });

    activeGateways.push(gateway);
    return { gateway, sockets, urls, scheduler, clock };
}

afterEach(() => {
    for (const gateway of activeGateways.splice(0)) {
        gateway.destroy();
    }
});

describe("intents", () => {
    it("resolves intent names into a bitfield", () => {
        expect(resolveIntents(["Guilds", "GuildMessages", "MessageContent"])).toBe(33281);
        expect(resolveIntents(513)).toBe(513);
        expect(resolveIntents(["Guilds"])).toBe(Intents.Guilds);
    });

    it("rejects unknown intents", () => {
        expect(() => resolveIntents(["Nope" as never])).toThrow(/unknown gateway intent/i);
    });
});

describe("ShardManager", () => {
    it("sends IDENTIFY after HELLO", async () => {
        const { gateway, sockets } = createGateway();
        await gateway.connect();

        expect(gateway.shards[0]!.status).toBe("connecting");

        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 10, d: { heartbeat_interval: 45_000 } });

        await vi.waitFor(() => {
            expect(socket.sent.some((payload) => payload.op === 2)).toBe(true);
        });

        expect(gateway.shards[0]!.status).toBe("identifying");

        expect(socket.sent.find((payload) => payload.op === 2)).toMatchObject({
            op: 2,
            d: {
                token: "token",
                intents: 513,
                shard: [0, 1],
            },
        });
    });

    it("emits ready once every shard is ready", async () => {
        const { gateway, sockets } = createGateway();
        const ready = new Promise<any>((resolve) => gateway.once("ready", resolve));

        await gateway.connect();
        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 10, d: { heartbeat_interval: 45_000 } });
        await vi.waitFor(() => {
            expect(socket.sent.some((payload) => payload.op === 2)).toBe(true);
        });

        socket.message({ op: 0, t: "READY", s: 1, d: readyPayload });

        await expect(ready).resolves.toMatchObject({
            user: { id: "1", username: "bot" },
            shards: 1,
            shardIds: [0],
        });
        expect(gateway.ready).toBe(true);
        expect(gateway.shards[0]!.status).toBe("ready");
    });

    it("uses jitter for the first heartbeat and tracks latency", async () => {
        const { gateway, sockets, scheduler, clock } = createGateway({ random: () => 0.5 });
        await gateway.connect();

        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 10, d: { heartbeat_interval: 1000 } });

        expect(scheduler.tasks[0]?.ms).toBe(500);

        scheduler.runNext();
        expect(socket.sent.find((payload) => payload.op === 1)).toMatchObject({
            op: 1,
            d: null,
        });

        // The shard emitted its first heartbeat at t=0; ACK arrives at t=150.
        // Heartbeat latency is only known after an ACK.
        clock.now = 150;
        socket.message({ op: 11 });

        expect(gateway.shards[0]!.currentLatency).toBe(150);
    });

    it("reconnects when a heartbeat is not acknowledged", async () => {
        const warnings: string[] = [];
        const { gateway, sockets, scheduler } = createGateway();
        gateway.on("warn", (message) => warnings.push(message));

        await gateway.connect();
        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 10, d: { heartbeat_interval: 1000 } });

        scheduler.runNext(); // heartbeat 1
        scheduler.runNext(); // no ACK -> zombie

        expect(warnings.join(" ")).toMatch(/zombie/i);
        expect(socket.readyState).toBe(3);
        expect(scheduler.tasks.length).toBeGreaterThan(0);

        scheduler.runNext(); // reconnect timer
        expect(sockets.length).toBe(2);
    });

    it("resumes with session_id and sequence after a resumable close", async () => {
        const { gateway, sockets, scheduler, urls } = createGateway();
        await gateway.connect();

        const first = sockets[0]!;
        first.open();
        first.message({ op: 10, d: { heartbeat_interval: 45_000 } });
        await vi.waitFor(() => {
            expect(first.sent.some((payload) => payload.op === 2)).toBe(true);
        });
        first.message({ op: 0, t: "READY", s: 1, d: readyPayload });

        first.close(4000, "network");
        scheduler.runNext();

        expect(sockets.length).toBe(2);
        expect(urls[1]).toContain("wss://resume.test");

        const second = sockets[1]!;
        second.open();
        second.message({ op: 10, d: { heartbeat_interval: 45_000 } });

        await vi.waitFor(() => {
            expect(second.sent.some((payload) => payload.op === 6)).toBe(true);
        });

        expect(second.sent.find((payload) => payload.op === 6)).toMatchObject({
            op: 6,
            d: {
                token: "token",
                session_id: "session-1",
                seq: 1,
            },
        });

        const shardReady = new Promise<number>((resolve) => gateway.once("shardReady", resolve));
        second.message({ op: 0, t: "RESUMED", s: 2, d: {} });

        await expect(shardReady).resolves.toBe(0);
        expect(gateway.ready).toBe(true);
    });

    it("does not reconnect on fatal close codes", async () => {
        const errors: Error[] = [];
        const { gateway, sockets, scheduler } = createGateway();
        gateway.on("error", (error) => errors.push(error));

        await gateway.connect();
        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 10, d: { heartbeat_interval: 45_000 } });
        await vi.waitFor(() => {
            expect(socket.sent.some((payload) => payload.op === 2)).toBe(true);
        });

        socket.close(4004, "authentication failed");

        expect(errors[0]?.message).toMatch(/fatal close code 4004/i);
        expect(scheduler.tasks.filter((task) => task.ms >= 1000)).toHaveLength(0);
        expect(sockets.length).toBe(1);
    });

    it("re-identifies after a non-resumable invalid session", async () => {
        const { gateway, sockets, scheduler } = createGateway();
        await gateway.connect();

        const first = sockets[0]!;
        first.open();
        first.message({ op: 10, d: { heartbeat_interval: 45_000 } });
        await vi.waitFor(() => {
            expect(first.sent.some((payload) => payload.op === 2)).toBe(true);
        });

        first.message({ op: 9, d: false });
        expect(first.readyState).toBe(3);
        expect(scheduler.tasks[0]?.ms).toBe(1000);

        scheduler.runNext();
        const second = sockets[1]!;
        second.open();
        second.message({ op: 10, d: { heartbeat_interval: 45_000 } });

        await vi.waitFor(() => {
            expect(second.sent.some((payload) => payload.op === 2)).toBe(true);
        });
        expect(second.sent.some((payload) => payload.op === 6)).toBe(false);
    });

    it("forwards dispatch events with the shard id", async () => {
        const { gateway, sockets } = createGateway();
        const events: Array<[string, unknown, number]> = [];
        gateway.on("dispatch", (event, data, shardId) => events.push([event, data, shardId]));

        const typed: Array<[string, number]> = [];
        gateway.onDispatch("MESSAGE_CREATE", (data, shardId) => typed.push([data.id, shardId]));

        await gateway.connect();
        const socket = sockets[0]!;
        socket.open();
        socket.message({ op: 0, t: "MESSAGE_CREATE", s: 2, d: { id: "10" } });

        expect(events[0]).toEqual(["MESSAGE_CREATE", { id: "10" }, 0]);
        expect(typed[0]).toEqual(["10", 0]);
    });

    it("creates the configured number of shards with their shard tuple", async () => {
        const { gateway, sockets } = createGateway({
            gatewayInfo: { ...gatewayInfo, shards: 2 },
        });

        await gateway.connect();
        expect(gateway.shards).toHaveLength(2);
        expect(sockets).toHaveLength(2);

        for (const socket of sockets) {
            socket.open();
            socket.message({ op: 10, d: { heartbeat_interval: 45_000 } });
        }

        await vi.waitFor(() => {
            expect(sockets.every((socket) => socket.sent.some((payload) => payload.op === 2))).toBe(true);
        });

        const identifies = sockets.map((socket) => socket.sent.find((payload) => payload.op === 2));
        expect(identifies[0]).toMatchObject({ d: { shard: [0, 2] } });
        expect(identifies[1]).toMatchObject({ d: { shard: [1, 2] } });
    });

    it("adds the zlib compression query parameter", async () => {
        const { gateway, urls } = createGateway({ compress: true });
        await gateway.connect();

        expect(urls[0]).toContain("compress=zlib-stream");
        expect(urls[0]).toContain("v=10");
        expect(urls[0]).toContain("encoding=json");
    });
});
