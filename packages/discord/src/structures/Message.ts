import type { APIChannel, APIMessage } from "discord-api-types/v10";
import { Structure } from "./Structure";
import { Channel } from "./Channel";
import { User } from "./User";
import { Member } from "./Member";
import { messageKey } from "../cache/updaters";
import type { SendMessageOptions } from "./managers/MessageManager";

function normalizePayload(payload: string | Record<string, unknown>): Record<string, unknown> {
    return typeof payload === "string" ? { content: payload } : { ...payload };
}

export class Message extends Structure<APIMessage> {
    public get id(): string {
        return this.raw.id;
    }

    public get channelId(): string {
        return this.raw.channel_id;
    }

    public get guildId(): string | null {
        return (this.raw as APIMessage & { guild_id?: string }).guild_id ?? null;
    }

    public get content(): string {
        return this.raw.content;
    }

    public get author(): User {
        return new User(this.client, this.raw.author);
    }

    public get member(): Member | null {
        const raw = (this.raw as APIMessage & { member?: any }).member;
        if (!raw || !this.guildId) return null;
        return new Member(this.client, this.guildId, raw);
    }

    public get channel(): Channel {
        const cached = this.client.cache.channels.get(this.channelId);
        return new Channel(this.client, cached ?? ({ id: this.channelId, type: 0 } as APIChannel));
    }

    public get createdAt(): Date {
        return new Date(this.raw.timestamp);
    }

    public get editedAt(): Date | null {
        return this.raw.edited_timestamp ? new Date(this.raw.edited_timestamp) : null;
    }

    public get pinned(): boolean {
        return Boolean(this.raw.pinned);
    }

    public get tts(): boolean {
        return Boolean(this.raw.tts);
    }

    public get url(): string {
        const guild = this.guildId ?? "@me";
        return `https://discord.com/channels/${guild}/${this.channelId}/${this.id}`;
    }

    public async reply(
        contentOrPayload: string | Record<string, unknown>,
        options: SendMessageOptions = {}
    ): Promise<Message> {
        const payload = normalizePayload(contentOrPayload);
        payload.message_reference = {
            message_id: this.id,
            fail_if_not_exists: false,
        };
        return this.channel.send(payload, options);
    }

    public async edit(
        contentOrPayload: string | Record<string, unknown>,
        options: SendMessageOptions = {}
    ): Promise<Message> {
        const raw = await this.client.rest.patch<APIMessage>(
            `/channels/${this.channelId}/messages/${this.id}`,
            normalizePayload(contentOrPayload),
            { files: options.files }
        );
        this.raw = raw;
        this.client.cache.messages.set(messageKey(this.channelId, raw.id), raw);
        return this;
    }

    public async delete(reason?: string): Promise<void> {
        await this.client.rest.delete(`/channels/${this.channelId}/messages/${this.id}`, {
            reason,
        });
        this.client.cache.messages.delete(messageKey(this.channelId, this.id));
    }

    public async react(emoji: string): Promise<void> {
        await this.client.rest.put(
            `/channels/${this.channelId}/messages/${this.id}/reactions/${encodeURIComponent(emoji)}/@me`
        );
    }

    public async removeReaction(emoji: string, userId = "@me"): Promise<void> {
        await this.client.rest.delete(
            `/channels/${this.channelId}/messages/${this.id}/reactions/${encodeURIComponent(emoji)}/${userId}`
        );
    }

    public async pin(reason?: string): Promise<void> {
        await this.client.rest.put(
            `/channels/${this.channelId}/pins/${this.id}`,
            undefined,
            { reason }
        );
    }

    public async unpin(reason?: string): Promise<void> {
        await this.client.rest.delete(`/channels/${this.channelId}/pins/${this.id}`, { reason });
    }

    public async fetch(): Promise<Message> {
        const raw = await this.client.rest.get<APIMessage>(
            `/channels/${this.channelId}/messages/${this.id}`
        );
        this.raw = raw;
        this.client.cache.messages.set(messageKey(this.channelId, raw.id), raw);
        return this;
    }

    public toString(): string {
        return this.content || this.id;
    }
}
