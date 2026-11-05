import type { CacheStore } from "./CacheStore";

/** Key used by the member cache. */
export function memberKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

/** Key used by the role cache. */
export function roleKey(guildId: string, roleId: string): string {
    return `${guildId}:${roleId}`;
}

/** Key used by the message cache. */
export function messageKey(channelId: string, messageId: string): string {
    return `${channelId}:${messageId}`;
}

/** Key used by the presence cache. */
export function presenceKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

/**
 * Applies a gateway dispatch to the cache.
 *
 * Every `set` is a no-op when the corresponding cache collection is disabled,
 * so this function is safe to call for every event.
 */
export function applyDispatch(cache: CacheStore, event: string, data: any): void {
    if (!data || typeof data !== "object") return;

    switch (event) {
        case "GUILD_CREATE":
        case "GUILD_UPDATE": {
            if (!data.id) return;
            setMerged(cache.guilds, data.id, data);

            for (const role of data.roles ?? []) {
                if (role?.id) setMerged(cache.roles, roleKey(data.id, role.id), role);
            }
            for (const channel of data.channels ?? []) {
                if (channel?.id) setMerged(cache.channels, channel.id, channel);
            }
            for (const member of data.members ?? []) {
                if (member?.user?.id) {
                    setMerged(cache.members, memberKey(data.id, member.user.id), member);
                    cacheUser(cache, member.user);
                }
            }
            break;
        }

        case "GUILD_DELETE": {
            if (data.id) cache.guilds.delete(data.id);
            break;
        }

        case "CHANNEL_CREATE":
        case "CHANNEL_UPDATE":
        case "THREAD_CREATE":
        case "THREAD_UPDATE": {
            if (data.id) setMerged(cache.channels, data.id, data);
            break;
        }

        case "CHANNEL_DELETE":
        case "THREAD_DELETE": {
            if (data.id) cache.channels.delete(data.id);
            break;
        }

        case "GUILD_ROLE_CREATE":
        case "GUILD_ROLE_UPDATE": {
            const role = data.role;
            if (data.guild_id && role?.id) {
                setMerged(cache.roles, roleKey(data.guild_id, role.id), role);
            }
            break;
        }

        case "GUILD_ROLE_DELETE": {
            if (data.guild_id && data.role_id) {
                cache.roles.delete(roleKey(data.guild_id, data.role_id));
            }
            break;
        }

        case "GUILD_MEMBER_ADD":
        case "GUILD_MEMBER_UPDATE": {
            if (data.guild_id && data.user?.id) {
                setMerged(cache.members, memberKey(data.guild_id, data.user.id), data);
                cacheUser(cache, data.user);
            }
            break;
        }

        case "GUILD_MEMBER_REMOVE": {
            if (data.guild_id && data.user?.id) {
                cache.members.delete(memberKey(data.guild_id, data.user.id));
            }
            break;
        }

        case "GUILD_MEMBERS_CHUNK": {
            for (const member of data.members ?? []) {
                if (data.guild_id && member?.user?.id) {
                    setMerged(cache.members, memberKey(data.guild_id, member.user.id), member);
                    cacheUser(cache, member.user);
                }
            }
            break;
        }

        case "MESSAGE_CREATE":
        case "MESSAGE_UPDATE": {
            if (data.channel_id && data.id) {
                setMerged(cache.messages, messageKey(data.channel_id, data.id), data);
            }
            if (data.author) cacheUser(cache, data.author);
            if (data.member?.user) cacheUser(cache, data.member.user);
            break;
        }

        case "MESSAGE_DELETE": {
            if (data.channel_id && data.id) {
                cache.messages.delete(messageKey(data.channel_id, data.id));
            }
            break;
        }

        case "PRESENCE_UPDATE": {
            if (data.guild_id && data.user?.id) {
                setMerged(cache.presences, presenceKey(data.guild_id, data.user.id), data);
                cacheUser(cache, data.user);
            }
            break;
        }

        default:
            break;
    }
}

function cacheUser(cache: CacheStore, user: { id?: string }): void {
    if (user?.id) cache.users.set(user.id, user as any);
}

function setMerged(
    map: { get(key: string): any; set(key: string, value: any): unknown },
    key: string,
    value: any
): void {
    const existing = map.get(key);
    map.set(key, existing ? { ...existing, ...value } : value);
}
