import type { APIChannel, APIInvite, APIMessage } from "discord-api-types/v10";
import { Structure, type StructureClient } from "./Structure";
import { MessageManager, type SendMessageOptions } from "./managers/MessageManager";
import { Message } from "./Message";
import { Guild } from "./Guild";

type AnyChannel = APIChannel & {
    guild_id?: string;
    name?: string;
    topic?: string | null;
    parent_id?: string | null;
    nsfw?: boolean;
    position?: number;
};

export class Channel extends Structure<APIChannel> {
    public readonly messages: MessageManager;

    constructor(client: StructureClient, raw: APIChannel) {
        super(client, raw);
        this.messages = new MessageManager(client, raw.id);
    }

    private get data(): AnyChannel {
        return this.raw as AnyChannel;
    }

    public get id(): string {
        return this.raw.id;
    }

    public get type(): number {
        return this.raw.type;
    }

    public get name(): string | null {
        return this.data.name ?? null;
    }

    public get guildId(): string | null {
        return this.data.guild_id ?? null;
    }

    public get parentId(): string | null {
        return this.data.parent_id ?? null;
    }

    public get topic(): string | null {
        return this.data.topic ?? null;
    }

    public get nsfw(): boolean {
        return Boolean(this.data.nsfw);
    }

    public get position(): number {
        return this.data.position ?? 0;
    }

    public get guild(): Guild | null {
        if (!this.guildId) return null;
        const raw = this.client.cache.guilds.get(this.guildId);
        return raw ? new Guild(this.client, raw) : null;
    }

    public get mention(): string {
        return `<#${this.id}>`;
    }

    public isTextBased(): boolean {
        return [0, 5, 10, 11, 12, 15].includes(this.type);
    }

    public isVoice(): boolean {
        return this.type === 2 || this.type === 13;
    }

    public isThread(): boolean {
        return this.type === 10 || this.type === 11 || this.type === 12;
    }

    public isDM(): boolean {
        return this.type === 1 || this.type === 3;
    }

    public async send(
        contentOrPayload: string | Record<string, unknown>,
        options: SendMessageOptions = {}
    ): Promise<Message> {
        return this.messages.send(contentOrPayload, options);
    }

    public async fetchMessage(messageId: string): Promise<Message> {
        return this.messages.fetch(messageId);
    }

    public async fetchMessages(options: Parameters<MessageManager["fetchMany"]>[0] = {}): Promise<Message[]> {
        return this.messages.fetchMany(options);
    }

    public async edit(payload: Record<string, unknown>, reason?: string): Promise<Channel> {
        const raw = await this.client.rest.patch<APIChannel>(
            `/channels/${this.id}`,
            payload,
            { reason }
        );
        this.raw = raw;
        this.client.cache.channels.set(raw.id, raw);
        return this;
    }

    public async setTopic(topic: string | null, reason?: string): Promise<Channel> {
        return this.edit({ topic }, reason);
    }

    public async delete(reason?: string): Promise<void> {
        await this.client.rest.delete(`/channels/${this.id}`, { reason });
        this.client.cache.channels.delete(this.id);
    }

    public async createInvite(payload: Record<string, unknown> = {}, reason?: string): Promise<APIInvite> {
        return this.client.rest.post<APIInvite>(
            `/channels/${this.id}/invites`,
            payload,
            { reason }
        );
    }

    public toString(): string {
        return this.name ? `${this.name} (${this.id})` : this.mention;
    }
}
