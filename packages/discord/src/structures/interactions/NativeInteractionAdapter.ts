import type { APIMessage } from "discord-api-types/v10";
import { BaseInteractionAdapter } from "./BaseInteractionAdapter";
import { Message } from "../Message";
import { messageKey } from "../../cache/updaters";
import type {
    AutocompleteChoice,
    DeferOptions,
    ModalPayload,
    ReplyPayload,
} from "./InteractionAdapter";

interface InteractionCallbackResponse {
    resource?: {
        type?: number;
        message?: APIMessage;
    };
}

const InteractionCallbackType = {
    ChannelMessageWithSource: 4,
    DeferredChannelMessageWithSource: 5,
    DeferredUpdateMessage: 6,
    UpdateMessage: 7,
    ApplicationCommandAutocompleteResult: 8,
    Modal: 9,
} as const;

const EPHEMERAL_FLAG = 1 << 6;

/** Interaction adapter backed by the native REST client. */
export class NativeInteractionAdapter extends BaseInteractionAdapter {
    public async reply(payload: string | ReplyPayload): Promise<Message | null> {
        const data = normalizePayload(payload);
        const response = await this.client.rest.requestWithResponse<InteractionCallbackResponse>(
            `/interactions/${this.id}/${this.token}/callback?with_response=true`,
            {
                method: "POST",
                auth: false,
                body: { type: InteractionCallbackType.ChannelMessageWithSource, data },
            }
        );

        return response.data.resource?.message
            ? this.toMessage(response.data.resource.message)
            : null;
    }

    public async defer(options: DeferOptions = {}): Promise<void> {
        await this.client.rest.post(
            `/interactions/${this.id}/${this.token}/callback`,
            {
                type: InteractionCallbackType.DeferredChannelMessageWithSource,
                data: options.ephemeral ? { flags: EPHEMERAL_FLAG } : {},
            },
            { auth: false }
        );
    }

    public async editReply(payload: string | ReplyPayload): Promise<Message> {
        const applicationId = this.requireApplicationId();
        const raw = await this.client.rest.patch<APIMessage>(
            `/webhooks/${applicationId}/${this.token}/messages/@original`,
            normalizePayload(payload)
        );
        return this.toMessage(raw);
    }

    public async followUp(payload: string | ReplyPayload): Promise<Message> {
        const applicationId = this.requireApplicationId();
        const raw = await this.client.rest.post<APIMessage>(
            `/webhooks/${applicationId}/${this.token}`,
            normalizePayload(payload)
        );
        return this.toMessage(raw);
    }

    public async update(payload: ReplyPayload): Promise<Message | null> {
        const response = await this.client.rest.requestWithResponse<InteractionCallbackResponse>(
            `/interactions/${this.id}/${this.token}/callback?with_response=true`,
            {
                method: "POST",
                auth: false,
                body: { type: InteractionCallbackType.UpdateMessage, data: normalizePayload(payload) },
            }
        );

        return response.data.resource?.message
            ? this.toMessage(response.data.resource.message)
            : null;
    }

    public async showModal(modal: ModalPayload): Promise<void> {
        await this.client.rest.post(
            `/interactions/${this.id}/${this.token}/callback`,
            {
                type: InteractionCallbackType.Modal,
                data: modal,
            },
            { auth: false }
        );
    }

    public async autocomplete(choices: AutocompleteChoice[]): Promise<void> {
        await this.client.rest.post(
            `/interactions/${this.id}/${this.token}/callback`,
            {
                type: InteractionCallbackType.ApplicationCommandAutocompleteResult,
                data: { choices },
            },
            { auth: false }
        );
    }

    private toMessage(raw: APIMessage): Message {
        if (raw.channel_id) {
            this.client.cache.messages.set(messageKey(raw.channel_id, raw.id), raw);
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
