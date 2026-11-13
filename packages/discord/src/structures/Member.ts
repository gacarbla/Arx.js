import type { APIGuildMember } from "discord-api-types/v10";
import { Structure, type StructureClient } from "./Structure";
import { User } from "./User";
import { Guild } from "./Guild";
import { memberKey } from "../cache/updaters";
import {
    Permissions,
    resolvePermission,
    type PermissionInput,
} from "../framework/permissions";

export interface BanOptions {
    reason?: string;
    /** Delete messages from the last N seconds (0-604800). */
    deleteMessageSeconds?: number;
}

export class Member extends Structure<APIGuildMember> {
    constructor(
        client: StructureClient,
        public readonly guildId: string,
        raw: APIGuildMember
    ) {
        super(client, raw);
    }

    public get id(): string {
        return this.raw.user.id;
    }

    public get user(): User {
        return new User(this.client, this.raw.user);
    }

    public get nickname(): string | null {
        return this.raw.nick ?? null;
    }

    public get displayName(): string {
        return this.raw.nick ?? this.raw.user.global_name ?? this.raw.user.username;
    }

    public get roleIds(): readonly string[] {
        return this.raw.roles;
    }

    public get joinedAt(): Date | null {
        return this.raw.joined_at ? new Date(this.raw.joined_at) : null;
    }

    public get premiumSince(): Date | null {
        return this.raw.premium_since ? new Date(this.raw.premium_since) : null;
    }

    public get deaf(): boolean {
        return Boolean(this.raw.deaf);
    }

    public get mute(): boolean {
        return Boolean(this.raw.mute);
    }

    public get pending(): boolean {
        return Boolean(this.raw.pending);
    }

    public get mention(): string {
        return `<@${this.id}>`;
    }

    public get guild(): Guild | null {
        const raw = this.client.cache.guilds.get(this.guildId);
        return raw ? new Guild(this.client, raw) : null;
    }

    public hasRole(roleId: string): boolean {
        return this.raw.roles.includes(roleId);
    }

    /** Permission bitfield computed from the cached guild and roles. */
    public get permissions(): bigint {
        const guild = this.client.cache.guilds.get(this.guildId);
        if (!guild) return 0n;
        if (guild.owner_id === this.id) return 0xffffffffffffffffn;

        const roleIds = new Set<string>([guild.id, ...this.raw.roles]);
        let permissions = 0n;

        for (const [key, role] of this.client.cache.roles) {
            if (!key.startsWith(`${this.guildId}:`)) continue;
            if (roleIds.has(role.id)) {
                permissions |= BigInt(role.permissions);
            }
        }

        return permissions;
    }

    public hasPermission(permission: PermissionInput): boolean {
        const required = resolvePermission(permission);
        const permissions = this.permissions;
        if ((permissions & Permissions.Administrator) !== 0n) return true;
        return (permissions & required) === required;
    }

    public async edit(payload: Record<string, unknown>, reason?: string): Promise<Member> {
        const raw = await this.client.rest.patch<APIGuildMember>(
            `/guilds/${this.guildId}/members/${this.id}`,
            payload,
            { reason }
        );
        this.raw = raw;
        this.client.cache.members.set(memberKey(this.guildId, this.id), raw);
        return this;
    }

    public async kick(reason?: string): Promise<void> {
        await this.client.rest.delete(`/guilds/${this.guildId}/members/${this.id}`, { reason });
        this.client.cache.members.delete(memberKey(this.guildId, this.id));
    }

    public async ban(options: BanOptions = {}): Promise<void> {
        await this.client.rest.put(
            `/guilds/${this.guildId}/bans/${this.id}`,
            { delete_message_seconds: options.deleteMessageSeconds ?? 0 },
            { reason: options.reason }
        );
        this.client.cache.members.delete(memberKey(this.guildId, this.id));
    }

    public async addRole(roleId: string, reason?: string): Promise<void> {
        await this.client.rest.put(
            `/guilds/${this.guildId}/members/${this.id}/roles/${roleId}`,
            undefined,
            { reason }
        );
    }

    public async removeRole(roleId: string, reason?: string): Promise<void> {
        await this.client.rest.delete(
            `/guilds/${this.guildId}/members/${this.id}/roles/${roleId}`,
            { reason }
        );
    }

    public toString(): string {
        return this.mention;
    }
}
