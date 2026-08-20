import { z } from "zod";
import { Config } from "./config";

declare module "./config/types" {
    interface ArxConfigRegistry {
        GENERAL: typeof GeneralSchema;
    }
}

const GeneralSchema = z.object({
    defaultLanguage: z.string().default("es-ES"),
    debug: z.boolean().optional().default(false),
});

Config.register({
    key: "GENERAL",
    schema: GeneralSchema,
});

export { Config };