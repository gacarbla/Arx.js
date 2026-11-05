import { Emoji, EmojiData } from "../emojis/emoji";

export interface ReactionData {
    count: number;
    me: boolean;
    emoji: EmojiData;
    meBurst?: boolean;
}

export class Reaction {
    readonly count: number;
    readonly me: boolean;
    readonly emoji: Emoji;
    readonly meBurst: boolean;

    constructor(data: ReactionData) {
        this.count = data.count;
        this.me = Boolean(data.me);
        this.emoji = new Emoji(data.emoji);
        this.meBurst = Boolean(data.meBurst);

        Object.freeze(this);
    }

    toString(): string {
        return `${this.emoji.toString()} (${this.count})`;
    }

    toJSON(): ReactionData {
        return {
            count: this.count,
            me: this.me,
            emoji: this.emoji.toJSON(),
            meBurst: this.meBurst
        };
    }
}