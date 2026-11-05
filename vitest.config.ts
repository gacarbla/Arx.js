import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            // Longest specifier first: `@arx.js/discord` is a prefix of the bridge.
            {
                find: /^@arx\.js\/discord\.js$/,
                replacement: fromRoot("./packages/discord.js/src/index.ts"),
            },
            {
                find: /^@arx\.js\/discord$/,
                replacement: fromRoot("./packages/discord/src/index.ts"),
            },
            {
                find: /^@arx\.js\/console$/,
                replacement: fromRoot("./packages/console/src/index.ts"),
            },
            {
                find: /^@arx\.js\/tools$/,
                replacement: fromRoot("./packages/tools/src/index.ts"),
            },
            {
                find: /^@arx\.js\/core$/,
                replacement: fromRoot("./packages/core/src/index.ts"),
            },
        ],
    },
    test: {
        environment: "node",
        include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    },
});
