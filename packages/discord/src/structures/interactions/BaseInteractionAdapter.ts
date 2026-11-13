import type {
    APIChannel,
    APIGuildMember,
    APIInteraction,
    APIUser,
} from "discord-api-types/v10";
import type { StructureClient } from "../Structure";
import { User } from "../User";
import { Guild } from "../Guild";
import { Channel } from "../Channel";
import { Member } from "../Member";
import type {
    AutocompleteChoice,
    DeferOptions,
    InteractionAdapter,
    ModalPayload,
    ReplyPayload,
} from "./InteractionAdapter";

/** Shared context getters for native and discord.js interaction adapters. */
export abstract class BaseInteractionAdapter implements InteractionAdapter {
    constructor(
        protected readonly client: StructureClient,
        public readonly raw: APIInteraction
    ) {}

    protected get data(): any {
        return this.raw as any;
    }

    public get id(): string {
        return this.data.id;
    }

    public get type(): number {
        return this.data.type;
    }

    public get guildId(): string | null {
        return this.data.guild_id ?? null;
    }

    public get channelId(): string | null {
        return this.data.channel_id ?? null;
    }

    public get userId(): string | null {
        return this.data.member?.user?.id ?? this.data.user?.id ?? null;
    }

    public get locale(): string {
        return this.data.locale ?? this.data.guild_locale ?? "en-US";
    }

    public get guild(): Guild | null {
        if (!this.guildId) return null;
        const raw = this.client.cache.guilds.get(this.guildId);
        return raw ? new Guild(this.client, raw) : null;
    }

    public get channel(): Channel | null {
        if (!this.channelId) return null;
        const raw = this.client.cache.channels.get(this.channelId);
        return raw
            ? new Channel(this.client, raw)
            : new Channel(this.client, { id: this.channelId, type: 0 } as APIChannel);
    }

    public get member(): Member | null {
        const raw = this.data.member as APIGuildMember | undefined;
        if (!raw || !this.guildId) return null;
        return new Member(this.client, this.guildId, raw);
    }

    public get user(): User | null {
        const raw = (this.data.member?.user ?? this.data.user) as APIUser | undefined;
        return raw ? new User(this.client, raw) : null;
    }

    protected get token(): string {
        return this.data.token;
    }

    protected get applicationId(): string | null {
        return this.client.applicationId ?? this.data.application_id ?? null;
    }

    protected requireApplicationId(): string {
        if (!this.applicationId) {
            throw new Error("Cannot use webhook responses before the application id is known.");
        }
        return this.applicationId;
    }

    public abstract reply(payload: string | ReplyPayload): Promise<import("../Message").Message | null>;
    public abstract defer(options?: DeferOptions): Promise<void>;
    public abstract editReply(payload: string | ReplyPayload): Promise<import("../Message").Message>;
    public abstract followUp(payload: string | ReplyPayload): Promise<import("../Message").Message>;
    public abstract update(payload: ReplyPayload): Promise<import("../Message").Message | null>;
    public abstract showModal(modal: ModalPayload): Promise<void>;
    public abstract autocomplete(choices: AutocompleteChoice[]): Promise<void>;
}
