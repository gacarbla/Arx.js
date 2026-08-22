import { Config } from "@arx.js/core";
import { z } from "zod";

const CacheSchema = z.object({});

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        "TOOLS/CACHE": typeof CacheSchema;
    }
}

export const config = Config.register({
    key: "TOOLS/CACHE",
    schema: CacheSchema,
});

export default config