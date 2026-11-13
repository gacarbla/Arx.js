/** Identifies a Discord rate limit bucket. */
export interface BucketState {
    /** Requests allowed in the current window (Infinity until Discord says otherwise). */
    limit: number;
    /** Requests remaining in the current window. */
    remaining: number;
    /** Epoch milliseconds at which the window resets. */
    resetAt: number;
}

const MAJOR_PARAMS: Readonly<Record<string, string>> = {
    channels: "channel_id",
    guilds: "guild_id",
    webhooks: "webhook_id",
    interactions: "interaction_id",
};

const SNOWFLAKE = /^\d{10,25}$/;

/**
 * Builds a local bucket key from an HTTP method and a Discord route.
 *
 * Snowflakes are replaced with `:id` and major parameters are appended, so
 * `POST /channels/1/messages` cannot share a bucket with
 * `POST /channels/2/messages` unless Discord says otherwise.
 *
 * @example
 * ```ts
 * buildBucketKey("POST", "/channels/123456789012345678/messages");
 * // "POST:/channels/:id/messages|channel_id=123456789012345678"
 * ```
 */
export function buildBucketKey(method: string, route: string): string {
    const url = new URL(route, "https://discord.local");
    const pathname = url.pathname.replace(/^\/api\/v\d+/, "");
    const segments = pathname.split("/").filter(Boolean);
    const normalized: string[] = [];
    const major: string[] = [];

    for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index]!;
        const next = segments[index + 1];
        const majorName = MAJOR_PARAMS[segment];

        if (majorName && next && SNOWFLAKE.test(next)) {
            major.push(`${majorName}=${next}`);
            normalized.push(segment, ":id");
            index += 1;

            // Webhook tokens and interaction tokens are opaque values. Never
            // use them as part of a bucket key.
            if (segment === "webhooks" || segment === "interactions") {
                const token = segments[index + 1];
                if (token) {
                    normalized.push(":token");
                    index += 1;
                }
            }
            continue;
        }

        normalized.push(SNOWFLAKE.test(segment) ? ":id" : segment);
    }

    const suffix = major.length > 0 ? `|${major.join(",")}` : "";
    return `${method.toUpperCase()}:/${normalized.join("/")}${suffix}`;
}

/**
 * Tracks local and remote rate limit buckets.
 *
 * Discord may report a shared bucket hash through `X-RateLimit-Bucket`; when it
 * does, {@link BucketManager.learn} maps the local route to that remote hash so
 * subsequent requests share the same state.
 */
export class BucketManager {
    private readonly states = new Map<string, BucketState>();
    private readonly remoteKeys = new Map<string, string>();

    public resolve(localKey: string): string {
        return this.remoteKeys.get(localKey) ?? localKey;
    }

    public learn(localKey: string, remoteHash: string | null): string {
        if (remoteHash) {
            this.remoteKeys.set(localKey, remoteHash);
            return remoteHash;
        }
        return this.resolve(localKey);
    }

    public get(key: string): BucketState {
        let state = this.states.get(key);
        if (!state) {
            state = { limit: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY, resetAt: 0 };
            this.states.set(key, state);
        }
        return state;
    }

    public clear(): void {
        this.states.clear();
        this.remoteKeys.clear();
    }
}
