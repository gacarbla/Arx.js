import { z } from "zod";
import type { ArxConfigRegistry } from "../registry";

export type GlobalArxConfig = {
    [K in keyof ArxConfigRegistry]: ArxConfigRegistry[K] extends z.ZodType
    ? z.infer<ArxConfigRegistry[K]>
    : never;
};

export interface ModuleConfigDefinition<T extends z.ZodType> {
    key: string;
    schema: T;
}

export type ConfigWatchCallback = (newConfig: GlobalArxConfig) => void;
export type ConfigErrorCallback = (error: Error) => void;

export interface LoadOptions {
    optional?: boolean;
    envPrefix?: string;
    strictRegistry?: boolean;
}

export interface ReactiveConfig<T> {
    readonly current: T;
    onChange(callback: (newConfig: T) => void): () => void;
}