import { Component } from "../components";
import type { ComponentPayload } from "../../types/components";
import {
    MESSAGE_TOP_LEVEL_TYPES,
    V2_COMPONENT_TYPES,
} from "../../types/components";
import { User, UserData } from "../users/user";
import { GuildMember, GuildMemberData } from "../guilds/member";
import { Attachment, AttachmentData } from "./attachment";
import { Reaction, ReactionData } from "./reaction";
import { Emoji } from "../emojis/emoji";

export interface MessageClientAdapter {
    deleteMessage(channelId: string, messageId: string): Promise<void>;
    editMessage(channelId: string, messageId: string, payload: Record<string, any>): Promise<ReceivedMessage>;
    sendMessage(channelId: string, payload: Record<string, any>): Promise<ReceivedMessage>;
    pinMessage(channelId: string, messageId: string): Promise<void>;
    unpinMessage(channelId: string, messageId: string): Promise<void>;
    addReaction(channelId: string, messageId: string, emoji: string): Promise<void>;
}

export interface MessageReferenceData {
    messageId?: string;
    channelId?: string;
    guildId?: string;
    failIfNotExists?: boolean;
}

export interface ReceivedMessageData {
    id: string;
    channelId: string;
    guildId?: string;
    author: UserData;
    member?: Omit<GuildMemberData, "user"> | GuildMemberData;
    content: string;
    embeds: Record<string, any>[];
    components: ComponentPayload[];
    attachments: AttachmentData[];
    reactions?: ReactionData[];
    mentions?: UserData[];
    mentionRoles?: string[];
    pinned: boolean;
    tts: boolean;
    mentionEveryone: boolean;
    type: number;
    flags?: number;
    referencedMessage?: ReceivedMessageData;
    timestamp: string;
    editedTimestamp?: string;
}

export const MessageFlags = {
    CROSSPOSTED: 1 << 0,
    IS_CROSSPOST: 1 << 1,
    SUPPRESS_EMBEDS: 1 << 2,
    EPHEMERAL: 1 << 6,
    LOADING: 1 << 7,
    SUPPRESS_NOTIFICATIONS: 1 << 12,
    IS_COMPONENTS_V2: 1 << 15,
} as const;

export class ReceivedMessage {
    readonly id: string;
    readonly channelId: string;
    readonly guildId?: string;
    readonly author: User;
    readonly member?: GuildMember;
    readonly content: string;
    readonly embeds: readonly Record<string, any>[];
    readonly components: readonly ComponentPayload[];
    readonly attachments: readonly Attachment[];
    readonly reactions: readonly Reaction[];
    readonly mentions: readonly User[];
    readonly mentionRoles: readonly string[];
    readonly pinned: boolean;
    readonly tts: boolean;
    readonly mentionEveryone: boolean;
    readonly type: number;
    readonly flags: number;
    readonly referencedMessage?: ReceivedMessage;
    readonly timestamp: Date;
    readonly editedTimestamp?: Date;

    private readonly adapter?: MessageClientAdapter;

    constructor(data: ReceivedMessageData, adapter?: MessageClientAdapter) {
        this.id = data.id;
        this.channelId = data.channelId;
        this.guildId = data.guildId;

        this.author = new User(data.author);

        if (data.member) {
            const memberPayload = "user" in data.member
                ? data.member
                : { ...data.member, user: data.author };
            this.member = new GuildMember(memberPayload);
        }

        this.content = data.content;
        this.embeds = Object.freeze([...(data.embeds ?? [])]);
        this.components = Object.freeze([...(data.components ?? [])]);
        this.attachments = Object.freeze((data.attachments ?? []).map((a) => new Attachment(a)));
        this.reactions = Object.freeze((data.reactions ?? []).map((r) => new Reaction(r)));

        this.mentions = Object.freeze((data.mentions ?? []).map((u) => new User(u)));
        this.mentionRoles = Object.freeze([...(data.mentionRoles ?? [])]);

        this.pinned = data.pinned;
        this.tts = data.tts;
        this.mentionEveryone = data.mentionEveryone;
        this.type = data.type;
        this.flags = data.flags ?? 0;
        this.timestamp = new Date(data.timestamp);
        this.editedTimestamp = data.editedTimestamp ? new Date(data.editedTimestamp) : undefined;
        this.adapter = adapter;

        if (data.referencedMessage) {
            this.referencedMessage = new ReceivedMessage(data.referencedMessage, adapter);
        }

        Object.freeze(this);
    }

    get emojis(): Emoji[] {
        if (!this.content) return [];
        const regex = /<(a)?:([a-zA-Z0-9_]+):(\d+)>/g;
        const result: Emoji[] = [];
        let match: RegExpExecArray | null;

        while ((match = regex.exec(this.content)) !== null) {
            result.push(
                new Emoji({
                    animated: Boolean(match[1]),
                    name: match[2],
                    id: match[3],
                })
            );
        }

        return result;
    }

    get allMentionedUsers(): User[] {
        const userMap = new Map<string, User>();

        for (const user of this.mentions) {
            userMap.set(user.id, user);
        }

        if (this.referencedMessage?.author) {
            userMap.set(this.referencedMessage.author.id, this.referencedMessage.author);
        }

        return Array.from(userMap.values());
    }

    hasFlag(flag: number): boolean {
        return (this.flags & flag) === flag;
    }

    get isEphemeral(): boolean {
        return this.hasFlag(MessageFlags.EPHEMERAL);
    }

    get isCrossposted(): boolean {
        return this.hasFlag(MessageFlags.CROSSPOSTED);
    }

    get isEmbedSuppressed(): boolean {
        return this.hasFlag(MessageFlags.SUPPRESS_EMBEDS);
    }

    get isComponentsV2(): boolean {
        return this.hasFlag(MessageFlags.IS_COMPONENTS_V2);
    }

    clone(): OutboundMessage {
        const outbound = new OutboundMessage();
        if (this.content) outbound.setContent(this.content);
        this.embeds.forEach((embed) => outbound.addEmbed({ ...embed }));
        this.components.forEach((component) => outbound.addComponent(component));
        if (this.flags) outbound.setFlags(this.flags);
        return outbound;
    }

    async reply(message: OutboundMessage | string): Promise<ReceivedMessage> {
        this.ensureAdapter();
        const outbound = typeof message === "string"
            ? new OutboundMessage().setContent(message)
            : message;

        outbound.replyTo(this.id);
        return this.adapter!.sendMessage(this.channelId, outbound.toJSON());
    }

    async edit(message: OutboundMessage | string): Promise<ReceivedMessage> {
        this.ensureAdapter();
        const outbound = typeof message === "string"
            ? new OutboundMessage().setContent(message)
            : message;

        return this.adapter!.editMessage(this.channelId, this.id, outbound.toJSON());
    }

    async delete(): Promise<void> {
        this.ensureAdapter();
        return this.adapter!.deleteMessage(this.channelId, this.id);
    }

    async pin(): Promise<void> {
        this.ensureAdapter();
        return this.adapter!.pinMessage(this.channelId, this.id);
    }

    async unpin(): Promise<void> {
        this.ensureAdapter();
        return this.adapter!.unpinMessage(this.channelId, this.id);
    }

    async react(emoji: string | Emoji): Promise<void> {
        this.ensureAdapter();
        const emojiIdentifier = typeof emoji === "string" ? emoji : emoji.identifier;
        return this.adapter!.addReaction(this.channelId, this.id, emojiIdentifier);
    }

    private ensureAdapter(): void {
        if (!this.adapter) {
            throw new Error("Cannot perform network action: MessageClientAdapter was not injected.");
        }
    }
}

type ComponentLike = Component | ComponentPayload;

export class OutboundMessage {
    private content?: string;
    private embeds: Record<string, any>[] = [];
    private components: ComponentLike[] = [];
    private messageReference?: MessageReferenceData;
    private allowedMentions?: Record<string, any>;
    private flags = 0;
    private tts = false;

    setContent(content: string): this {
        this.content = content;
        return this;
    }

    addEmbed(embed: { toJSON(): Record<string, any> } | Record<string, any>): this {
        this.embeds.push(toPlainEmbed(embed));
        return this;
    }

    addEmbeds(embeds: readonly ({ toJSON(): Record<string, any> } | Record<string, any>)[]): this {
        for (const embed of embeds) this.addEmbed(embed);
        return this;
    }

    setEmbeds(embeds: readonly ({ toJSON(): Record<string, any> } | Record<string, any>)[]): this {
        this.embeds = embeds.map(toPlainEmbed);
        return this;
    }

    addComponent(component: ComponentLike): this {
        this.components.push(component);
        return this;
    }

    addComponents(components: readonly ComponentLike[]): this {
        this.components.push(...components);
        return this;
    }

    setComponents(components: readonly ComponentLike[]): this {
        this.components = [...components];
        return this;
    }

    replyTo(messageId: string | ReceivedMessage, failIfNotExists = true): this {
        const id = typeof messageId === "string" ? messageId : messageId.id;
        this.messageReference = {
            messageId: id,
            failIfNotExists,
        };
        return this;
    }

    setAllowedMentions(allowedMentions: Record<string, any>): this {
        this.allowedMentions = { ...allowedMentions };
        return this;
    }

    setEphemeral(ephemeral = true): this {
        if (ephemeral) {
            this.flags |= MessageFlags.EPHEMERAL;
        } else {
            this.flags &= ~MessageFlags.EPHEMERAL;
        }
        return this;
    }

    suppressEmbeds(suppress = true): this {
        if (suppress) {
            this.flags |= MessageFlags.SUPPRESS_EMBEDS;
        } else {
            this.flags &= ~MessageFlags.SUPPRESS_EMBEDS;
        }
        return this;
    }

    setFlags(flags: number): this {
        this.flags = flags;
        return this;
    }

    setTTS(tts = true): this {
        this.tts = tts;
        return this;
    }

    clone(): OutboundMessage {
        const copy = new OutboundMessage();
        copy.content = this.content;
        copy.embeds = this.embeds.map((embed) => ({ ...embed }));
        copy.components = [...this.components];
        copy.allowedMentions = this.allowedMentions ? { ...this.allowedMentions } : undefined;
        copy.flags = this.flags;
        copy.tts = this.tts;
        if (this.messageReference) {
            copy.messageReference = { ...this.messageReference };
        }
        return copy;
    }

    toJSON(): Record<string, any> {
        const serializedComponents = this.components.map((component) =>
            typeof (component as Component).toJSON === "function"
                ? (component as Component).toJSON()
                : component
        );

        for (const component of serializedComponents) {
            if (!MESSAGE_TOP_LEVEL_TYPES.has(component.type as any)) {
                throw new Error(
                    `Component type ${component.type} cannot be placed at the top level of a message.`
                );
            }
        }

        const usesV2 = serializedComponents.some((component) =>
            V2_COMPONENT_TYPES.has(component.type as any)
        );

        if (usesV2 && this.embeds.length > 0) {
            throw new Error("Messages with Components V2 cannot contain embeds. Use TextDisplay instead.");
        }
        if (this.content !== undefined) {
            const max = usesV2 ? 4000 : 2000;
            if (this.content.length > max) {
                throw new RangeError(`Message content must be at most ${max} characters (received ${this.content.length}).`);
            }
        }
        if (this.embeds.length > 10) {
            throw new RangeError(`Messages support at most 10 embeds (received ${this.embeds.length}).`);
        }

        const payload: Record<string, any> = { tts: this.tts };

        if (this.content !== undefined) payload.content = this.content;
        if (this.embeds.length > 0) payload.embeds = this.embeds;
        if (serializedComponents.length > 0) payload.components = serializedComponents;
        if (this.flags || usesV2) payload.flags = this.flags | (usesV2 ? MessageFlags.IS_COMPONENTS_V2 : 0);
        if (this.allowedMentions) payload.allowed_mentions = this.allowedMentions;
        if (this.messageReference) {
            payload.message_reference = {
                message_id: this.messageReference.messageId,
                channel_id: this.messageReference.channelId,
                guild_id: this.messageReference.guildId,
                fail_if_not_exists: this.messageReference.failIfNotExists,
            };
        }

        return payload;
    }
}

function toPlainEmbed(embed: { toJSON(): Record<string, any> } | Record<string, any>): Record<string, any> {
    return typeof (embed as any).toJSON === "function" ? (embed as any).toJSON() : { ...embed };
}
