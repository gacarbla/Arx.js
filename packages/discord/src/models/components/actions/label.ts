import type { APILabelComponent } from "discord-api-types/v10";
import {
    ComponentType,
    LABEL_CHILD_TYPES,
} from "../../../types/components";
import {
    assertMaxLength,
    assertMinLength,
} from "../../../utils/validation";
import { Component } from "../base";

/**
 * Label wrapper for modal components (component type 18).
 *
 * Discord requires interactive modal components to be wrapped in a Label.
 */
export class Label extends Component {
    public readonly type = ComponentType.Label;

    private label = "";
    private description?: string;
    private component?: Component;

    public setLabel(label: string): this {
        this.label = assertMinLength(label, 1, 45, "Label text");
        return this;
    }

    public setDescription(description: string): this {
        this.description = assertMaxLength(description, 100, "Label description");
        return this;
    }

    public setComponent(component: Component): this {
        this.component = component;
        return this;
    }

    public toJSON(): APILabelComponent {
        if (!this.label) throw new Error("Label requires setLabel().");
        if (!this.component) throw new Error("Label requires setComponent().");
        if (!LABEL_CHILD_TYPES.has(this.component.type)) {
            throw new Error(`Component type ${this.component.type} cannot be placed inside a Label.`);
        }

        const payload: APILabelComponent = {
            ...this.baseJSON(),
            type: this.type,
            label: this.label,
            component: this.component.toJSON() as APILabelComponent["component"],
        };

        if (this.description) payload.description = this.description;

        return payload;
    }
}
