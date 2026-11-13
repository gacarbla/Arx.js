import type { InteractionAdapter } from "../structures/interactions/InteractionAdapter";
import { ComponentContext } from "./ComponentContext";
import { customIdRouteKey, decodeCustomId } from "./customId";
import { parseModalFields } from "./parseFields";
import type { ContextClient } from "./InteractionContext";

export type ComponentHandler = (ctx: ComponentContext) => void | Promise<void>;

type HandlerKind = "button" | "select" | "modal";

/**
 * Routes message components and modal submissions by `custom_id`.
 *
 * Encoded ids (`arx:namespace:action:payload`) are matched by
 * `namespace:action`; raw ids are matched verbatim. The router falls back to
 * the exact custom id and then to the namespace.
 */
export class InteractionRouter {
    private readonly handlers: Record<HandlerKind, Map<string, ComponentHandler>> = {
        button: new Map(),
        select: new Map(),
        modal: new Map(),
    };

    public button(id: string, handler: ComponentHandler): this {
        return this.register("button", id, handler);
    }

    public select(id: string, handler: ComponentHandler): this {
        return this.register("select", id, handler);
    }

    public modal(id: string, handler: ComponentHandler): this {
        return this.register("modal", id, handler);
    }

    public register(kind: HandlerKind, id: string, handler: ComponentHandler): this {
        this.handlers[kind].set(id, handler);
        return this;
    }

    public unregister(kind: HandlerKind, id: string): boolean {
        return this.handlers[kind].delete(id);
    }

    public clear(): void {
        this.handlers.button.clear();
        this.handlers.select.clear();
        this.handlers.modal.clear();
    }

    /**
     * Routes an interaction.
     *
     * @returns `true` when a handler ran, `false` when the interaction is not a
     * component or has no registered handler.
     */
    public async route(interaction: InteractionAdapter, client: ContextClient): Promise<boolean> {
        const raw = interaction.raw as any;
        const customId = raw.data?.custom_id;
        if (typeof customId !== "string") return false;

        let kind: HandlerKind | null = null;

        if (interaction.type === 3) {
            const componentType = raw.data?.component_type;
            if (componentType === 2) kind = "button";
            else if (componentType >= 3 && componentType <= 8) kind = "select";
        } else if (interaction.type === 5) {
            kind = "modal";
        }

        if (!kind) return false;

        const decoded = decodeCustomId(customId);
        const routeKey = customIdRouteKey(decoded);
        const handler =
            this.handlers[kind].get(routeKey) ??
            this.handlers[kind].get(customId) ??
            this.handlers[kind].get(decoded.namespace);

        if (!handler) return false;

        const values = Array.isArray(raw.data?.values) ? raw.data.values : [];
        const fields = kind === "modal" ? parseModalFields(raw.data?.components) : {};
        const ctx = new ComponentContext(client, interaction, decoded, values, fields);

        await handler(ctx);
        return true;
    }
}
