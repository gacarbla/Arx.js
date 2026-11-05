import type { APIMessage } from "discord-api-types/v10";
import type { RestFile } from "../../core/rest/RestClient";
import { messageKey } from "../../cache/updaters";
import type { StructureClient } from "../Structure";
import { Message } from "../Message";

export interface SendMessageOptions {
    files?: RestFile[];
}

function normalizePayload(payload: string | Record<string, unknown>): Record<string, unknown> {
    return typeof payload === "string" ? { content: payload } : payload;
}

export class MessageManager {
    constructor(
        private readonly client: StructureClient,
        private readonly channelId: string
    ) {}

    /** Cached messages for this channel. */
    public get cache(): ReadonlyMap<string, Message> {
        const result = new Map<string, Message>();

        for (const [key, raw] of this.client.cache.messages) {
            if (key.startsWith(`${this.channelId}:`)) {
                result.set(raw.id, new Message(this.client, raw));
            }
        }

        return result;
    }

    public get(messageId: string): Message | undefined {
        const raw = this.client.cache.messages.get(messageKey(this.channelId, messageId));
        return raw ? new Message(this.client, raw) : undefined;
    }

    public async fetch(messageId: string): Promise<Message> {
        const raw = await this.client.rest.get<APIMessage>(
            `/channels/${this.channelId}/messages/${messageId}`
        );
        this.client.cache.messages.set(messageKey(this.channelId, messageId), raw);
        return new Message(this.client, raw);
    }

    public async fetchMany(options: { limit?: number; before?: string; after?: string; around?: string } = {}): Promise<Message[]> {
        const query = new URLSearchParams();
        if (options.limit !== undefined) query.set("limit", String(options.limit));
        if (options.before) query.set("before", options.before);
        if (options.after) query.set("after", options.after);
        if (options.around) query.set("around", options.around);
        const queryString = query.toString();
        const suffix = queryString ? `?${queryString}` : "";

        const raw = await this.client.rest.get<APIMessage[]>(
            `/channels/${this.channelId}/messages${suffix}`
        );

        return raw.map((message) => {
            this.client.cache.messages.set(messageKey(this.channelId, message.id), message);
            return new Message(this.client, message);
        });
    }

    public async send(
        contentOrPayload: string | Record<string, unknown>,
        options: SendMessageOptions = {}
    ): Promise<Message> {
        const raw = await this.client.rest.post<APIMessage>(
            `/channels/${this.channelId}/messages`,
            normalizePayload(contentOrPayload),
            { files: options.files }
        );
        this.client.cache.messages.set(messageKey(this.channelId, raw.id), raw);
        return new Message(this.client, raw);
    }
}
