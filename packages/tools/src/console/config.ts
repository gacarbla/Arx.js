import { Config } from "@arx.js/core";
import { z } from "zod";

export const ConsoleConfigSchema = z.object({
    language: z.enum(["es", "en", "gl", "pt"]).default("es"),
    theme: z.enum(["default", "dracula", "matrix", "nord"]).default("default"),
    timeFormat: z.enum(["{hh}:{mm}", "{hh}:{mm}:{ss}"]).default("{hh}:{mm}:{ss}"),
    dateFormat: z
        .enum([
            "none",
            "{D}/{M}",
            "{M}/{D}",
            "{DD}/{MM}",
            "{MM}/{DD}",
            "{D}/{M}/{YY}",
            "{M}/{D}/{YY}",
            "{D}/{M}/{YYYY}",
            "{M}/{D}/{YYYY}",
            "{DD}/{MM}/{YY}",
            "{MM}/{DD}/{YY}",
            "{DD}/{MM}/{YYYY}",
            "{MM}/{DD}/{YYYY}",
        ])
        .default("{DD}/{MM}"),

    logs: z
        .object({
            enabled: z.boolean().default(true),
            singleFile: z.boolean().default(false),
            separator: z.string().default("\n\n\n----- NEW SESSION -----\n"),
            allowedLevels: z
                .array(z.enum(["log", "error", "warn", "success", "input"]))
                .default(["log", "error", "warn", "success", "input"]),
        })
        .prefault({}),
    logFile: z
        .object({
            directory: z.string().default("./logs"),
            maxFiles: z.coerce.number().min(0).default(0),
            maxLines: z.coerce.number().min(0).default(0),
            splitAtLine: z.coerce.number().min(0).default(0),
            filenameTemplate: z.string().default("{YYYY}-{MM}-{DD}_{hh}-{mm}-{ss}.log"),
            keepFilename: z.boolean().default(true),
            keepFilepath: z.boolean().default(true)
        })
        .prefault({})
});

export type ConsoleConfig = z.infer<typeof ConsoleConfigSchema>;

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        "TOOLS/CONSOLE": typeof ConsoleConfigSchema;
    }
}

export const config = Config.register({
    key: "TOOLS/CONSOLE",
    schema: ConsoleConfigSchema,
});

export default config;