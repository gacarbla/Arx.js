import type { InteractionRouter, ComponentHandler } from "../framework/InteractionRouter";
import { defaultLogger, type Logger } from "../framework/logger";
import { collectFiles, importModule, pickExport } from "./moduleLoader";

export interface ComponentModule {
    type: "button" | "select" | "modal";
    id: string;
    execute: ComponentHandler;
}

const COMPONENT_TYPES = new Set(["button", "select", "modal"]);

/** Loads component modules (`{ type, id, execute }`) into the router. */
export class ComponentLoader {
    constructor(
        private readonly router: InteractionRouter,
        private readonly logger: Logger = defaultLogger
    ) {}

    public async load(directory: string): Promise<number> {
        const files = await collectFiles(directory);
        let loaded = 0;

        for (const file of files) {
            try {
                const module = await importModule(file);
                const component = pickExport(module, ["component"]) as ComponentModule;

                if (
                    !component ||
                    !COMPONENT_TYPES.has(component.type) ||
                    typeof component.id !== "string" ||
                    typeof component.execute !== "function"
                ) {
                    this.logger.warn(`[ComponentLoader] ${file} does not export a valid component.`);
                    continue;
                }

                this.router.register(component.type, component.id, component.execute);
                loaded += 1;
            } catch (error) {
                this.logger.error(`[ComponentLoader] Failed to import ${file}:`, error);
            }
        }

        return loaded;
    }
}
