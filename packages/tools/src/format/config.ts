import { Config } from "@arx.js/core";
import { z } from "zod";

export const FormatConfigSchema = z.object({
    dates: z
        .object({
            shortDate: z
                .enum([
                    "{D}/{M}",
                    "{M}/{D}",
                    "{DD}/{MM}",
                    "{MM}/{DD}"
                ])
                .default("{DD}/{MM}"),
            longDate: z
                .enum([
                    "{D}/{M}/{YY}",
                    "{M}/{D}/{YY}",
                    "{D}/{M}/{YYYY}",
                    "{M}/{D}/{YYYY}",
                    "{DD}/{MM}/{YY}",
                    "{MM}/{DD}/{YY}",
                    "{DD}/{MM}/{YYYY}",
                    "{MM}/{DD}/{YYYY}",
                ])
                .default("{DD}/{MM}/{YY}"),

            time: z
                .enum([
                    "{hh}:{mm}",
                    "{h}:{m}",
                    "{hh}:{mm}:{ss}",
                    "{h}:{m}:{s}"
                ])
                .default("{hh}:{mm}:{ss}"),

            week: z
                .object({
                    monday: z.string().default("monday"),
                    tuesday: z.string().default("tuesday"),
                    wednesday: z.string().default("wednesday"),
                    thursday: z.string().default("thursday"),
                    friday: z.string().default("friday"),
                    saturday: z.string().default("saturday"),
                    sunday: z.string().default("sunday"),
                    startsAt: z.enum(["monday", "sunday"]).default("monday")
                })
                .prefault({}),
        })
        .prefault({}),
    numbers: z
        .object({
            currencySymbol: z.string().default("$"),
            decimals: z.number().default(2),
            lang: z.enum(["es", "en"]).default("en")
        })
        .prefault({})
});

export type FormatConfig = z.infer<typeof FormatConfigSchema>;

declare module "@arx.js/core" {
    interface ArxConfigRegistry {
        "TOOLS/FORMAT": typeof FormatConfigSchema;
    }
}

export const config = Config.register({
    key: "TOOLS/FORMAT",
    schema: FormatConfigSchema,
});

export default config;