import { Command } from "./Command";
import type { MiddlewareFn, ExecutionFn } from "./Subcommand";
import { parseInteractionOptions } from "../framework/parseOptions";
import { CommandContext } from "../framework/CommandContext";
import type { ContextClient } from "../framework/InteractionContext";
import type { InteractionAdapter } from "../structures/interactions/InteractionAdapter";

export class CommandRunner {
    public static async execute(
        cmd: Command<any>,
        interaction: InteractionAdapter,
        client: ContextClient
    ): Promise<void> {
        const raw = interaction.raw as any;
        const parsed = parseInteractionOptions(raw);

        const category = parsed.group ? cmd.categories.get(parsed.group) : undefined;
        const subcommand = parsed.subcommand
            ? category
                ? category.subcommands.get(parsed.subcommand)
                : cmd.subcommands.get(parsed.subcommand)
            : undefined;

        const target = subcommand ?? cmd;
        const ctx = new CommandContext(client, interaction, parsed, {
            command: cmd,
            category,
            subcommand,
        });

        if (interaction.type === 4) {
            if (target.autocomplete) {
                await target.autocomplete(ctx);
            }
            return;
        }

        const deferMode = target.deferMode ?? cmd.deferMode;
        if (deferMode) {
            await ctx.defer({ ephemeral: deferMode === "ephemeral" });
        }

        const middlewareQueue: MiddlewareFn[] = [
            ...cmd.middlewares,
            ...(category?.middlewares ?? []),
            ...(subcommand?.middlewares ?? []),
        ];

        const execution: ExecutionFn | undefined = target.execution;
        if (!execution) {
            client.logger?.warn(`[CommandRunner] No execution handler for /${cmd.data.name}`);
            return;
        }

        let index = -1;
        const dispatch = async (i: number): Promise<void> => {
            if (i <= index) throw new Error("next() called multiple times");
            index = i;

            if (i === middlewareQueue.length) {
                await execution(ctx, client);
                return;
            }

            const middleware = middlewareQueue[i]!;
            const result = await middleware(ctx, () => dispatch(i + 1));
            if (result === false) return;
        };

        try {
            await dispatch(0);
        } catch (error) {
            const payload = {
                content: "An error occurred while executing this command.",
                ephemeral: true,
            };

            try {
                if (ctx.isDeferred) await ctx.editReply(payload);
                else if (!ctx.isReplied) await ctx.reply(payload);
            } catch {
                // The interaction may already be gone; preserve the original error.
            }

            throw error;
        }
    }
}
