import { describe, expect, it } from "vitest";
import { Command, CommandContext, CommandRunner } from "@arx.js/discord";

describe("CommandRunner", () => {
    it("routes through the raw payload but hands a CommandContext to handlers", async () => {
        const adapter = {
            raw: {
                data: {
                    options: [
                        {
                            type: 2,
                            name: "admin",
                            options: [{ type: 1, name: "set", options: [] }],
                        },
                    ],
                },
            },
        } as any;

        let received: unknown;
        const command = new Command({ name: "config", description: "Config" }).addCategory((group) =>
            group
                .setName("admin")
                .setDescription("Admin")
                .addSubcommand((sub) =>
                    sub
                        .setName("set")
                        .setDescription("Set")
                        .setExecution(async (ctx) => {
                            received = ctx;
                        })
                )
        );

        await CommandRunner.execute(command, adapter as any, {} as any);

        expect(received).toBeInstanceOf(CommandContext);
        const ctx = received as CommandContext;
        expect(ctx.interaction).toBe(adapter);
        expect(ctx.command.data.name).toBe("config");
        expect(ctx.groupName).toBe("admin");
        expect(ctx.subcommandName).toBe("set");
    });
});
