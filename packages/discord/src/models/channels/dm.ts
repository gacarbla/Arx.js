import type { DMChannelData } from "../../types/dms";
import { User } from "../users/user"; 

export class DMChannel {
    readonly id: string;
    readonly type: 1 = 1;
    readonly recipient: User;
    readonly lastMessageId?: string | null;

    constructor(data: DMChannelData) {
        this.id = data.id;
        this.recipient = new User(data.recipient);
        this.lastMessageId = data.lastMessageId ?? null;

        Object.freeze(this);
    }

    get mention(): string {
        return `<#${this.id}>`;
    }

    isDM(): true {
        return true;
    }

    isGroupDM(): false {
        return false;
    }

    toString(): string {
        return `@${this.recipient.username}`;
    }

    toJSON(): DMChannelData {
        return {
            id: this.id,
            type: 1,
            recipient: this.recipient.toJSON(),
            lastMessageId: this.lastMessageId
        };
    }
}