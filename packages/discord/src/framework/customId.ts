export interface DecodedCustomId {
    /** Original value received from Discord. */
    raw: string;
    /** Namespace (encoded) or the whole raw id. */
    namespace: string;
    action?: string;
    payload?: unknown;
    /** True when the value used the `arx:` codec. */
    encoded: boolean;
}

const TOKEN = /^[a-zA-Z0-9_-]{1,32}$/;
const MAX_CUSTOM_ID = 100;

/**
 * Encodes a structured custom id:
 * `arx:<namespace>:<action>:<base64url(JSON)>`.
 */
export function encodeCustomId(
    namespace: string,
    action?: string,
    payload?: unknown
): string {
    if (!TOKEN.test(namespace)) {
        throw new Error(`Invalid custom id namespace "${namespace}".`);
    }
    if (action !== undefined && !TOKEN.test(action)) {
        throw new Error(`Invalid custom id action "${action}".`);
    }

    const parts = ["arx", namespace];
    if (payload !== undefined) {
        parts.push(action ?? "");
        parts.push(Buffer.from(JSON.stringify(payload), "utf8").toString("base64url"));
    } else if (action) {
        parts.push(action);
    }

    const value = parts.join(":");
    if (value.length > MAX_CUSTOM_ID) {
        throw new RangeError(`custom_id must be at most ${MAX_CUSTOM_ID} characters (received ${value.length}).`);
    }
    return value;
}

/** Decodes a value produced by {@link encodeCustomId}. */
export function decodeCustomId(raw: string): DecodedCustomId {
    if (typeof raw !== "string" || !raw.startsWith("arx:")) {
        return { raw, namespace: raw, encoded: false };
    }

    const parts = raw.split(":");
    const namespace = parts[1] ?? "";
    const action = parts[2] || undefined;
    let payload: unknown;

    if (parts[3]) {
        try {
            payload = JSON.parse(Buffer.from(parts[3], "base64url").toString("utf8"));
        } catch {
            payload = undefined;
        }
    }

    return { raw, namespace, action, payload, encoded: true };
}

/** Key used by the component router. */
export function customIdRouteKey(decoded: DecodedCustomId): string {
    if (!decoded.encoded) return decoded.raw;
    return decoded.action ? `${decoded.namespace}:${decoded.action}` : decoded.namespace;
}
