import { User, UserData } from "../users/user";

export interface EmojiData {
    id?: string | null;
    name: string | null;
    roles?: string[];
    user?: UserData;
    requireColons?: boolean;
    managed?: boolean;
    animated?: boolean;
    available?: boolean;
}

export class Emoji {
    readonly id?: string | null;
    readonly name: string | null;
    readonly roleIds: readonly string[];
    readonly user?: User;
    readonly requireColons: boolean;
    readonly managed: boolean;
    readonly animated: boolean;
    readonly available: boolean;

    constructor(data: EmojiData) {
        this.id = data.id ?? null;
        this.name = data.name ?? null;
        this.roleIds = Object.freeze([...(data.roles ?? [])]);
        this.user = data.user ? new User(data.user) : undefined;
        this.requireColons = data.requireColons ?? true;
        this.managed = Boolean(data.managed);
        this.animated = Boolean(data.animated);
        this.available = data.available ?? true;

        Object.freeze(this);
    }

    get isCustom(): boolean {
        return Boolean(this.id);
    }

    get identifier(): string {
        if (this.id) {
            return `${this.name}:${this.id}`;
        }
        return this.name ?? "";
    }

    get mention(): string {
        if (this.id) {
            const prefix = this.animated ? "a" : "";
            return `<${prefix}:${this.name}:${this.id}>`;
        }
        return this.name ?? "";
    }

    getUrl(options: { format?: "png" | "jpg" | "webp" | "gif"; size?: number } = {}): string | null {
        if (!this.id) return null;
        const format = options.format ?? (this.animated ? "gif" : "png");
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/emojis/${this.id}.${format}${size}`;
    }

    toString(): string {
        return this.mention;
    }

    /**
     * Payload used inside message components (`{ id, name, animated }`).
     *
     * `Emoji.toJSON()` is the richer domain model and must not be sent to
     * Discord as-is.
     */
    toComponentJSON(): { id?: string; name: string; animated?: boolean } {
        const payload: { id?: string; name: string; animated?: boolean } = {
            name: this.name ?? "",
        };
        if (this.id) payload.id = this.id;
        if (this.animated) payload.animated = true;
        return payload;
    }

    toJSON(): EmojiData {
        return {
            id: this.id,
            name: this.name,
            roles: [...this.roleIds],
            user: this.user?.toJSON(),
            requireColons: this.requireColons,
            managed: this.managed,
            animated: this.animated,
            available: this.available
        };
    }
}