export type ChannelType = 0 | 1 | 2 | 3 | 4 | 5 | 10 | 11 | 12 | 13 | 14 | 15;

export interface ChannelData {
    id: string;
    name: string;
    type: ChannelType;
    position?: number;
    parentId?: string | null;
    topic?: string | null;
    nsfw?: boolean;
}

export class GuildChannel {
    readonly id: string;
    readonly name: string;
    readonly type: ChannelType;
    readonly position: number;
    readonly parentId?: string | null;
    readonly topic?: string | null;
    readonly nsfw: boolean;

    constructor(data: ChannelData) {
        this.id = data.id;
        this.name = data.name;
        this.type = data.type;
        this.position = data.position ?? 0;
        this.parentId = data.parentId ?? null;
        this.topic = data.topic ?? null;
        this.nsfw = Boolean(data.nsfw);

        Object.freeze(this);
    }

    get mention(): string {
        return `<#${this.id}>`;
    }

    isText(): boolean {
        return this.type === 0;
    }

    isVoice(): boolean {
        return this.type === 2;
    }

    isCategory(): boolean {
        return this.type === 4;
    }

    toString(): string {
        return this.mention;
    }

    toJSON(): ChannelData {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            position: this.position,
            parentId: this.parentId,
            topic: this.topic,
            nsfw: this.nsfw
        };
    }
}