import type { APICheckboxComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import { assertCustomId } from "../../../utils/validation";
import { Component } from "../base";

/**
 * Single checkbox for binary choices.
 *
 * Only valid inside a modal `Label` (component type 18).
 */
export class Checkbox extends Component {
    public readonly type = ComponentType.Checkbox;

    private customId?: string;
    private selectedByDefault = false;

    public setCustomId(customId: string): this {
        this.customId = assertCustomId(customId);
        return this;
    }

    public setDefault(selected = true): this {
        this.selectedByDefault = selected;
        return this;
    }

    public toJSON(): APICheckboxComponent {
        if (!this.customId) throw new Error("Checkbox requires setCustomId().");

        return {
            ...this.baseJSON(),
            type: this.type,
            custom_id: this.customId,
            default: this.selectedByDefault,
        } as APICheckboxComponent;
    }
}
