import { describe, expect, it, vi } from "vitest";
import {
    buildBucketKey,
    DiscordAPIError,
    NetworkError,
    RateLimitError,
    RequestTimeoutError,
    RestClient,
    type RestClientOptions,
} from "@arx.js/discord";

type FetchHandler = (url: string, init: RequestInit) => Response | Promise<Response>;

function createClient(handler: FetchHandler, options: Partial<RestClientOptions> = {}) {
    const clock = { now: 0 };
    const sleeps: number[] = [];

    const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) =>
        handler(String(input), init ?? {});

    const client = new RestClient("token", {
        now: () => clock.now,
        sleep: async (ms) => {
            sleeps.push(ms);
            clock.now += ms;
        },
        random: () => 0,
        fetch: fetchMock as typeof fetch,
        ...options,
    });

    return { client, clock, sleeps };
}

function reply(body: unknown, init: ResponseInit = {}): Response {
    const headers = new Headers(init.headers);
    if (body !== undefined && body !== null && !headers.has("content-type")) {
        headers.set("content-type", "application/json");
    }

    const payload =
        body === undefined || body === null
            ? null
            : typeof body === "string"
              ? body
              : JSON.stringify(body);

    return new Response(payload, { ...init, headers });
}

const CHANNEL = "123456789012345678";
const MESSAGE = "987654321098765432";

describe("buildBucketKey", () => {
    it("normalizes snowflakes and includes major params", () => {
        expect(buildBucketKey("POST", `/channels/${CHANNEL}/messages`)).toBe(
            `POST:/channels/:id/messages|channel_id=${CHANNEL}`
        );
        expect(buildBucketKey("PATCH", `/channels/${CHANNEL}/messages/${MESSAGE}`)).toBe(
            `PATCH:/channels/:id/messages/:id|channel_id=${CHANNEL}`
        );
    });

    it("never leaks webhook or interaction tokens", () => {
        expect(buildBucketKey("POST", `/webhooks/${CHANNEL}/secret-token`)).toBe(
            `POST:/webhooks/:id/:token|webhook_id=${CHANNEL}`
        );
        expect(buildBucketKey("POST", `/interactions/${CHANNEL}/secret-token/callback`)).toBe(
            `POST:/interactions/:id/:token/callback|interaction_id=${CHANNEL}`
        );
    });

    it("keeps routes without major params stable", () => {
        expect(buildBucketKey("GET", "/gateway/bot")).toBe("GET:/gateway/bot");
        expect(buildBucketKey("POST", "/applications/123456789012345678/commands")).toBe(
            "POST:/applications/:id/commands"
        );
    });
});

describe("RestClient", () => {
    it("parses successful JSON responses", async () => {
        const { client } = createClient(() => reply({ ok: true }));

        await expect(client.get("/gateway/bot")).resolves.toEqual({ ok: true });
    });

    it("returns undefined for 204 responses", async () => {
        const { client } = createClient(() => new Response(null, { status: 204 }));

        await expect(client.delete(`/channels/${CHANNEL}/messages/${MESSAGE}`)).resolves.toBeUndefined();
    });

    it("throws DiscordAPIError with status, code and message", async () => {
        const { client } = createClient(() =>
            reply({ message: "Unknown Message", code: 10008 }, { status: 404 })
        );

        const error = await client.get(`/channels/${CHANNEL}/messages/${MESSAGE}`).catch((reason) => reason);

        expect(error).toBeInstanceOf(DiscordAPIError);
        expect(error).toMatchObject({
            status: 404,
            code: 10008,
            message: "Unknown Message",
        });
    });

    it("does not retry non-retryable 4xx errors", async () => {
        let calls = 0;
        const { client } = createClient(() => {
            calls += 1;
            return reply({ message: "Missing Access", code: 50001 }, { status: 403 });
        });

        await expect(client.get("/guilds/123456789012345678")).rejects.toBeInstanceOf(DiscordAPIError);
        expect(calls).toBe(1);
    });

    it("retries 5xx responses with exponential backoff", async () => {
        let calls = 0;
        const { client, sleeps } = createClient(() => {
            calls += 1;
            return calls === 1 ? reply({ message: "boom" }, { status: 500 }) : reply({ ok: true });
        });

        await expect(client.get("/gateway/bot")).resolves.toEqual({ ok: true });
        expect(calls).toBe(2);
        expect(sleeps[0]).toBe(500);
    });

    it("retries 429 and honors retry_after", async () => {
        let calls = 0;
        const { client, sleeps } = createClient(() => {
            calls += 1;
            if (calls === 1) {
                return reply(
                    { message: "You are being rate limited.", retry_after: 1, global: false },
                    {
                        status: 429,
                        headers: {
                            "retry-after": "1",
                            "x-ratelimit-bucket": "abc",
                            "x-ratelimit-limit": "5",
                            "x-ratelimit-remaining": "0",
                            "x-ratelimit-reset-after": "1",
                        },
                    }
                );
            }
            return reply({ ok: true }, { headers: { "x-ratelimit-bucket": "abc", "x-ratelimit-remaining": "5" } });
        });

        await expect(client.get("/gateway/bot")).resolves.toEqual({ ok: true });
        expect(calls).toBe(2);
        expect(sleeps[0]).toBeGreaterThanOrEqual(1000);
    });

    it("honors global 429 responses", async () => {
        let calls = 0;
        const { client, sleeps } = createClient(() => {
            calls += 1;
            if (calls === 1) {
                return reply(
                    { message: "Global rate limit", retry_after: 2, global: true },
                    {
                        status: 429,
                        headers: {
                            "retry-after": "2",
                            "x-ratelimit-global": "true",
                            "x-ratelimit-scope": "global",
                        },
                    }
                );
            }
            return reply({ ok: true });
        });

        await expect(client.get("/gateway/bot")).resolves.toEqual({ ok: true });
        expect(sleeps[0]).toBeGreaterThanOrEqual(2000);
    });

    it("throws RateLimitError when 429 retries are exhausted", async () => {
        const { client } = createClient(
            () =>
                reply(
                    { message: "You are being rate limited.", retry_after: 1, global: false },
                    { status: 429, headers: { "retry-after": "1" } }
                ),
            { retries: 0 }
        );

        const error = await client.get("/gateway/bot").catch((reason) => reason);

        expect(error).toBeInstanceOf(RateLimitError);
        const rateLimit = error as RateLimitError;
        expect(rateLimit.retryAfter).toBe(1);
        expect(rateLimit.global).toBe(false);
    });

    it("retries network errors and wraps the final failure", async () => {
        let calls = 0;
        const { client } = createClient(
            () => {
                calls += 1;
                if (calls === 1) throw new Error("ECONNRESET");
                return reply({ ok: true });
            },
            { retries: 1 }
        );

        await expect(client.get("/gateway/bot")).resolves.toEqual({ ok: true });
        expect(calls).toBe(2);
    });

    it("throws NetworkError after exhausting network retries", async () => {
        const { client } = createClient(
            () => {
                throw new Error("ECONNRESET");
            },
            { retries: 0 }
        );

        await expect(client.get("/gateway/bot")).rejects.toBeInstanceOf(NetworkError);
    });

    it("throws RequestTimeoutError when the timeout elapses", async () => {
        const { client } = createClient(
            (_url, init) =>
                new Promise<Response>((_resolve, reject) => {
                    init.signal?.addEventListener("abort", () =>
                        reject(new DOMException("Aborted", "AbortError"))
                    );
                }),
            { timeout: 10, retries: 0 }
        );

        await expect(client.get("/gateway/bot")).rejects.toBeInstanceOf(RequestTimeoutError);
    });

    it("sends multipart payloads with payload_json and files[n]", async () => {
        let captured: RequestInit | undefined;
        const { client } = createClient((_url, init) => {
            captured = init;
            return reply({ ok: true });
        });

        await client.post(
            `/channels/${CHANNEL}/messages`,
            { content: "hola" },
            {
                files: [
                    {
                        data: new TextEncoder().encode("abc"),
                        filename: "a.txt",
                        contentType: "text/plain",
                    },
                ],
            }
        );

        const body = captured?.body;
        expect(body).toBeInstanceOf(FormData);
        const form = body as FormData;
        expect(form.get("payload_json")).toBe(JSON.stringify({ content: "hola" }));

        const file = form.get("files[0]") as File;
        expect(file.name).toBe("a.txt");
        await expect(file.text()).resolves.toBe("abc");
    });

    it("sends the audit log reason and honors auth: false", async () => {
        let headers: Headers | undefined;
        const { client } = createClient((_url, init) => {
            headers = new Headers(init.headers);
            return reply({ ok: true });
        });

        await client.post(`/guilds/${CHANNEL}/bans/${MESSAGE}`, undefined, {
            reason: "porque sí",
            auth: false,
        });

        expect(headers?.get("x-audit-log-reason")).toBe(encodeURIComponent("porque sí"));
        expect(headers?.has("authorization")).toBe(false);
    });

    it("serializes requests that share a bucket", async () => {
        let calls = 0;
        let release!: () => void;

        const { client } = createClient(() => {
            calls += 1;
            if (calls === 1) {
                return new Promise<Response>((resolve) => {
                    release = () => resolve(reply({ ok: 1 }));
                });
            }
            return reply({ ok: 2 });
        });

        const first = client.get("/gateway/bot");
        const second = client.get("/gateway/bot");

        await vi.waitFor(() => expect(calls).toBe(1));

        release();
        await expect(first).resolves.toEqual({ ok: 1 });
        await expect(second).resolves.toEqual({ ok: 2 });
        expect(calls).toBe(2);
    });

    it("handles 100 concurrent requests without hanging", async () => {
        let calls = 0;
        const { client } = createClient(() => {
            calls += 1;
            return reply({ ok: calls });
        });

        const results = await Promise.all(
            Array.from({ length: 100 }, (_, index) =>
                client.get(`/channels/${123456789012345678n + BigInt(index)}/messages`)
            )
        );

        expect(results).toHaveLength(100);
        expect(calls).toBe(100);
    });

    it("returns the raw response when requested", async () => {
        const { client } = createClient(() => reply({ ok: true }, { status: 200 }));

        const result = await client.requestWithResponse<{ ok: boolean }>("/gateway/bot");

        expect(result.data).toEqual({ ok: true });
        expect(result.response.status).toBe(200);
        await expect(result.response.json()).resolves.toEqual({ ok: true });
    });
});
