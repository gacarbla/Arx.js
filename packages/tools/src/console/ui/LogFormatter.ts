import util from "node:util";
import type { LogOptions } from "../types/logger";

export class LogFormatter {
    static formatArgs(args: unknown[]): string {
        return args
            .map((arg) => {
                if (typeof arg === "string") return arg;
                if (arg instanceof Error) return arg.stack || arg.message;
                return util.inspect(arg, {
                    colors: false, // Blessed manejará los colores con sus propias tags
                    depth: null,
                    compact: true,
                    breakLength: Infinity,
                });
            })
            .join(" ");
    }

    static applyTags(
        timestamp: string,
        level: string,
        color: string,
        message: string,
        options: LogOptions = {}
    ): string {
        const { colorizeLine = false, bold = false } = options;

        const boldOpen = bold ? "{bold}" : "";
        const boldClose = bold ? "{/bold}" : "";

        if (colorizeLine) {
            return `${boldOpen}{${color}-fg}${timestamp} [${level}] ${message}{/}${boldClose}`;
        }

        return `${boldOpen}${timestamp} {${color}-fg}[${level}]{/} ${message}${boldClose}`;
    }
}