import type { APIRole } from "discord-api-types/v10";
import { roleKey } from "../../cache/updaters";
import type { StructureClient } from "../Structure";
import { Role } from "../Role";

export class GuildRoleManager {
    constructor(
        private readonly client: StructureClient,
        private readonly guildId: string
    ) {}

    /** Cached roles keyed by role id. */
    public get cache(): ReadonlyMap<string, Role> {
        const result = new Map<string, Role>();

        for (const [key, raw] of this.client.cache.roles) {
            if (key.startsWith(`${this.guildId}:`)) {
                result.set(raw.id, new Role(this.client, this.guildId, raw));
            }
        }

        return result;
    }

    public get(roleId: string): Role | undefined {
        const raw = this.client.cache.roles.get(roleKey(this.guildId, roleId));
        return raw ? new Role(this.client, this.guildId, raw) : undefined;
    }

    public async fetch(): Promise<Map<string, Role>> {
        const raw = await this.client.rest.get<APIRole[]>(`/guilds/${this.guildId}/roles`);
        const result = new Map<string, Role>();

        for (const role of raw) {
            this.client.cache.roles.set(roleKey(this.guildId, role.id), role);
            result.set(role.id, new Role(this.client, this.guildId, role));
        }

        return result;
    }

    public async create(payload: Record<string, unknown>, reason?: string): Promise<Role> {
        const raw = await this.client.rest.post<APIRole>(
            `/guilds/${this.guildId}/roles`,
            payload,
            { reason }
        );
        this.client.cache.roles.set(roleKey(this.guildId, raw.id), raw);
        return new Role(this.client, this.guildId, raw);
    }
}
