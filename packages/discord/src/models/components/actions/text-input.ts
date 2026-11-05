import type { APITextInputComponent } from "discord-api-types/v10";
import {
    ComponentType,
    TextInputStyleValue,
    type TextInputStyle,
} from "../../../types/components";
import {
    assertCustomId,
    assertMaxLength,
    assertRange,
} from "../../../utils/validation";
import { Component } from "../base";

export class TextInput extends Component {
    public readonly type = ComponentType.TextInput;

    private customId?: string;
    private label?: string;
    private style: number = TextInputStyleValue.Short;
    private placeholder?: string;
    private value?: string;
    private minLength?: number;
    private maxLength?: number;
    private required = true;

    public setCustomId(customId: string): this {
        this.customId = assertCustomId(customId);
        return this;
    }

    public setLabel(label: string): this {
        this.label = assertMaxLength(label, 45, "Text input label");
        return this;
    }

    public setStyle(style: TextInputStyle): this {
        this.style = TextInputStyleValue[style];
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.placeholder = assertMaxLength(placeholder, 100, "Text input placeholder");
        return this;
    }

    public setValue(value: string): this {
        this.value = assertMaxLength(value, 4000, "Text input value");
        return this;
    }

    public setMinLength(minLength: number): this {
        this.minLength = assertRange(minLength, 0, 4000, "Text input minLength");
        return this;
    }

    public setMaxLength(maxLength: number): this {
        this.maxLength = assertRange(maxLength, 1, 4000, "Text input maxLength");
        return this;
    }

    public setRequired(required = true): this {
        this.required = required;
        return this;
    }

    public toJSON(): APITextInputComponent {
        if (!this.customId) throw new Error("TextInput requires setCustomId().");
        if (this.minLength !== undefined && this.maxLength !== undefined && this.minLength > this.maxLength) {
            throw new RangeError("TextInput minLength cannot be greater than maxLength.");
        }

        const payload: APITextInputComponent = {
            ...this.baseJSON(),
            type: this.type,
            custom_id: this.customId,
            style: this.style,
            required: this.required,
        };

        if (this.label) payload.label = this.label;
        if (this.placeholder) payload.placeholder = this.placeholder;
        if (this.value) payload.value = this.value;
        if (this.minLength !== undefined) payload.min_length = this.minLength;
        if (this.maxLength !== undefined) payload.max_length = this.maxLength;

        return payload;
    }
}
