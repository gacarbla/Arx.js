import { ComponentType } from "../../../../types/components";
import {
    assertCustomId,
    assertMaxLength,
    assertRange,
} from "../../../../utils/validation";
import { Component } from "../../base";

export abstract class BaseSelect extends Component {
    public abstract readonly type: ComponentType;

    protected customId?: string;
    protected placeholder?: string;
    protected minValues?: number;
    protected maxValues?: number;
    protected disabled = false;
    protected required?: boolean;

    protected setCustomIdBase(customId: string): void {
        this.customId = assertCustomId(customId);
    }

    protected setPlaceholderBase(placeholder: string): void {
        this.placeholder = assertMaxLength(placeholder, 150, "Select placeholder");
    }

    public setMinValues(minValues: number): this {
        this.minValues = assertRange(minValues, 0, 25, "Select minValues");
        return this;
    }

    public setMaxValues(maxValues: number): this {
        this.maxValues = assertRange(maxValues, 1, 25, "Select maxValues");
        return this;
    }

    public setDisabled(disabled = true): this {
        this.disabled = disabled;
        return this;
    }

    /** Only meaningful inside a modal. */
    public setRequired(required = true): this {
        this.required = required;
        return this;
    }

    protected getBaseJSON(): Record<string, unknown> {
        if (!this.customId) throw new Error("Select menus require setCustomId().");
        if (this.minValues !== undefined && this.maxValues !== undefined && this.minValues > this.maxValues) {
            throw new RangeError("Select minValues cannot be greater than maxValues.");
        }

        const payload: Record<string, unknown> = {
            ...this.baseJSON(),
            custom_id: this.customId,
        };

        if (this.placeholder) payload.placeholder = this.placeholder;
        if (this.minValues !== undefined) payload.min_values = this.minValues;
        if (this.maxValues !== undefined) payload.max_values = this.maxValues;
        if (this.disabled) payload.disabled = true;
        if (this.required !== undefined) payload.required = this.required;

        return payload;
    }
}
