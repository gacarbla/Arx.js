import type { APIGuild } from "discord-api-types/v10";
import { Structure, type StructureClient } from "./Structure";
import { GuildChannelManager } from "./managers/GuildChannelManager";
import { GuildMemberManager } from "./managers/GuildMemberManager";
import { GuildRoleManager } from "./managers/GuildRoleManager";
import { roleKey } from "../cache/updaters";

export interface GuildIconOptions {
    size?: number;
    format?: "png" | "jpg" | "webp" | "gif";
}

export class Guild extends Structure<APIGuild> {
    public readonly channels: GuildChannelManager;
    public readonly members: GuildMemberManager;
    public readonly roles: GuildRoleManager;

    constructor(client: StructureClient, raw: APIGuild) {
        super(client, raw);
        this.channels = new GuildChannelManager(client, raw.id);
        this.members = new GuildMemberManager(client, raw.id);
        this.roles = new GuildRoleManager(client, raw.id);

        for (const channel of (raw as APIGuild & { channels?: any[] }).channels ?? []) {
            if (channel?.id) this.client.cache.channels.set(channel.id, channel);
        }
        for (const role of (raw as APIGuild & { roles?: any[] }).roles ?? []) {
            if (role?.id) this.client.cache.roles.set(roleKey(raw.id, role.id), role);
        }
    }

    public get id(): string {
        return this.raw.id;
    }

    public get name(): string {
        return this.raw.name;
    }

    public get icon(): string | null {
        return this.raw.icon ?? null;
    }

    public get ownerId(): string {
        return this.raw.owner_id;
    }

    public get memberCount(): number {
        return (this.raw as APIGuild & { member_count?: number; approximate_member_count?: number }).member_count
            ?? (this.raw as APIGuild & { approximate_member_count?: number }).approximate_member_count
            ?? 0;
    }

    public get description(): string | null {
        return this.raw.description ?? null;
    }

    public get createdAt(): Date {
        return new Date(Number((BigInt(this.id) >> 22n) + 1420070400000n));
    }

    public iconURL(options: GuildIconOptions = {}): string | null {
        if (!this.icon) return null;
        const format = options.format ?? (this.icon.startsWith("a_") ? "gif" : "png");
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.${format}${size}`;
    }

    public async fetch(): Promise<Guild> {
        const raw = await this.client.rest.get<APIGuild>(`/guilds/${this.id}`);
        this.raw = raw;
        this.client.cache.guilds.set(raw.id, raw);
        return this;
    }

    public async edit(payload: Record<string, unknown>, reason?: string): Promise<Guild> {
        const raw = await this.client.rest.patch<APIGuild>(
            `/guilds/${this.id}`,
            payload,
            { reason }
        );
        this.raw = raw;
        this.client.cache.guilds.set(raw.id, raw);
        return this;
    }

    /** Leaves the guild (bot accounts only). */
    public async leave(): Promise<void> {
        await this.client.rest.delete(`/users/@me/guilds/${this.id}`);
        this.client.cache.guilds.delete(this.id);
    }

    public toString(): string {
        return this.name;
    }
}
