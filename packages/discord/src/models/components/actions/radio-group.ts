import type { APIRadioGroupComponent } from "discord-api-types/v10";
import {
    ComponentType,
    type RadioGroupOption,
} from "../../../types/components";
import {
    assertCount,
    assertCustomId,
    assertMaxLength,
    assertMinLength,
} from "../../../utils/validation";
import { Component } from "../base";

/** Single-choice radio group for modals (component type 21). */
export class RadioGroup extends Component {
    public readonly type = ComponentType.RadioGroup;

    private customId?: string;
    private options: RadioGroupOption[] = [];
    private required = true;

    public setCustomId(customId: string): this {
        this.customId = assertCustomId(customId);
        return this;
    }

    public addOption(option: RadioGroupOption): this {
        this.options.push(option);
        return this;
    }

    public addOptions(options: readonly RadioGroupOption[]): this {
        this.options.push(...options);
        return this;
    }

    public setRequired(required = true): this {
        this.required = required;
        return this;
    }

    public toJSON(): APIRadioGroupComponent {
        if (!this.customId) throw new Error("RadioGroup requires setCustomId().");
        assertCount(this.options, 2, 10, "RadioGroup options");

        return {
            ...this.baseJSON(),
            type: this.type,
            custom_id: this.customId,
            required: this.required,
            options: this.options.map((option) => ({
                label: assertMinLength(option.label, 1, 100, "Radio option label"),
                value: assertMinLength(option.value, 1, 100, "Radio option value"),
                ...(option.description !== undefined
                    ? { description: assertMaxLength(option.description, 100, "Radio option description") }
                    : {}),
                ...(option.default !== undefined ? { default: option.default } : {}),
            })),
        } as APIRadioGroupComponent;
    }
}
