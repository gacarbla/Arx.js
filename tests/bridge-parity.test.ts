import { describe, expect, it } from "vitest";
import * as native from "@arx.js/discord";
import * as bridge from "@arx.js/discord.js";

const SHARED_EXPORTS = [
    "Command",
    "CommandRegistry",
    "CommandContext",
    "InteractionContext",
    "ComponentContext",
    "InteractionRouter",
    "CommandRunner",
    "CommandLoader",
    "EventLoader",
    "ComponentLoader",
    "I18n",
    "CacheStore",
    "LruTtlMap",
    "Permissions",
    "User",
    "Guild",
    "Channel",
    "Member",
    "Role",
    "Message",
    "NativeInteractionAdapter",
    "Structure",
] as const;

describe("bridge parity", () => {
    it("re-exports the same kit as the native package", () => {
        for (const name of SHARED_EXPORTS) {
            expect((bridge as any)[name], `missing ${name}`).toBeDefined();
            expect(typeof (bridge as any)[name], `type of ${name}`).toBe(
                typeof (native as any)[name]
            );
        }

        expect(bridge.Command).toBe(native.Command);
        expect(bridge.CommandRegistry).toBe(native.CommandRegistry);
        expect(bridge.InteractionRouter).toBe(native.InteractionRouter);
    });

    it("exposes the same client lifecycle as Bot", () => {
        const client = new bridge.Client({ token: "test-token" });

        try {
            for (const method of [
                "login",
                "start",
                "destroy",
                "loadCommands",
                "loadEvents",
                "loadComponents",
                "syncCommands",
            ]) {
                expect(typeof (client as any)[method], `missing ${method}`).toBe("function");
            }

            expect(client.commands).toBeInstanceOf(bridge.CommandRegistry);
            expect(client.router).toBeInstanceOf(bridge.InteractionRouter);
            expect(client.cache).toBeInstanceOf(bridge.CacheStore);
            expect(client.native).toBeDefined();
        } finally {
            client.destroy();
        }
    });
});
