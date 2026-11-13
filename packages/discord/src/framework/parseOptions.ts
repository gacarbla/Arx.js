import type { APIInteractionDataResolved } from "discord-api-types/v10";
import { ApplicationCommandOptionType } from "../types/components";

export interface FocusedOption {
    name: string;
    value: string | number;
    type: number;
}

export interface ParsedInteractionOptions {
    group?: string;
    subcommand?: string;
    values: Record<string, unknown>;
    resolved: APIInteractionDataResolved;
    focused?: FocusedOption;
}

/**
 * Flattens a chat input interaction into group/subcommand names and a map of
 * option values. The raw payload remains the source of truth for resolved
 * entities.
 */
export function parseInteractionOptions(rawInteraction: any): ParsedInteractionOptions {
    const data = rawInteraction?.data ?? {};
    let options: any[] = Array.isArray(data.options) ? data.options : [];

    let group: string | undefined;
    let subcommand: string | undefined;

    if (options[0]?.type === ApplicationCommandOptionType.SubcommandGroup) {
        group = options[0].name;
        options = Array.isArray(options[0].options) ? options[0].options : [];
    }

    if (options[0]?.type === ApplicationCommandOptionType.Subcommand) {
        subcommand = options[0].name;
        options = Array.isArray(options[0].options) ? options[0].options : [];
    }

    const values: Record<string, unknown> = {};
    let focused: FocusedOption | undefined;

    for (const option of options) {
        values[option.name] = option.value;

        if (option.focused) {
            focused = {
                name: option.name,
                value: option.value,
                type: option.type,
            };
        }
    }

    return {
        group,
        subcommand,
        values,
        resolved: data.resolved ?? {},
        focused,
    };
}
