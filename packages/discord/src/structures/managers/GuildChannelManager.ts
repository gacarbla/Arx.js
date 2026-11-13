import type { APIChannel } from "discord-api-types/v10";
import type { StructureClient } from "../Structure";
import { Channel } from "../Channel";

export class GuildChannelManager {
    constructor(
        private readonly client: StructureClient,
        private readonly guildId: string
    ) {}

    /** Channels that belong to this guild and are currently cached. */
    public get cache(): ReadonlyMap<string, Channel> {
        const result = new Map<string, Channel>();

        for (const raw of this.client.cache.channels.values()) {
            if ((raw as APIChannel & { guild_id?: string }).guild_id === this.guildId) {
                result.set(raw.id, new Channel(this.client, raw));
            }
        }

        return result;
    }

    public get(channelId: string): Channel | undefined {
        const raw = this.client.cache.channels.get(channelId);
        if (!raw) return undefined;
        if ((raw as APIChannel & { guild_id?: string }).guild_id !== this.guildId) return undefined;
        return new Channel(this.client, raw);
    }

    public async fetch(channelId: string): Promise<Channel> {
        const raw = await this.client.rest.get<APIChannel>(`/channels/${channelId}`);
        this.client.cache.channels.set(raw.id, raw);
        return new Channel(this.client, raw);
    }

    public async create(payload: Record<string, unknown>): Promise<Channel> {
        const raw = await this.client.rest.post<APIChannel>(
            `/guilds/${this.guildId}/channels`,
            payload
        );
        this.client.cache.channels.set(raw.id, raw);
        return new Channel(this.client, raw);
    }
}
