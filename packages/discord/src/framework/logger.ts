export interface Logger {
    debug(message: string, ...args: unknown[]): void;
    info(message: string, ...args: unknown[]): void;
    warn(message: string, ...args: unknown[]): void;
    error(message: string, ...args: unknown[]): void;
}

/** Logger that discards every message. */
export const silentLogger: Logger = Object.freeze({
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
});

/** Logger backed by the global console. */
export function createConsoleLogger(prefix = ""): Logger {
    const tag = prefix ? `${prefix} ` : "";
    return {
        debug: (message, ...args) => console.debug(tag + message, ...args),
        info: (message, ...args) => console.info(tag + message, ...args),
        warn: (message, ...args) => console.warn(tag + message, ...args),
        error: (message, ...args) => console.error(tag + message, ...args),
    };
}

/** Default: warnings and errors go to the console, debug/info are silent. */
export const defaultLogger: Logger = Object.freeze({
    debug: (_message: string, ..._args: unknown[]) => undefined,
    info: (_message: string, ..._args: unknown[]) => undefined,
    warn: (message: string, ...args: unknown[]) => console.warn(message, ...args),
    error: (message: string, ...args: unknown[]) => console.error(message, ...args),
});
