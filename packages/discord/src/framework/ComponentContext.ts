import type { InteractionAdapter } from "../structures/interactions/InteractionAdapter";
import { InteractionContext, type ContextClient } from "./InteractionContext";
import type { DecodedCustomId } from "./customId";

/** Context passed to button, select and modal handlers. */
export class ComponentContext extends InteractionContext {
    public readonly customId: DecodedCustomId;
    public readonly values: readonly string[];
    public readonly fields: Record<string, unknown>;

    constructor(
        client: ContextClient,
        interaction: InteractionAdapter,
        customId: DecodedCustomId,
        values: readonly string[] = [],
        fields: Record<string, unknown> = {}
    ) {
        super(client, interaction);
        this.customId = customId;
        this.values = values;
        this.fields = fields;
    }

    public get namespace(): string {
        return this.customId.namespace;
    }

    public get action(): string | undefined {
        return this.customId.action;
    }

    public get payload(): unknown {
        return this.customId.payload;
    }

    public getField<T = unknown>(id: string): T | undefined {
        return this.fields[id] as T | undefined;
    }

    public getRequiredField<T = unknown>(id: string): T {
        if (!(id in this.fields)) {
            throw new Error(`Missing modal field "${id}".`);
        }
        return this.fields[id] as T;
    }
}
