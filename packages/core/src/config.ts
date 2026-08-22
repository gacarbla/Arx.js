import { z } from "zod";
import { Config } from "./configBuilder";

declare module "./configBuilder/types" {
    interface ArxConfigRegistry {
        GENERAL: typeof GeneralSchema;
    }
}

const GeneralSchema = z.object({
    defaultLanguage: z.string().default("en-GB"),
    debug: z.boolean().optional().default(false),
});

export const coreConfig = Config.register({
    key: "GENERAL",
    schema: GeneralSchema,
});

export default coreConfig