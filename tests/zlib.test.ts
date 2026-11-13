import { constants, createDeflate } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ZlibStream } from "@arx.js/discord";

async function deflatePayload(payload: string): Promise<Buffer[]> {
    const deflate = createDeflate();
    const chunks: Buffer[] = [];

    deflate.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

    await new Promise<void>((resolve, reject) => {
        deflate.on("error", reject);
        deflate.write(payload, "utf8", () => {
            deflate.flush(constants.Z_SYNC_FLUSH, () => resolve());
        });
    });

    deflate.close();
    return chunks;
}

describe("ZlibStream", () => {
    it("decompresses a zlib-stream payload flushed with Z_SYNC_FLUSH", async () => {
        const payload = JSON.stringify({ op: 10, d: { heartbeat_interval: 45_000 } });
        const chunks = await deflatePayload(payload);
        const stream = new ZlibStream();

        let text: string | null = null;
        for (const chunk of chunks) {
            const result = await stream.push(chunk);
            if (result !== null) text = result;
        }

        expect(text).toBe(payload);
        stream.close();
    });

    it("rejects pushes after close", async () => {
        const stream = new ZlibStream();
        stream.close();

        await expect(stream.push(Buffer.alloc(0))).rejects.toThrow(/closed/i);
    });
});
