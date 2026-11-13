import type { APIRole } from "discord-api-types/v10";
import { Structure, type StructureClient } from "./Structure";
import { Guild } from "./Guild";
import { roleKey } from "../cache/updaters";

export class Role extends Structure<APIRole> {
    constructor(
        client: StructureClient,
        public readonly guildId: string,
        raw: APIRole
    ) {
        super(client, raw);
    }

    public get id(): string {
        return this.raw.id;
    }

    public get name(): string {
        return this.raw.name;
    }

    public get color(): number {
        return this.raw.color;
    }

    public get hexColor(): string {
        return `#${this.raw.color.toString(16).padStart(6, "0")}`;
    }

    public get position(): number {
        return this.raw.position;
    }

    public get permissions(): string {
        return this.raw.permissions;
    }

    public get managed(): boolean {
        return Boolean(this.raw.managed);
    }

    public get mentionable(): boolean {
        return Boolean(this.raw.mentionable);
    }

    public get hoist(): boolean {
        return Boolean(this.raw.hoist);
    }

    public get icon(): string | null {
        return this.raw.icon ?? null;
    }

    public get unicodeEmoji(): string | null {
        return this.raw.unicode_emoji ?? null;
    }

    public get mention(): string {
        return `<@&${this.id}>`;
    }

    public get guild(): Guild | null {
        const raw = this.client.cache.guilds.get(this.guildId);
        return raw ? new Guild(this.client, raw) : null;
    }

    public async edit(payload: Record<string, unknown>, reason?: string): Promise<Role> {
        const raw = await this.client.rest.patch<APIRole>(
            `/guilds/${this.guildId}/roles/${this.id}`,
            payload,
            { reason }
        );
        this.raw = raw;
        this.client.cache.roles.set(roleKey(this.guildId, raw.id), raw);
        return this;
    }

    public async delete(reason?: string): Promise<void> {
        await this.client.rest.delete(`/guilds/${this.guildId}/roles/${this.id}`, { reason });
        this.client.cache.roles.delete(roleKey(this.guildId, this.id));
    }

    public toString(): string {
        return this.mention;
    }
}
