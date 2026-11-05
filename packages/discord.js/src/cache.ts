import { Options, type CacheFactory } from "discord.js";
import type { CacheOptions, CachePolicyInput } from "@arx.js/discord";

function maximum(policy: CachePolicyInput | undefined, fallback: number): number {
    if (policy === undefined) return fallback;
    if (typeof policy === "number") return policy;
    return policy.max ?? fallback;
}

/**
 * Cache factory with safe defaults for the bridge.
 *
 * Messages, members and presences are disabled unless the user enables them
 * through the same `cache` options used by the native client.
 */
export function createCacheFactory(options: CacheOptions = {}): CacheFactory {
    const messages = maximum(options.messages, 0);
    const members = maximum(options.members, 0);
    const presences = maximum(options.presences, 0);
    const users = maximum(options.users, 1000);

    return Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: messages,
        GuildMessageManager: messages,
        DMMessageManager: messages,
        GuildMemberManager: members,
        PresenceManager: presences,
        UserManager: users,
        ReactionManager: 0,
        ReactionUserManager: 0,
        GuildStickerManager: 0,
        StageInstanceManager: 0,
        ThreadMemberManager: 0,
        VoiceStateManager: 0,
        GuildScheduledEventManager: 0,
        GuildInviteManager: 0,
        GuildBanManager: 0,
    });
}
