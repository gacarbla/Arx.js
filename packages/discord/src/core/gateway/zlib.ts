import { constants, createInflate, type Inflate } from "node:zlib";

const ZLIB_SUFFIX = Buffer.from([0x00, 0x00, 0xff, 0xff]);

/**
 * Incremental decompressor for Discord's `compress=zlib-stream` transport.
 *
 * Discord flushes the zlib stream after every payload and terminates each
 * flush with `00 00 ff ff`. `push()` returns the decompressed JSON string only
 * when that suffix is present.
 */
export class ZlibStream {
    private readonly inflate: Inflate;
    private chunks: Buffer[] = [];
    private tail: Buffer = Buffer.alloc(0);
    private closed = false;

    constructor() {
        this.inflate = createInflate();
        this.inflate.on("data", (chunk: Buffer) => {
            this.chunks.push(chunk);
        });
        // Prevent an unhandled "error" event when the stream is closed while a
        // flush is still pending. Per-push listeners handle real failures.
        this.inflate.on("error", () => undefined);
    }

    public push(chunk: Buffer): Promise<string | null> {
        if (this.closed) return Promise.reject(new Error("ZlibStream is closed."));

        this.inflate.write(chunk);

        const combined = this.tail.length > 0 ? Buffer.concat([this.tail, chunk]) : chunk;
        this.tail = combined.subarray(-ZLIB_SUFFIX.length);

        if (!this.tail.equals(ZLIB_SUFFIX)) {
            return Promise.resolve(null);
        }

        return new Promise<string>((resolve, reject) => {
            const onError = (error: Error) => reject(error);
            this.inflate.once("error", onError);

            this.inflate.flush(constants.Z_SYNC_FLUSH, () => {
                this.inflate.off("error", onError);
                const text = Buffer.concat(this.chunks).toString("utf8");
                this.chunks = [];
                this.tail = Buffer.alloc(0);
                resolve(text);
            });
        });
    }

    public close(): void {
        if (this.closed) return;
        this.closed = true;
        this.inflate.close();
    }
}
