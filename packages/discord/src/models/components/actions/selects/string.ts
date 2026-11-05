import type { APIStringSelectComponent } from "discord-api-types/v10";
import { ComponentType, type SelectOption } from "../../../../types/components";
import {
    assertCount,
    assertMaxLength,
    assertMinLength,
} from "../../../../utils/validation";
import { BaseSelect } from "./base";

export class StringSelect extends BaseSelect {
    public readonly type = ComponentType.StringSelect;

    private options: SelectOption[] = [];

    public setCustomId(customId: string): this {
        this.setCustomIdBase(customId);
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.setPlaceholderBase(placeholder);
        return this;
    }

    public addOption(option: SelectOption): this {
        this.options.push(option);
        return this;
    }

    public addOptions(options: readonly SelectOption[]): this {
        this.options.push(...options);
        return this;
    }

    public setOptions(options: readonly SelectOption[]): this {
        this.options = [...options];
        return this;
    }

    public toJSON(): APIStringSelectComponent {
        assertCount(this.options, 1, 25, "String select options");

        return {
            ...this.getBaseJSON(),
            type: this.type,
            options: this.options.map((option) => ({
                label: assertMinLength(option.label, 1, 100, "Select option label"),
                value: assertMinLength(option.value, 1, 100, "Select option value"),
                ...(option.description !== undefined
                    ? { description: assertMaxLength(option.description, 100, "Select option description") }
                    : {}),
                ...(option.emoji ? { emoji: normalizeEmoji(option.emoji) } : {}),
                ...(option.default !== undefined ? { default: option.default } : {}),
            })),
        } as APIStringSelectComponent;
    }
}

function normalizeEmoji(emoji: NonNullable<SelectOption["emoji"]>): {
    id?: string;
    name?: string;
    animated?: boolean;
} {
    if (!emoji.id && !emoji.name) {
        throw new Error("Select option emoji requires an id or a name.");
    }
    return {
        ...(emoji.id ? { id: emoji.id } : {}),
        ...(emoji.name ? { name: emoji.name } : {}),
        ...(emoji.animated ? { animated: true } : {}),
    };
}
