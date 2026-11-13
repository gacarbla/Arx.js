/** Discord gateway intents. */
export const Intents = {
    Guilds: 1 << 0,
    GuildMembers: 1 << 1,
    GuildModeration: 1 << 2,
    GuildEmojisAndStickers: 1 << 3,
    GuildIntegrations: 1 << 4,
    GuildWebhooks: 1 << 5,
    GuildInvites: 1 << 6,
    GuildVoiceStates: 1 << 7,
    GuildPresences: 1 << 8,
    GuildMessages: 1 << 9,
    GuildMessageReactions: 1 << 10,
    GuildMessageTyping: 1 << 11,
    DirectMessages: 1 << 12,
    DirectMessageReactions: 1 << 13,
    DirectMessageTyping: 1 << 14,
    MessageContent: 1 << 15,
    GuildScheduledEvents: 1 << 16,
    AutoModerationConfiguration: 1 << 20,
    AutoModerationExecution: 1 << 21,
    GuildPolls: 1 << 24,
    DirectMessagePolls: 1 << 25,
} as const;

export type IntentName = keyof typeof Intents;

/**
 * Converts a list of intent names into the bitfield Discord expects.
 *
 * @example
 * ```ts
 * resolveIntents(["Guilds", "GuildMessages", "MessageContent"]); // 33281
 * resolveIntents(513); // 513
 * ```
 */
export function resolveIntents(intents: number | readonly IntentName[]): number {
    if (typeof intents === "number") {
        if (!Number.isInteger(intents) || intents < 0) {
            throw new RangeError("Gateway intents must be a non-negative integer.");
        }
        return intents;
    }

    let bitfield = 0;
    for (const name of intents) {
        const value = Intents[name];
        if (value === undefined) {
            throw new Error(`Unknown gateway intent "${String(name)}".`);
        }
        bitfield |= value;
    }
    return bitfield;
}
