import { Role, RoleData } from "./role";
import { GuildChannel, ChannelData } from "./channel";
import { GuildMember, GuildMemberData } from "./member";

export interface GuildData {
    id: string;
    name: string;
    icon?: string | null;
    ownerId: string;
    roles: RoleData[];
    channels: ChannelData[];
    members?: GuildMemberData[];
}

export class Guild {
    readonly id: string;
    readonly name: string;
    readonly icon?: string | null;
    readonly ownerId: string;
    readonly roles: Map<string, Role>;
    readonly channels: Map<string, GuildChannel>;
    readonly members: Map<string, GuildMember>;

    constructor(data: GuildData) {
        this.id = data.id;
        this.name = data.name;
        this.icon = data.icon ?? null;
        this.ownerId = data.ownerId;

        const roleMap = new Map<string, Role>();
        data.roles.forEach(r => roleMap.set(r.id, new Role(r)));
        this.roles = roleMap;

        const channelMap = new Map<string, GuildChannel>();
        data.channels.forEach(c => channelMap.set(c.id, new GuildChannel(c)));
        this.channels = channelMap;

        const memberMap = new Map<string, GuildMember>();
        (data.members ?? []).forEach(m => memberMap.set(m.user.id, new GuildMember(m)));
        this.members = memberMap;

        Object.freeze(this);
    }

    getRole(id: string): Role | undefined {
        return this.roles.get(id);
    }

    getChannel(id: string): GuildChannel | undefined {
        return this.channels.get(id);
    }

    getMember(id: string): GuildMember | undefined {
        return this.members.get(id);
    }

    getIconUrl(options: { format?: "png" | "jpg" | "webp" | "gif"; size?: number } = {}): string | null {
        if (!this.icon) return null;
        const format = options.format ?? (this.icon.startsWith("a_") ? "gif" : "png");
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/icons/${this.id}/${this.icon}.${format}${size}`;
    }

    toJSON(): Record<string, any> {
        return {
            id: this.id,
            name: this.name,
            icon: this.icon,
            ownerId: this.ownerId,
            roles: Array.from(this.roles.values()).map(r => r.toJSON()),
            channels: Array.from(this.channels.values()).map(c => c.toJSON()),
            members: Array.from(this.members.values()).map(m => m.toJSON())
        };
    }
}