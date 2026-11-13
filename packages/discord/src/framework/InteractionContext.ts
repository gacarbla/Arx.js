import type { Message } from "../structures/Message";
import type { Channel } from "../structures/Channel";
import type { Guild } from "../structures/Guild";
import type { Member } from "../structures/Member";
import type { User } from "../structures/User";
import type { StructureClient } from "../structures/Structure";
import type {
    AutocompleteChoice,
    DeferOptions,
    InteractionAdapter,
    ModalPayload,
    ReplyPayload,
} from "../structures/interactions/InteractionAdapter";
import type { I18n } from "./i18n";
import type { Logger } from "./logger";
import { resolvePermission, type PermissionInput } from "./permissions";

export interface ContextClient extends StructureClient {
    readonly i18n: I18n;
    /** Gateway latency, when the driver exposes it. */
    readonly ping?: number | null;
    /** Optional structured logger. */
    readonly logger?: Logger;
}

export type Translator = (
    key: string,
    params?: Record<string, string | number>
) => string;

export type PayloadInput = string | ReplyPayload;

/**
 * Base context shared by command handlers and component handlers.
 *
 * It wraps an {@link InteractionAdapter} and adds safe response helpers:
 * replying after deferring edits the original response, replying twice creates
 * a follow-up, etc.
 */
export class InteractionContext {
    public readonly interaction: InteractionAdapter;
    public readonly client: ContextClient;

    protected _replied = false;
    protected _deferred = false;

    constructor(client: ContextClient, interaction: InteractionAdapter) {
        this.client = client;
        this.interaction = interaction;
    }

    public get id(): string {
        return this.interaction.id;
    }

    public get guildId(): string | null {
        return this.interaction.guildId;
    }

    public get channelId(): string | null {
        return this.interaction.channelId;
    }

    public get userId(): string | null {
        return this.interaction.userId;
    }

    public get locale(): string {
        return this.interaction.locale;
    }

    public get guild(): Guild | null {
        return this.interaction.guild;
    }

    public get channel(): Channel | null {
        return this.interaction.channel;
    }

    public get member(): Member | null {
        return this.interaction.member;
    }

    public get user(): User | null {
        return this.interaction.user;
    }

    public get isReplied(): boolean {
        return this._replied;
    }

    public get isDeferred(): boolean {
        return this._deferred;
    }

    public get t(): Translator {
        return (key, params) => this.client.i18n.t(this.locale, key, params);
    }

    public async reply(payload: PayloadInput): Promise<Message | null> {
        if (this._deferred) return this.editReply(payload);
        if (this._replied) return this.interaction.followUp(payload);

        this._replied = true;
        return this.interaction.reply(payload);
    }

    public async defer(options?: DeferOptions): Promise<void> {
        if (this._replied || this._deferred) return;
        this._deferred = true;
        await this.interaction.defer(options);
    }

    public async editReply(payload: PayloadInput): Promise<Message> {
        this._replied = true;
        return this.interaction.editReply(payload);
    }

    public async followUp(payload: PayloadInput): Promise<Message> {
        this._replied = true;
        return this.interaction.followUp(payload);
    }

    public async update(payload: ReplyPayload): Promise<Message | null> {
        this._replied = true;
        return this.interaction.update(payload);
    }

    public async modal(modal: ModalPayload): Promise<void> {
        this._replied = true;
        await this.interaction.showModal(modal);
    }

    public async showModal(modal: ModalPayload): Promise<void> {
        return this.modal(modal);
    }

    public async autocomplete(choices: AutocompleteChoice[]): Promise<void> {
        await this.interaction.autocomplete(choices);
    }

    public hasPermission(permission: PermissionInput): boolean {
        return this.member?.hasPermission(resolvePermission(permission)) ?? false;
    }
}
