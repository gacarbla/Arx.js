import type { APIInteraction } from "discord-api-types/v10";
import type { Channel } from "../Channel";
import type { Guild } from "../Guild";
import type { Member } from "../Member";
import type { Message } from "../Message";
import type { User } from "../User";

export interface ReplyPayload extends Record<string, unknown> {
    ephemeral?: boolean;
}

export interface DeferOptions {
    ephemeral?: boolean;
}

export interface ModalPayload {
    custom_id: string;
    title: string;
    components: unknown[];
}

export interface AutocompleteChoice {
    name: string;
    value: string | number;
}

/** Transport-agnostic interaction surface used by command handlers. */
export interface InteractionAdapter {
    readonly raw: APIInteraction;
    readonly id: string;
    readonly type: number;
    readonly guildId: string | null;
    readonly channelId: string | null;
    readonly userId: string | null;
    readonly locale: string;
    readonly guild: Guild | null;
    readonly channel: Channel | null;
    readonly member: Member | null;
    readonly user: User | null;
    reply(payload: string | ReplyPayload): Promise<Message | null>;
    defer(options?: DeferOptions): Promise<void>;
    editReply(payload: string | ReplyPayload): Promise<Message>;
    followUp(payload: string | ReplyPayload): Promise<Message>;
    update(payload: ReplyPayload): Promise<Message | null>;
    showModal(modal: ModalPayload): Promise<void>;
    autocomplete(choices: AutocompleteChoice[]): Promise<void>;
}
