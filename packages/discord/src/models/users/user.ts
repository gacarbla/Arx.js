export interface UserData {
    id: string;
    username: string;
    discriminator?: string;
    globalName?: string | null;
    avatar?: string | null;
    bot?: boolean;
    system?: boolean;
    banner?: string | null;
    accentColor?: number | null;
}

export class User {
    readonly id: string;
    readonly username: string;
    readonly discriminator: string;
    readonly globalName?: string | null;
    readonly avatar?: string | null;
    readonly bot: boolean;
    readonly system: boolean;
    readonly banner?: string | null;
    readonly accentColor?: number | null;

    constructor(data: UserData) {
        this.id = data.id;
        this.username = data.username;
        this.discriminator = data.discriminator ?? "0";
        this.globalName = data.globalName ?? null;
        this.avatar = data.avatar ?? null;
        this.bot = Boolean(data.bot);
        this.system = Boolean(data.system);
        this.banner = data.banner ?? null;
        this.accentColor = data.accentColor ?? null;

        Object.freeze(this);
    }

    get displayName(): string {
        return this.globalName ?? this.username;
    }

    get mention(): string {
        return `<@${this.id}>`;
    }

    get tag(): string {
        return this.discriminator && this.discriminator !== "0"
            ? `${this.username}#${this.discriminator}`
            : this.username;
    }

    getAvatarUrl(options: { format?: "png" | "jpg" | "webp" | "gif"; size?: number } = {}): string {
        if (!this.avatar) {
            const defaultIndex = this.discriminator === "0"
                ? Number(BigInt(this.id) >> 22n) % 6
                : Number(this.discriminator) % 5;
            return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
        }

        const format = options.format ?? (this.avatar.startsWith("a_") ? "gif" : "png");
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.${format}${size}`;
    }

    toString(): string {
        return this.mention;
    }

    toJSON(): UserData {
        return {
            id: this.id,
            username: this.username,
            discriminator: this.discriminator,
            globalName: this.globalName,
            avatar: this.avatar,
            bot: this.bot,
            system: this.system,
            banner: this.banner,
            accentColor: this.accentColor
        };
    }
}