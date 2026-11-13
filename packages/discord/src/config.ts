import { z } from "zod";
import { Config } from "@arx.js/core";

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        DISCORD: typeof DiscordSchema;
    }
}

const DiscordSchema = z.object({
    arxconsole: z.boolean().default(false),
});

export const config = Config.register({
    key: "DISCORD",
    schema: DiscordSchema,
});

export default config;
