import type {
    GatewayChannelCreateDispatchData,
    GatewayChannelDeleteDispatchData,
    GatewayChannelUpdateDispatchData,
    GatewayGuildCreateDispatchData,
    GatewayGuildMemberAddDispatchData,
    GatewayGuildMemberRemoveDispatchData,
    GatewayGuildRoleCreateDispatchData,
    GatewayGuildRoleDeleteDispatchData,
    GatewayGuildRoleUpdateDispatchData,
    GatewayInteractionCreateDispatchData,
    GatewayMessageCreateDispatchData,
    GatewayMessageDeleteDispatchData,
    GatewayMessageUpdateDispatchData,
    GatewayPresenceUpdateDispatchData,
    GatewayTypingStartDispatchData,
} from "discord-api-types/gateway/v10";

/** Dispatch events with a concrete payload type from `discord-api-types`. */
export interface GatewayDispatchEventMap {
    MESSAGE_CREATE: GatewayMessageCreateDispatchData;
    MESSAGE_UPDATE: GatewayMessageUpdateDispatchData;
    MESSAGE_DELETE: GatewayMessageDeleteDispatchData;
    INTERACTION_CREATE: GatewayInteractionCreateDispatchData;
    GUILD_CREATE: GatewayGuildCreateDispatchData;
    GUILD_MEMBER_ADD: GatewayGuildMemberAddDispatchData;
    GUILD_MEMBER_REMOVE: GatewayGuildMemberRemoveDispatchData;
    CHANNEL_CREATE: GatewayChannelCreateDispatchData;
    CHANNEL_UPDATE: GatewayChannelUpdateDispatchData;
    CHANNEL_DELETE: GatewayChannelDeleteDispatchData;
    GUILD_ROLE_CREATE: GatewayGuildRoleCreateDispatchData;
    GUILD_ROLE_UPDATE: GatewayGuildRoleUpdateDispatchData;
    GUILD_ROLE_DELETE: GatewayGuildRoleDeleteDispatchData;
    TYPING_START: GatewayTypingStartDispatchData;
    PRESENCE_UPDATE: GatewayPresenceUpdateDispatchData;
}

export type GatewayDispatchEventName = keyof GatewayDispatchEventMap;
