import parseIni from "ini";
import { readFileSync } from "fs";
import { z } from "zod";
import type { ModuleConfigDefinition, GlobalArxConfig } from "./types";

export class Config {
    private static registry = new Map<string, z.ZodType>();

    public static register<T extends z.ZodType>(definition: ModuleConfigDefinition<T>) {
        this.registry.set(definition.key.toUpperCase(), definition.schema);
    }

    public static async load(filePath: string): Promise<GlobalArxConfig> {
        const rawContent = readFileSync(filePath, "utf-8");
        const parsedData = parseIni.parse(rawContent);

        const validatedConfig: Record<string, any> = {};

        for (const [key, schema] of this.registry.entries()) {
            const rawSection = this.extractSection(parsedData, key);
            const result = schema.safeParse(rawSection ?? {});
            if (!result.success) {
                throw new Error(
                    `[Config Error] Fallo de validación en la sección [${key}]:\n` +
                    JSON.stringify(result.error.format(), null, 2)
                );
            }
            this.assignNested(validatedConfig, key, result.data);
        }
        return validatedConfig as GlobalArxConfig;
    }

    private static extractSection(data: any, keyPath: string): any {
        return keyPath.split("/").reduce((acc, part) => acc?.[part], data);
    }

    private static assignNested(target: Record<string, any>, keyPath: string, value: any): void {
        const parts = keyPath.split("/");
        const lastKey = parts.pop();
        if (!lastKey) return;
        let current = target;
        for (const part of parts) {
            if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
                current[part] = {};
            }
            current = current[part];
        }
        current[lastKey] = value;
    }
}