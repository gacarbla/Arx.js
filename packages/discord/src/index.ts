/**
 * `@arx.js/discord`
 *
 * Native Discord client (Gateway + REST) and the transport-agnostic framework
 * that both the native driver and the discord.js bridge share.
 *
 * Importing this package must never perform network I/O.
 */

import "./config";

export { config } from "./config";

// Client & transport
export { Bot } from "./client/Bot";
export type { BotOptions, DirsConfig } from "./client/Bot";
export { RestClient } from "./core/rest/RestClient";
export type {
    RequestOptions,
    RestClientOptions,
    RestFile,
    RestLike,
    RestResponse,
} from "./core/rest/RestClient";
export {
    DiscordAPIError,
    NetworkError,
    RateLimitError,
    RequestTimeoutError,
} from "./core/rest/errors";
export { buildBucketKey } from "./core/rest/buckets";
export * from "./core/gateway";
export { CommandLoader } from "./loaders/commandLoader";
export * from "./loaders/eventLoader";
export * from "./loaders/componentLoader";
export * from "./loaders/moduleLoader";

// Framework (contexts, router, registry, i18n, permissions)
export * from "./framework/CommandRegistry";
export * from "./framework/CommandContext";
export * from "./framework/InteractionContext";
export * from "./framework/ComponentContext";
export * from "./framework/InteractionRouter";
export * from "./framework/customId";
export * from "./framework/i18n";
export * from "./framework/permissions";
export * from "./framework/parseOptions";
export * from "./framework/parseFields";
export * from "./framework/logger";

// Command framework
export { Command } from "./builders/Command";
export type {
    ApplicationCommandPayload,
    CommandData,
    CommandState,
} from "./builders/Command";
export { CommandCategory, SubcommandGroup } from "./builders/CommandCategory";
export type { CategoryData } from "./builders/CommandCategory";
export { CommandRunner } from "./builders/CommandRunner";
export { Subcommand } from "./builders/Subcommand";
export type { ExecutionFn, MiddlewareFn, SubcommandData } from "./builders/Subcommand";
export {
    ApplicationCommandOptionType,
    OptionBuilder,
    buildBasicOption,
} from "./builders/CommandOptions";
export type {
    CommandOptionChoice,
    CommandOptionData,
} from "./builders/CommandOptions";

// Lazy structures, opt-in cache and interaction adapters
export * from "./structures";
export * from "./structures/interactions";
export * from "./cache";

// Legacy snapshots and outbound message payloads
export * from "./models/channels";
export * from "./models/emojis";
export * from "./models/messages";
export * from "./models/embeds";
export type { UserData } from "./models/users/user";
export type { GuildData } from "./models/guilds/guild";
export type { ChannelData } from "./models/guilds/channel";
export type { GuildMemberData } from "./models/guilds/member";
export type { RoleData } from "./models/guilds/role";
export type { ChannelType } from "./types/channels";
export type { DMChannelData, GroupDMChannelData } from "./types/dms";

// Component builders (V1 + V2)
export * from "./models/components";

// Public types
export {
    ApplicationCommandOptionType as OptionType,
    ButtonStyleValue,
    ComponentType,
    SeparatorSpacingValue,
    TextInputStyleValue,
} from "./types/components";
export type {
    ButtonStyle,
    ComponentPayload,
    EmbedAuthor,
    EmbedField,
    EmbedFooter,
    EmbedImage,
    EmbedProvider,
    RadioGroupOption,
    SelectOption,
    SeparatorSpacing,
    TextInputStyle,
} from "./types/components";
