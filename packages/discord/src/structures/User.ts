import type { APIChannel, APIUser } from "discord-api-types/v10";
import { Structure } from "./Structure";
import { Channel } from "./Channel";
import type { SendMessageOptions } from "./managers/MessageManager";

export interface AvatarOptions {
    size?: number;
    format?: "png" | "jpg" | "webp" | "gif";
}

export class User extends Structure<APIUser> {
    public get id(): string {
        return this.raw.id;
    }

    public get username(): string {
        return this.raw.username;
    }

    public get discriminator(): string {
        return this.raw.discriminator ?? "0";
    }

    public get globalName(): string | null {
        return this.raw.global_name ?? null;
    }

    public get displayName(): string {
        return this.raw.global_name ?? this.raw.username;
    }

    public get bot(): boolean {
        return Boolean(this.raw.bot);
    }

    public get system(): boolean {
        return Boolean(this.raw.system);
    }

    public get avatar(): string | null {
        return this.raw.avatar ?? null;
    }

    public get mention(): string {
        return `<@${this.id}>`;
    }

    public get tag(): string {
        return this.discriminator !== "0" ? `${this.username}#${this.discriminator}` : this.username;
    }

    public avatarURL(options: AvatarOptions = {}): string {
        if (!this.avatar) {
            const index =
                this.discriminator === "0"
                    ? Number((BigInt(this.id) >> 22n) % 6n)
                    : Number(this.discriminator) % 5;
            return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
        }

        const format = options.format ?? (this.avatar.startsWith("a_") ? "gif" : "png");
        const size = options.size ? `?size=${options.size}` : "";
        return `https://cdn.discordapp.com/avatars/${this.id}/${this.avatar}.${format}${size}`;
    }

    /** Opens (or reuses) a DM channel and sends a message through it. */
    public async send(
        contentOrPayload: string | Record<string, unknown>,
        options: SendMessageOptions = {}
    ) {
        const channel = await this.createDM();
        return channel.send(contentOrPayload, options);
    }

    public async createDM(): Promise<Channel> {
        const raw = await this.client.rest.post<APIChannel>("/users/@me/channels", {
            recipient_id: this.id,
        });
        this.client.cache.channels.set(raw.id, raw);
        return new Channel(this.client, raw);
    }

    public async fetch(): Promise<User> {
        const raw = await this.client.rest.get<APIUser>(`/users/${this.id}`);
        this.client.cache.users.set(raw.id, raw);
        return new User(this.client, raw);
    }

    public toString(): string {
        return this.mention;
    }
}
