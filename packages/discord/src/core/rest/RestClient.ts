import { BucketManager, buildBucketKey } from "./buckets";
import {
    DiscordAPIError,
    NetworkError,
    RateLimitError,
    RequestTimeoutError,
} from "./errors";

export interface RestFile {
    /** File contents. */
    data: BlobPart;
    /** Field name used for logging/debugging. */
    name?: string;
    /** Filename sent to Discord. Defaults to `name` or `file-<index>`. */
    filename?: string;
    /** MIME type. */
    contentType?: string;
}

export interface RestClientOptions {
    /** Base URL. Defaults to `https://discord.com/api/v10`. */
    api?: string;
    /** User-Agent sent with every request. */
    userAgent?: string;
    /** Number of retries after the first attempt. Defaults to 3. */
    retries?: number;
    /** Request timeout in milliseconds. Defaults to 15_000. Set to 0 to disable. */
    timeout?: number;
    /** Injected fetch implementation (tests). */
    fetch?: typeof fetch;
    /** Injected clock (tests). */
    now?: () => number;
    /** Injected sleep implementation (tests). */
    sleep?: (ms: number) => Promise<void>;
    /** Injected random source for jitter (tests). */
    random?: () => number;
}

export interface RequestOptions extends Omit<RequestInit, "body" | "method" | "signal"> {
    method?: string;
    body?: unknown;
    files?: RestFile[];
    /** Sent as `X-Audit-Log-Reason`, URL-encoded. */
    reason?: string;
    /** Overrides the client-wide retry count. */
    retries?: number;
    /** Overrides the client-wide timeout. */
    timeout?: number;
    signal?: AbortSignal;
    /** Set to false for endpoints that do not accept a bot token. */
    auth?: boolean;
}

export interface RestResponse<T> {
    data: T;
    response: Response;
}

/** Minimal REST contract used by structures, commands and the bridge. */
export interface RestLike {
    request<T>(route: string, options?: RequestOptions): Promise<T>;
    requestWithResponse<T>(route: string, options?: RequestOptions): Promise<RestResponse<T>>;
    get<T>(route: string, options?: RequestOptions): Promise<T>;
    post<T>(route: string, body?: unknown, options?: RequestOptions): Promise<T>;
    put<T>(route: string, body?: unknown, options?: RequestOptions): Promise<T>;
    patch<T>(route: string, body?: unknown, options?: RequestOptions): Promise<T>;
    delete<T>(route: string, options?: RequestOptions): Promise<T>;
}

interface QueueItem {
    run: () => Promise<unknown>;
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
}

interface QueueState {
    items: QueueItem[];
    running: boolean;
}

interface RateLimitInfo {
    retryAfter: number;
    global: boolean;
    scope?: string;
    body?: unknown;
}

/** Small buffer added after every rate limit wait to avoid clock skew. */
const RATE_LIMIT_BUFFER = 50;

/**
 * Discord REST client with per-bucket queues, global rate limit handling,
 * retries with exponential backoff and typed errors.
 */
export class RestClient implements RestLike {
    private readonly baseUrl: string;
    private readonly userAgent: string;
    private readonly retries: number;
    private readonly timeout: number;
    private readonly fetchImpl: typeof fetch;
    private readonly now: () => number;
    private readonly sleep: (ms: number) => Promise<void>;
    private readonly random: () => number;

    private readonly buckets = new BucketManager();
    private readonly queues = new Map<string, QueueState>();
    private globalResetAt = 0;

    constructor(
        private readonly token: string,
        options: RestClientOptions = {}
    ) {
        this.baseUrl = (options.api ?? "https://discord.com/api/v10").replace(/\/+$/, "");
        this.userAgent = options.userAgent ?? "arx.js-discord/1.0.0";
        this.retries = options.retries ?? 3;
        this.timeout = options.timeout ?? 15_000;
        this.fetchImpl = options.fetch ?? fetch;
        this.now = options.now ?? (() => Date.now());
        this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
        this.random = options.random ?? Math.random;
    }

    /** Executes a request and returns the parsed body. */
    public request<T>(route: string, options: RequestOptions = {}): Promise<T> {
        return this.requestInternal<T>(route, options, false) as Promise<T>;
    }

    /** Executes a request and returns the body together with the raw response. */
    public requestWithResponse<T>(route: string, options: RequestOptions = {}): Promise<RestResponse<T>> {
        return this.requestInternal<T>(route, options, true) as Promise<RestResponse<T>>;
    }

    public get<T>(route: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "GET" });
    }

    public post<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "POST", body });
    }

    public put<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "PUT", body });
    }

    public patch<T>(route: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "PATCH", body });
    }

    public delete<T>(route: string, options: RequestOptions = {}): Promise<T> {
        return this.request<T>(route, { ...options, method: "DELETE" });
    }

    /** Forgets every learned bucket and rate limit window (mostly for tests). */
    public clearRateLimits(): void {
        this.buckets.clear();
        this.globalResetAt = 0;
    }

    private async requestInternal<T>(
        route: string,
        options: RequestOptions,
        withResponse: boolean
    ): Promise<T | RestResponse<T>> {
        const method = (options.method ?? "GET").toUpperCase();
        const localKey = buildBucketKey(method, route);

        // The queue key stays local on purpose: Discord may report a shared
        // remote bucket hash later, but merging in-flight queues is racy. The
        // shared state still lives under the remote hash (see BucketManager).
        return this.enqueue<T | RestResponse<T>>(localKey, () =>
            this.execute<T>(route, method, localKey, options, withResponse)
        );
    }

    private enqueue<T>(bucketKey: string, run: () => Promise<T>): Promise<T> {
        let queue = this.queues.get(bucketKey);
        if (!queue) {
            queue = { items: [], running: false };
            this.queues.set(bucketKey, queue);
        }

        return new Promise<T>((resolve, reject) => {
            queue!.items.push({
                run,
                resolve: resolve as (value: unknown) => void,
                reject,
            });
            void this.drain(bucketKey);
        });
    }

    private async drain(bucketKey: string): Promise<void> {
        const queue = this.queues.get(bucketKey);
        if (!queue || queue.running) return;

        queue.running = true;
        try {
            while (queue.items.length > 0) {
                const item = queue.items.shift()!;
                try {
                    item.resolve(await item.run());
                } catch (error) {
                    item.reject(error);
                }
            }
        } finally {
            queue.running = false;
            if (queue.items.length > 0) {
                void this.drain(bucketKey);
            }
        }
    }

    private async execute<T>(
        route: string,
        method: string,
        localKey: string,
        options: RequestOptions,
        withResponse: boolean
    ): Promise<T | RestResponse<T>> {
        const retries = Math.max(0, options.retries ?? this.retries);
        const timeout = options.timeout ?? this.timeout;
        let attempt = 0;

        for (;;) {
            await this.waitForGlobal();
            await this.waitForBucket(localKey);

            let response: Response;
            try {
                response = await this.fetchOnce(route, method, options, timeout);
            } catch (error) {
                if (options.signal?.aborted) throw error;

                if (attempt >= retries) {
                    if (error instanceof RequestTimeoutError) throw error;
                    throw new NetworkError(method, route, error);
                }

                attempt += 1;
                await this.sleep(this.backoff(attempt));
                continue;
            }

            this.updateBucket(localKey, response);

            if (response.status === 429) {
                const info = await this.readRateLimit(response);
                const waitMs = Math.max(0, info.retryAfter * 1000);

                if (info.global) {
                    this.globalResetAt = Math.max(this.globalResetAt, this.now() + waitMs);
                }
                this.blockBucket(localKey, info.retryAfter);

                if (attempt >= retries) {
                    throw new RateLimitError({
                        method,
                        route,
                        retryAfter: info.retryAfter,
                        global: info.global,
                        scope: info.scope,
                        body: info.body,
                    });
                }

                attempt += 1;
                await this.sleep(waitMs + RATE_LIMIT_BUFFER);
                this.releaseBucket(localKey);
                continue;
            }

            if (response.status >= 500) {
                if (attempt >= retries) {
                    throw await this.apiError(response, method, route);
                }

                attempt += 1;
                const retryAfter = headerNumber(response.headers, "retry-after");
                const waitMs = retryAfter !== undefined ? retryAfter * 1000 : this.backoff(attempt);
                await this.sleep(waitMs);
                continue;
            }

            if (!response.ok) {
                throw await this.apiError(response, method, route);
            }

            const rawResponse = withResponse ? response.clone() : undefined;
            const data = await this.parseBody<T>(response);
            if (withResponse) {
                return { data, response: rawResponse! };
            }
            return data;
        }
    }

    private async fetchOnce(
        route: string,
        method: string,
        options: RequestOptions,
        timeout: number
    ): Promise<Response> {
        const {
            body: rawBody,
            files,
            reason,
            retries: _retries,
            timeout: _timeout,
            signal: userSignal,
            auth,
            method: _method,
            headers: rawHeaders,
            ...init
        } = options;

        const url = route.startsWith("http")
            ? route
            : `${this.baseUrl}${route.startsWith("/") ? "" : "/"}${route}`;

        const headers = new Headers(rawHeaders);
        if (!headers.has("accept")) headers.set("accept", "application/json");
        if (!headers.has("user-agent")) headers.set("user-agent", this.userAgent);
        if (auth !== false && this.token) headers.set("authorization", `Bot ${this.token}`);
        if (reason) headers.set("x-audit-log-reason", encodeURIComponent(reason));

        const built = buildBody(rawBody, files);
        if (built.contentType) headers.set("content-type", built.contentType);

        const controller = new AbortController();
        let timedOut = false;
        const timer =
            timeout > 0
                ? setTimeout(() => {
                      timedOut = true;
                      controller.abort();
                  }, timeout)
                : undefined;

        const onUserAbort = () => controller.abort(userSignal?.reason);
        if (userSignal) {
            if (userSignal.aborted) {
                controller.abort(userSignal.reason);
            } else {
                userSignal.addEventListener("abort", onUserAbort, { once: true });
            }
        }

        try {
            return await this.fetchImpl(url, {
                ...init,
                method,
                headers,
                body: built.body,
                signal: controller.signal,
            });
        } catch (error) {
            if (timedOut) throw new RequestTimeoutError(timeout, route, method);
            throw error;
        } finally {
            if (timer) clearTimeout(timer);
            userSignal?.removeEventListener("abort", onUserAbort);
        }
    }

    private async parseBody<T>(response: Response): Promise<T> {
        if (response.status === 204) return undefined as T;

        const text = await response.text();
        if (text.length === 0) return undefined as T;

        try {
            return JSON.parse(text) as T;
        } catch {
            return text as T;
        }
    }

    private async apiError(response: Response, method: string, route: string): Promise<DiscordAPIError> {
        const body = await this.readBody(response);
        const record = isRecord(body) ? body : undefined;

        return new DiscordAPIError({
            status: response.status,
            method,
            route,
            body,
            code: typeof record?.code === "number" ? record.code : undefined,
            errors: record?.errors,
            message:
                typeof record?.message === "string"
                    ? record.message
                    : `Discord API responded with ${response.status} for ${method} ${route}`,
        });
    }

    private async readRateLimit(response: Response): Promise<RateLimitInfo> {
        const body = await this.readBody(response.clone());
        const record = isRecord(body) ? body : undefined;

        const retryAfter =
            numberOrUndefined(record?.retry_after) ??
            headerNumber(response.headers, "retry-after") ??
            headerNumber(response.headers, "x-ratelimit-reset-after") ??
            1;

        const scope = response.headers.get("x-ratelimit-scope") ?? undefined;
        const global =
            response.headers.get("x-ratelimit-global") === "true" ||
            scope === "global" ||
            record?.global === true;

        return {
            retryAfter: Math.max(0, retryAfter),
            global,
            scope,
            body,
        };
    }

    private async readBody(response: Response): Promise<unknown> {
        const text = await response.text();
        if (text.length === 0) return undefined;

        try {
            return JSON.parse(text) as unknown;
        } catch {
            return text;
        }
    }

    private updateBucket(localKey: string, response: Response): void {
        const hash = response.headers.get("x-ratelimit-bucket");
        const key = this.buckets.learn(localKey, hash);
        const state = this.buckets.get(key);

        const limit = headerNumber(response.headers, "x-ratelimit-limit");
        const remaining = headerNumber(response.headers, "x-ratelimit-remaining");
        const resetAfter = headerNumber(response.headers, "x-ratelimit-reset-after");
        const reset = headerNumber(response.headers, "x-ratelimit-reset");

        if (limit !== undefined) state.limit = limit;
        if (remaining !== undefined) state.remaining = remaining;
        if (resetAfter !== undefined) {
            state.resetAt = this.now() + resetAfter * 1000;
        } else if (reset !== undefined) {
            state.resetAt = reset * 1000;
        }
    }

    private blockBucket(localKey: string, retryAfter: number): void {
        const state = this.buckets.get(this.buckets.resolve(localKey));
        state.remaining = 0;
        state.resetAt = this.now() + retryAfter * 1000;
    }

    private releaseBucket(localKey: string): void {
        const state = this.buckets.get(this.buckets.resolve(localKey));
        state.remaining = Number.isFinite(state.limit) ? state.limit : Number.POSITIVE_INFINITY;
        state.resetAt = 0;
    }

    private async waitForBucket(localKey: string): Promise<void> {
        const state = this.buckets.get(this.buckets.resolve(localKey));
        const now = this.now();

        if (state.remaining <= 0 && state.resetAt > now) {
            await this.sleep(state.resetAt - now + RATE_LIMIT_BUFFER);
        }

        if (state.remaining <= 0 && state.resetAt <= this.now()) {
            state.remaining = Number.isFinite(state.limit) ? state.limit : Number.POSITIVE_INFINITY;
            state.resetAt = 0;
        }
    }

    private async waitForGlobal(): Promise<void> {
        const now = this.now();
        if (this.globalResetAt > now) {
            await this.sleep(this.globalResetAt - now + RATE_LIMIT_BUFFER);
            this.globalResetAt = 0;
        }
    }

    private backoff(attempt: number): number {
        const base = Math.min(30_000, 500 * 2 ** attempt);
        const jitter = 0.5 + this.random();
        return Math.round(base * jitter);
    }
}

function buildBody(
    body: unknown,
    files?: RestFile[]
): { body: BodyInit | undefined; contentType?: string } {
    if (files && files.length > 0) {
        const form = new FormData();
        form.append("payload_json", JSON.stringify(body ?? {}));

        files.forEach((file, index) => {
            const blob =
                file.data instanceof Blob
                    ? file.data
                    : new Blob([file.data], file.contentType ? { type: file.contentType } : undefined);

            form.append(
                `files[${index}]`,
                blob,
                file.filename ?? file.name ?? `file-${index}`
            );
        });

        return { body: form };
    }

    if (body === undefined) return { body: undefined };

    if (
        typeof body === "string" ||
        body instanceof Blob ||
        body instanceof FormData ||
        body instanceof URLSearchParams ||
        body instanceof ArrayBuffer ||
        ArrayBuffer.isView(body)
    ) {
        return { body: body as BodyInit };
    }

    return { body: JSON.stringify(body), contentType: "application/json" };
}

function headerNumber(headers: Headers, name: string): number | undefined {
    const raw = headers.get(name);
    if (raw === null || raw.length === 0) return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
