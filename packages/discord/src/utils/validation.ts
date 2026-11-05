/** Shared, dependency-free validation helpers for builders. */

export function assertMaxLength(value: string, max: number, label: string): string {
    if (typeof value !== "string") {
        throw new TypeError(`${label} must be a string.`);
    }
    if (value.length > max) {
        throw new RangeError(`${label} must be at most ${max} characters (received ${value.length}).`);
    }
    return value;
}

export function assertMinLength(value: string, min: number, max: number, label: string): string {
    assertMaxLength(value, max, label);
    if (value.length < min) {
        throw new RangeError(`${label} must be at least ${min} characters (received ${value.length}).`);
    }
    return value;
}

export function assertRange(value: number, min: number, max: number, label: string): number {
    if (!Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number.`);
    }
    if (value < min || value > max) {
        throw new RangeError(`${label} must be between ${min} and ${max} (received ${value}).`);
    }
    return value;
}

export function assertInteger(value: number, label: string): number {
    if (!Number.isInteger(value)) {
        throw new TypeError(`${label} must be an integer.`);
    }
    return value;
}

/** Discord application command names: 1-32 chars, lowercase, no spaces. */
export function assertCommandName(value: string, label = "Command name", chatInput = true): string {
    if (chatInput) {
        if (!/^[-_\p{L}\p{N}]{1,32}$/u.test(value)) {
            throw new Error(
                `${label} "${value}" is invalid: it must be 1-32 characters, lowercase, without spaces.`
            );
        }
        if (value !== value.toLowerCase()) {
            throw new Error(`${label} "${value}" is invalid: Discord requires lowercase names.`);
        }
        return value;
    }

    if (typeof value !== "string" || value.length < 1 || value.length > 32) {
        throw new RangeError(`${label} must be between 1 and 32 characters.`);
    }
    return value;
}

/** Discord application command descriptions: 1-100 chars. */
export function assertCommandDescription(value: string, label = "Command description"): string {
    if (typeof value !== "string" || value.length < 1 || value.length > 100) {
        throw new RangeError(`${label} must be between 1 and 100 characters.`);
    }
    return value;
}

/** `custom_id` fields: 1-100 chars. */
export function assertCustomId(value: string, label = "custom_id"): string {
    if (typeof value !== "string" || value.length < 1 || value.length > 100) {
        throw new RangeError(`${label} must be between 1 and 100 characters.`);
    }
    return value;
}

export function assertUrl(value: string, label = "URL"): string {
    try {
        new URL(value);
    } catch {
        throw new TypeError(`${label} "${value}" is not a valid absolute URL.`);
    }
    return value;
}

/** Absolute URL or an `attachment://<filename>` reference. */
export function assertMediaUrl(value: string, label = "Media URL"): string {
    if (typeof value === "string" && value.startsWith("attachment://")) {
        return value;
    }
    return assertUrl(value, label);
}

export function assertCount<T>(values: readonly T[], min: number, max: number, label: string): readonly T[] {
    if (values.length < min || values.length > max) {
        throw new RangeError(`${label} must contain between ${min} and ${max} items (received ${values.length}).`);
    }
    return values;
}
