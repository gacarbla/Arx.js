import type { APICheckboxGroupComponent } from "discord-api-types/v10";
import {
    ComponentType,
    type RadioGroupOption,
} from "../../../types/components";
import {
    assertCount,
    assertCustomId,
    assertMaxLength,
    assertMinLength,
    assertRange,
} from "../../../utils/validation";
import { Component } from "../base";

/** Multi-select checkbox group for modals (component type 22). */
export class CheckboxGroup extends Component {
    public readonly type = ComponentType.CheckboxGroup;

    private customId?: string;
    private options: RadioGroupOption[] = [];
    private minValues?: number;
    private maxValues?: number;
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

    public setMinValues(minValues: number): this {
        this.minValues = assertRange(minValues, 0, 10, "CheckboxGroup minValues");
        return this;
    }

    public setMaxValues(maxValues: number): this {
        this.maxValues = assertRange(maxValues, 1, 10, "CheckboxGroup maxValues");
        return this;
    }

    public setRequired(required = true): this {
        this.required = required;
        return this;
    }

    public toJSON(): APICheckboxGroupComponent {
        if (!this.customId) throw new Error("CheckboxGroup requires setCustomId().");
        assertCount(this.options, 1, 10, "CheckboxGroup options");
        if (this.minValues !== undefined && this.maxValues !== undefined && this.minValues > this.maxValues) {
            throw new RangeError("CheckboxGroup minValues cannot be greater than maxValues.");
        }

        const payload: APICheckboxGroupComponent = {
            ...this.baseJSON(),
            type: this.type,
            custom_id: this.customId,
            required: this.required,
            options: this.options.map((option) => ({
                label: assertMinLength(option.label, 1, 100, "Checkbox option label"),
                value: assertMinLength(option.value, 1, 100, "Checkbox option value"),
                ...(option.description !== undefined
                    ? { description: assertMaxLength(option.description, 100, "Checkbox option description") }
                    : {}),
                ...(option.default !== undefined ? { default: option.default } : {}),
            })),
        };

        if (this.minValues !== undefined) payload.min_values = this.minValues;
        if (this.maxValues !== undefined) payload.max_values = this.maxValues;

        return payload;
    }
}
