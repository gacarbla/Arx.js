import type { GroupDMChannelData } from "../../types/dms";
import { User } from "../users/user";

export class GroupDMChannel {
    readonly id: string;
    readonly type: 3 = 3;
    readonly name?: string | null;
    readonly icon?: string | null;
    readonly ownerId: string;
    readonly recipients: Map<string, User>;
    readonly lastMessageId?: string | null;
    readonly applicationId?: string | null;

    constructor(data: GroupDMChannelData) {
        this.id = data.id;
        this.name = data.name ?? null;
        this.icon = data.icon ?? null;
        this.ownerId = data.ownerId;
        this.lastMessageId = data.lastMessageId ?? null;
        this.applicationId = data.applicationId ?? null;

        const recipientMap = new Map<string, User>();
        data.recipients.forEach(r => recipientMap.set(r.id, new User(r)));
        this.recipients = recipientMap;

        Object.freeze(this);
    }

    get displayName(): string {
        if (this.name) return this.name;
        const names = Array.from(this.recipients.values()).map(u => u.displayName);
        return names.join(", ") || "Group DM";
    }

    get mention(): string {
        return `<#${this.id}>`;
    }

    isDM(): false {
        return false;
    }

    isGroupDM(): true {
        return true;
    }

    getOwner(): User | undefined {
        return this.recipients.get(this.ownerId);
    }

    getIconUrl(options: { format?: "png" | "jpg" | "webp" | "gif"; size?: number } = {}): string | null {
        if (!this.icon) return null;
        const format = options.format ?? "png";
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/channel-icons/${this.id}/${this.icon}.${format}${size}`;
    }

    toString(): string {
        return this.displayName;
    }

    toJSON(): Record<string, any> {
        return {
            id: this.id,
            type: 3,
            name: this.name,
            icon: this.icon,
            ownerId: this.ownerId,
            recipients: Array.from(this.recipients.values()).map(u => u.toJSON()),
            lastMessageId: this.lastMessageId,
            applicationId: this.applicationId
        };
    }
}