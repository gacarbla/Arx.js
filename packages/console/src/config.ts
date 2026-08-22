import { z } from "zod";
import { Config } from "@arx.js/core";

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        CONSOLE: typeof ConsoleSchema;
    }
}

const ConsoleSchema = z.object({
    enabled: z.boolean().default(true),
    overrideGlobal: z.boolean().default(true)
});

export const coreConfig = Config.register({
    key: "CONSOLE",
    schema: ConsoleSchema,
});

export default coreConfig