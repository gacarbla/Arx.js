import { Config } from "@arx.js/core";
import { z } from "zod";

const FilesSchema = z.object({});

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        "TOOLS/FILES": typeof FilesSchema;
    }
}

export const config = Config.register({
    key: "TOOLS/FILES",
    schema: FilesSchema,
});

export default config