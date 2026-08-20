import { z } from "zod";


export interface ArxConfigRegistry { }


export type GlobalArxConfig = {
    [K in keyof ArxConfigRegistry]: ArxConfigRegistry[K] extends z.ZodType
    ? z.infer<ArxConfigRegistry[K]>
    : never;
};

export interface ModuleConfigDefinition<T extends z.ZodType> {
    key: string;
    schema: T;
}