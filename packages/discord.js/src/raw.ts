import type {
    APIChannel,
    APIGuild,
    APIGuildMember,
    APIInteraction,
    APIMessage,
    APIRole,
    APIUser,
} from "discord-api-types/v10";

/**
 * Reconstructs a Discord API interaction from a discord.js interaction.
 *
 * discord.js does not expose the original raw payload, so the bridge rebuilds
 * the minimal shape consumed by the ARX contexts (ids, member/user, data
 * options and resolved entities).
 */
export function toRawInteraction(native: any): APIInteraction {
    const data = rawInteractionData(native);

    return {
        id: native.id,
        application_id: native.applicationId,
        type: native.type,
        token: native.token,
        guild_id: native.guildId ?? null,
        channel_id: native.channelId ?? null,
        member: native.member ? toRawMember(native.member) : undefined,
        user: native.user ? toRawUser(native.user) : undefined,
        locale: native.locale,
        guild_locale: native.guildLocale ?? null,
        data,
        version: native.version,
        app_permissions: native.appPermissions?.bitfield?.toString(),
    } as unknown as APIInteraction;
}

function rawInteractionData(native: any): Record<string, unknown> {
    if (native.isChatInputCommand?.() || native.isAutocomplete?.()) {
        return {
            id: native.commandId,
            name: native.commandName,
            type: native.commandType,
            guild_id: native.commandGuildId ?? undefined,
            options: rawOptions(native.options?.data),
            resolved: rawResolved(native.options?.resolved),
        };
    }

    if (native.isContextMenuCommand?.()) {
        return {
            id: native.commandId,
            name: native.commandName,
            type: native.commandType,
            guild_id: native.commandGuildId ?? undefined,
            target_id: native.targetId,
            resolved: rawResolved(native.options?.resolved),
        };
    }

    if (native.isMessageComponent?.()) {
        return {
            custom_id: native.customId,
            component_type: native.componentType,
            values: native.values,
        };
    }

    if (native.isModalSubmit?.()) {
        return {
            custom_id: native.customId,
            components: rawModalFields(native),
        };
    }

    return {};
}

function rawOptions(options: any): unknown[] {
    if (!Array.isArray(options)) return [];

    return options.map((option) => ({
        name: option.name,
        type: option.type,
        value: option.value,
        options: rawOptions(option.options),
        focused: option.focused,
    }));
}

function rawResolved(resolved: any): Record<string, unknown> {
    if (!resolved) return {};

    return {
        users: mapCollection(resolved.users, toRawUser),
        members: mapCollection(resolved.members, toRawMember),
        channels: mapCollection(resolved.channels, toRawChannel),
        roles: mapCollection(resolved.roles, toRawRole),
        attachments: mapCollection(resolved.attachments, (attachment: any) =>
            typeof attachment?.toJSON === "function" ? attachment.toJSON() : attachment
        ),
    };
}

function rawModalFields(native: any): unknown[] {
    const fields = native.fields?.fields;
    if (!fields) return [];

    return [...fields.values()].map((field: any) => ({
        type: field.type,
        custom_id: field.customId,
        value: field.value,
        values: field.values,
    }));
}

export function toRawUser(user: any): APIUser | undefined {
    if (!user) return undefined;

    return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator ?? "0",
        global_name: user.globalName ?? user.global_name ?? null,
        avatar: user.avatar ?? null,
        bot: Boolean(user.bot),
        system: Boolean(user.system),
    };
}

export function toRawMember(member: any): APIGuildMember | undefined {
    if (!member) return undefined;

    const user = toRawUser(member.user ?? member);
    if (!user) return undefined;

    const roles = Array.isArray(member.roles)
        ? member.roles
        : [...(member.roles?.cache?.keys?.() ?? [])];

    return {
        user,
        nick: member.nickname ?? member.nick ?? null,
        roles,
        joined_at: toIso(member.joinedAt ?? member.joined_at),
        premium_since: toIso(member.premiumSince ?? member.premium_since),
        deaf: Boolean(member.deaf),
        mute: Boolean(member.mute),
        pending: Boolean(member.pending),
        flags: member.flags ?? 0,
    };
}

export function toRawChannel(channel: any): APIChannel | undefined {
    if (!channel) return undefined;

    return {
        id: channel.id,
        type: channel.type,
        name: channel.name ?? undefined,
        guild_id: channel.guildId ?? channel.guild_id ?? channel.guild?.id,
        parent_id: channel.parentId ?? channel.parent_id ?? null,
        topic: channel.topic ?? null,
        nsfw: Boolean(channel.nsfw),
        position: channel.position ?? 0,
    } as unknown as APIChannel;
}

export function toRawRole(role: any): APIRole | undefined {
    if (!role) return undefined;

    return {
        id: role.id,
        name: role.name,
        color: role.color,
        hoist: Boolean(role.hoist),
        position: role.position ?? 0,
        permissions:
            typeof role.permissions === "object"
                ? role.permissions.bitfield?.toString()
                : String(role.permissions ?? "0"),
        managed: Boolean(role.managed),
        mentionable: Boolean(role.mentionable),
        icon: role.icon ?? null,
        unicode_emoji: role.unicodeEmoji ?? role.unicode_emoji ?? null,
    } as APIRole;
}

export function toRawGuild(guild: any): APIGuild | undefined {
    if (!guild) return undefined;

    const channels = guild.channels?.cache
        ? [...guild.channels.cache.values()].map(toRawChannel).filter(Boolean)
        : [];
    const roles = guild.roles?.cache
        ? [...guild.roles.cache.values()].map(toRawRole).filter(Boolean)
        : [];

    return {
        id: guild.id,
        name: guild.name,
        icon: guild.icon ?? null,
        owner_id: guild.ownerId ?? guild.owner_id ?? null,
        description: guild.description ?? null,
        member_count: guild.memberCount ?? guild.member_count ?? 0,
        channels,
        roles,
    } as unknown as APIGuild;
}

export function toRawMessage(message: any): APIMessage | undefined {
    if (!message) return undefined;

    const payload: Record<string, any> = {
        id: message.id,
        channel_id: message.channelId ?? message.channel_id,
        guild_id: message.guildId ?? message.guild_id,
    };

    if (message.content !== undefined) payload.content = message.content;

    const author = toRawUser(message.author);
    if (author) payload.author = author;

    const member = message.member ? toRawMember(message.member) : undefined;
    if (member) payload.member = member;

    const timestamp = toIso(message.createdAt ?? message.timestamp);
    if (timestamp) payload.timestamp = timestamp;

    const editedTimestamp = toIso(message.editedAt ?? message.edited_timestamp);
    if (editedTimestamp) payload.edited_timestamp = editedTimestamp;

    if (message.pinned !== undefined) payload.pinned = Boolean(message.pinned);
    if (message.tts !== undefined) payload.tts = Boolean(message.tts);
    if (message.type !== undefined) payload.type = message.type;
    if (message.flags !== undefined) {
        payload.flags = typeof message.flags === "object" ? message.flags.bitfield : message.flags;
    }
    if (message.webhookId !== undefined) payload.webhook_id = message.webhookId;
    if (message.applicationId !== undefined) payload.application_id = message.applicationId;

    if (message.attachments !== undefined) {
        payload.attachments = [...message.attachments.values()].map((attachment: any) => ({
            id: attachment.id,
            filename: attachment.name,
            size: attachment.size,
            url: attachment.url,
            proxy_url: attachment.proxyURL,
            content_type: attachment.contentType,
            height: attachment.height,
            width: attachment.width,
            description: attachment.description,
            ephemeral: Boolean(attachment.ephemeral),
        }));
    }

    if (message.embeds !== undefined) {
        payload.embeds = message.embeds.map((embed: any) =>
            typeof embed.toJSON === "function" ? embed.toJSON() : embed
        );
    }

    if (message.components !== undefined) {
        payload.components = message.components.map((component: any) =>
            typeof component.toJSON === "function" ? component.toJSON() : component
        );
    }

    if (message.mentions !== undefined) {
        payload.mentions = message.mentions.users
            ? [...message.mentions.users.values()].map(toRawUser).filter(Boolean)
            : [];
        payload.mention_roles = message.mentions.roles
            ? [...message.mentions.roles.keys()]
            : [];
        payload.mention_everyone = Boolean(message.mentions.everyone);
    }

    if (message.reference !== undefined) {
        payload.message_reference = message.reference
            ? {
                  message_id: message.reference.messageId,
                  channel_id: message.reference.channelId,
                  guild_id: message.reference.guildId,
              }
            : null;
    }

    return payload as unknown as APIMessage;
}



function mapCollection<T>(
    collection: any,
    mapper: (value: any) => T | undefined
): Record<string, T> {
    const result: Record<string, T> = {};
    if (!collection) return result;

    for (const [key, value] of collection.entries()) {
        const mapped = mapper(value);
        if (mapped !== undefined) result[key] = mapped;
    }

    return result;
}

function toIso(value: any): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") return value;
    return null;
}


