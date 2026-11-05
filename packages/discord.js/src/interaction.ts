import type {
    APIMessage,
} from "discord-api-types/v10";
import type { Interaction } from "discord.js";
import {
    BaseInteractionAdapter,
    Message,
    type AutocompleteChoice,
    type ContextClient,
    type DeferOptions,
    type ModalPayload,
    type ReplyPayload,
} from "@arx.js/discord";
import { toRawInteraction } from "./raw";

const EPHEMERAL_FLAG = 1 << 6;

/** Interaction adapter backed by a discord.js interaction. */
export class DiscordJsInteractionAdapter extends BaseInteractionAdapter {
    constructor(
        client: ContextClient,
        private readonly native: Interaction
    ) {
        super(client, toRawInteraction(native));
    }

    public async reply(payload: string | ReplyPayload): Promise<Message | null> {
        const message = await (this.native as any).reply(normalizePayload(payload));
        return message ? this.toMessage(message) : null;
    }

    public async defer(options: DeferOptions = {}): Promise<void> {
        await (this.native as any).deferReply({
            flags: options.ephemeral ? EPHEMERAL_FLAG : undefined,
        });
    }

    public async editReply(payload: string | ReplyPayload): Promise<Message> {
        const message = await (this.native as any).editReply(normalizePayload(payload));
        return this.toMessage(message);
    }

    public async followUp(payload: string | ReplyPayload): Promise<Message> {
        const message = await (this.native as any).followUp(normalizePayload(payload));
        return this.toMessage(message);
    }

    public async update(payload: ReplyPayload): Promise<Message | null> {
        const message = await (this.native as any).update(normalizePayload(payload));
        return message ? this.toMessage(message) : null;
    }

    public async showModal(modal: ModalPayload): Promise<void> {
        await (this.native as any).showModal(modal);
    }

    public async autocomplete(choices: AutocompleteChoice[]): Promise<void> {
        await (this.native as any).respond(choices);
    }

    private toMessage(message: any): Message {
        const raw = message.toJSON() as APIMessage;
        if (raw.channel_id) {
            this.client.cache.messages.set(`${raw.channel_id}:${raw.id}`, raw);
        }
        return new Message(this.client, raw);
    }
}

function normalizePayload(payload: string | ReplyPayload): Record<string, unknown> {
    const data: Record<string, unknown> =
        typeof payload === "string" ? { content: payload } : { ...payload };

    const ephemeral = data.ephemeral;
    delete data.ephemeral;

    if (ephemeral) {
        data.flags = (Number(data.flags ?? 0) | EPHEMERAL_FLAG) >>> 0;
    }

    return data;
}
