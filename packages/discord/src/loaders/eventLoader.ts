import { collectFiles, importModule, pickExport } from "./moduleLoader";
import { defaultLogger, type Logger } from "../framework/logger";

export interface EventModule {
    name: string;
    once?: boolean;
    execute: (...args: any[]) => unknown;
}

interface EventTarget {
    on(event: string, listener: (...args: any[]) => void): unknown;
    once?(event: string, listener: (...args: any[]) => void): unknown;
}

/** Loads event modules (`{ name, once?, execute }`) into a bot/client. */
export class EventLoader {
    constructor(
        private readonly target: EventTarget,
        private readonly logger: Logger = defaultLogger
    ) {}

    public async load(directory: string): Promise<number> {
        const files = await collectFiles(directory);
        let loaded = 0;

        for (const file of files) {
            try {
                const module = await importModule(file);
                const event = pickExport(module, ["event"]) as EventModule;

                if (!event || typeof event.name !== "string" || typeof event.execute !== "function") {
                    this.logger.warn(`[EventLoader] ${file} does not export a valid event.`);
                    continue;
                }

                if (event.once && this.target.once) {
                    this.target.once(event.name, event.execute);
                } else {
                    this.target.on(event.name, event.execute);
                }
                loaded += 1;
            } catch (error) {
                this.logger.error(`[EventLoader] Failed to import ${file}:`, error);
            }
        }

        return loaded;
    }
}
