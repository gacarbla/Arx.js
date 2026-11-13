/** Error thrown when Discord responds with a non-2xx status. */
export class DiscordAPIError extends Error {
    public readonly status: number;
    public readonly code?: number;
    public readonly errors?: unknown;
    public readonly method: string;
    public readonly route: string;
    public readonly body?: unknown;

    constructor(options: {
        status: number;
        method: string;
        route: string;
        body?: unknown;
        message?: string;
        code?: number;
        errors?: unknown;
    }) {
        const message =
            options.message ??
            (options.status
                ? `Discord API responded with ${options.status} for ${options.method} ${options.route}`
                : "Discord API request failed");

        super(message);
        this.name = "DiscordAPIError";
        this.status = options.status;
        this.code = options.code;
        this.errors = options.errors;
        this.method = options.method;
        this.route = options.route;
        this.body = options.body;
    }

    public toJSON(): Record<string, unknown> {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            code: this.code,
            errors: this.errors,
            method: this.method,
            route: this.route,
            body: this.body,
        };
    }
}

/** Error thrown when a 429 exhausted the configured retries. */
export class RateLimitError extends DiscordAPIError {
    /** Seconds requested by Discord. */
    public readonly retryAfter: number;
    public readonly global: boolean;
    public readonly scope?: string;

    constructor(options: {
        method: string;
        route: string;
        retryAfter: number;
        global: boolean;
        scope?: string;
        body?: unknown;
        message?: string;
    }) {
        super({
            status: 429,
            method: options.method,
            route: options.route,
            body: options.body,
            message:
                options.message ??
                `Rate limit exhausted for ${options.method} ${options.route} (retry after ${options.retryAfter}s)`,
            code: (options.body as { code?: number } | undefined)?.code,
            errors: (options.body as { errors?: unknown } | undefined)?.errors,
        });
        this.name = "RateLimitError";
        this.retryAfter = options.retryAfter;
        this.global = options.global;
        this.scope = options.scope;
    }
}

/** Error thrown when the configured request timeout elapses. */
export class RequestTimeoutError extends Error {
    public readonly timeout: number;

    constructor(timeout: number, route: string, method: string) {
        super(`${method} ${route} timed out after ${timeout} ms`);
        this.name = "RequestTimeoutError";
        this.timeout = timeout;
    }
}

/** Error thrown when the network request fails before receiving a response. */
export class NetworkError extends Error {
    public readonly method: string;
    public readonly route: string;

    constructor(method: string, route: string, cause: unknown) {
        super(`${method} ${route} failed: ${cause instanceof Error ? cause.message : String(cause)}`, {
            cause,
        });
        this.name = "NetworkError";
        this.method = method;
        this.route = route;
    }
}
