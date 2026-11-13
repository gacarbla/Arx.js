import { User, UserData } from "../users/user";
import { Role } from "./role";

export interface GuildMemberData {
    user: UserData;
    nickname?: string | null;
    roles: string[];
    joinedAt: string;
    premiumSince?: string | null;
    deaf?: boolean;
    mute?: boolean;
}

export class GuildMember {
    readonly user: User;
    readonly nickname?: string | null;
    readonly roleIds: readonly string[];
    readonly joinedAt: Date;
    readonly premiumSince?: Date;
    readonly deaf: boolean;
    readonly mute: boolean;

    constructor(data: GuildMemberData) {
        this.user = new User(data.user);
        this.nickname = data.nickname ?? null;
        this.roleIds = Object.freeze([...data.roles]);
        this.joinedAt = new Date(data.joinedAt);
        this.premiumSince = data.premiumSince ? new Date(data.premiumSince) : undefined;
        this.deaf = Boolean(data.deaf);
        this.mute = Boolean(data.mute);

        Object.freeze(this);
    }

    get displayName(): string {
        return this.nickname ?? this.user.displayName;
    }

    get mention(): string {
        return this.user.mention;
    }

    hasRole(role: string | Role): boolean {
        const id = typeof role === "string" ? role : role.id;
        return this.roleIds.includes(id);
    }

    toString(): string {
        return this.mention;
    }

    toJSON(): Record<string, any> {
        return {
            user: this.user.toJSON(),
            nickname: this.nickname,
            roles: [...this.roleIds],
            joinedAt: this.joinedAt.toISOString(),
            premiumSince: this.premiumSince?.toISOString(),
            deaf: this.deaf,
            mute: this.mute
        };
    }
}