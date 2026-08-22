import parseIni from "ini";
import { readFileSync, existsSync, watch as fsWatch, FSWatcher } from "fs";
import { readFile } from "fs/promises";
import { z } from "zod";
import type {
    ModuleConfigDefinition,
    GlobalArxConfig,
    ArxConfigRegistry,
    ConfigWatchCallback,
    ConfigErrorCallback,
    LoadOptions,
    ReactiveConfig
} from "./types";

// TODO: Comentar correctamente el funcionamiento y utilidad de cada método y función

export class Config {
    private static registry = new Map<string, z.ZodType>();
    private static instance: GlobalArxConfig | null = null;
    private static activeWatcher: FSWatcher | null = null;
    private static watchListeners = new Set<ConfigWatchCallback>();
    private static errorListeners = new Set<ConfigErrorCallback>();

    public static register<T extends z.ZodType>(
        definition: ModuleConfigDefinition<T>
    ): ReactiveConfig<z.infer<T>> {
        const keyUpper = definition.key.toUpperCase();
        this.registry.set(keyUpper, definition.schema);

        return {
            get current(): z.infer<T> {
                if (Config.instance) {
                    return Config.extractSection(Config.instance, keyUpper);
                }
                return definition.schema.parse({});
            },
            onChange(callback: (newConfig: z.infer<T>) => void): () => void {
                return Config.onUpdate(() => {
                    if (Config.instance) {
                        callback(Config.extractSection(Config.instance, keyUpper));
                    }
                });
            }
        };
    }

    public static get(): GlobalArxConfig;
    public static get<K extends keyof ArxConfigRegistry>(section: K): z.infer<ArxConfigRegistry[K]>;
    public static get<K extends keyof ArxConfigRegistry>(section?: K): any {
        if (!this.instance) {
            throw new Error("[Config Error] Se intentó acceder a la configuración antes de ejecutar Config.load().");
        }
        if (section) {
            return this.extractSection(this.instance, (section as string).toUpperCase());
        }
        return this.instance;
    }

    public static async load(filePath: string, options: LoadOptions = {}): Promise<GlobalArxConfig> {
        const exists = existsSync(filePath);

        if (!exists) {
            if (options.optional) {
                this.instance = this.processParsedData({}, options);
                return this.instance;
            }
            throw new Error(`[Config Error] El archivo no existe en la ruta: ${filePath}`);
        }

        const rawContent = await readFile(filePath, "utf-8");
        const parsedData = parseIni.parse(rawContent);

        this.instance = this.processParsedData(parsedData, options);
        return this.instance;
    }

    public static loadSync(filePath: string, options: LoadOptions = {}): GlobalArxConfig {
        const exists = existsSync(filePath);

        if (!exists) {
            if (options.optional) {
                this.instance = this.processParsedData({}, options);
                return this.instance;
            }
            throw new Error(`[Config Error] El archivo no existe en la ruta: ${filePath}`);
        }

        const rawContent = readFileSync(filePath, "utf-8");
        const parsedData = parseIni.parse(rawContent);

        this.instance = this.processParsedData(parsedData, options);
        return this.instance;
    }

    public static async loadMany(filePaths: string[], options: LoadOptions = {}): Promise<GlobalArxConfig> {
        let mergedParsedData: Record<string, any> = {};

        for (const filePath of filePaths) {
            if (!existsSync(filePath)) {
                if (options.optional) continue;
                throw new Error(`[Config Error] El archivo no existe en la ruta: ${filePath}`);
            }
            const rawContent = await readFile(filePath, "utf-8");
            const parsed = parseIni.parse(rawContent);
            mergedParsedData = this.deepMerge(mergedParsedData, parsed);
        }

        this.instance = this.processParsedData(mergedParsedData, options);
        return this.instance;
    }

    public static watch(filePath: string, options: LoadOptions = {}): void {
        if (this.activeWatcher) {
            this.activeWatcher.close();
        }

        this.activeWatcher = fsWatch(filePath, async (eventType) => {
            if (eventType === "change") {
                try {
                    const updatedConfig = await this.load(filePath, options);
                    this.watchListeners.forEach((cb) => cb(updatedConfig));
                } catch (error) {
                    const err = error instanceof Error ? error : new Error(String(error));
                    this.errorListeners.forEach((cb) => cb(err));
                }
            }
        });
    }

    public static onUpdate(callback: ConfigWatchCallback): () => void {
        this.watchListeners.add(callback);
        return () => this.watchListeners.delete(callback);
    }

    public static onError(callback: ConfigErrorCallback): () => void {
        this.errorListeners.add(callback);
        return () => this.errorListeners.delete(callback);
    }

    public static exportActiveConfig(): Record<string, any> {
        if (!this.instance) return {};
        return JSON.parse(JSON.stringify(this.instance));
    }

    public static getRegisteredKeys(): string[] {
        return Array.from(this.registry.keys());
    }

    public static reset(): void {
        if (this.activeWatcher) {
            this.activeWatcher.close();
            this.activeWatcher = null;
        }
        this.instance = null;
        this.registry.clear();
        this.watchListeners.clear();
        this.errorListeners.clear();
    }

    private static processParsedData(parsedData: any, options: LoadOptions): GlobalArxConfig {
        if (options.envPrefix) {
            this.applyEnvOverrides(parsedData, options.envPrefix);
        }

        if (options.strictRegistry) {
            this.checkUnregisteredSections(parsedData);
        }

        const validatedConfig: Record<string, any> = {};

        for (const [key, schema] of this.registry.entries()) {
            const rawSection = this.extractSection(parsedData, key);
            const result = schema.safeParse(rawSection ?? {});

            if (!result.success) {
                const formattedError = JSON.stringify(result.error.format(), null, 2);
                const error = new Error(`[Config Error] Fallo de validación en la sección [${key}]:\n${formattedError}`);
                this.errorListeners.forEach((cb) => cb(error));
                throw error;
            }

            this.assignNested(validatedConfig, key, result.data);
        }

        return validatedConfig as GlobalArxConfig;
    }

    private static applyEnvOverrides(parsedData: any, prefix: string): void {
        const normalizedPrefix = prefix.endsWith("_") ? prefix : `${prefix}_`;

        for (const [envKey, envVal] of Object.entries(process.env)) {
            if (!envKey.startsWith(normalizedPrefix) || !envVal) continue;

            const pathParts = envKey
                .slice(normalizedPrefix.length)
                .split("__")
                .map((p) => p.toUpperCase());

            if (pathParts.length < 2) continue;

            const propertyKey = pathParts.pop()!.toLowerCase();
            const sectionKey = pathParts.join("/");

            let targetSection = this.extractSection(parsedData, sectionKey);
            if (!targetSection || typeof targetSection !== "object") {
                targetSection = {};
                this.assignNested(parsedData, sectionKey, targetSection);
            }

            targetSection[propertyKey] = this.parsePrimitive(envVal);
        }
    }

    private static checkUnregisteredSections(parsedData: any, currentPath = ""): void {
        if (!parsedData || typeof parsedData !== "object") return;

        for (const key of Object.keys(parsedData)) {
            const fullPath = currentPath ? `${currentPath}/${key.toUpperCase()}` : key.toUpperCase();

            if (!Array.from(this.registry.keys()).some((regKey) => regKey.startsWith(fullPath))) {
                console.warn(`[Config Warning] Se encontró la sección unassigned [${fullPath}] sin esquema registrado.`);
            }
        }
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

    private static deepMerge(target: Record<string, any>, source: Record<string, any>): Record<string, any> {
        const output = { ...target };
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === "object" &&
                !Array.isArray(source[key]) &&
                key in target &&
                typeof target[key] === "object"
            ) {
                output[key] = this.deepMerge(target[key], source[key]);
            } else {
                output[key] = source[key];
            }
        }
        return output;
    }

    private static parsePrimitive(value: string): any {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
        if (!isNaN(Number(value))) return Number(value);
        return value;
    }
}