import WebSocket from "ws";
import type { RawData } from "ws";

export type WebSocketData = RawData;

/** Minimal socket contract used by {@link Shard}, injectable in tests. */
export interface WebSocketLike {
    readonly readyState: number;
    send(data: string | Uint8Array): void;
    close(code?: number, reason?: string): void;
    on(event: "open", listener: () => void): this;
    on(event: "message", listener: (data: WebSocketData) => void): this;
    on(event: "close", listener: (code: number, reason: Buffer) => void): this;
    on(event: "error", listener: (error: Error) => void): this;
    removeAllListeners(): this;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

/** Default factory backed by the `ws` package. */
export const defaultWebSocketFactory: WebSocketFactory = (url) => {
    return new WebSocket(url) as unknown as WebSocketLike;
};

/** Numeric value of `WebSocket.OPEN`, kept local to avoid importing `ws` at runtime. */
export const WS_OPEN = 1;
