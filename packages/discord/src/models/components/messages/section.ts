import type {
    APISectionComponent,
} from "discord-api-types/v10";
import {
    ComponentType,
    SECTION_ACCESSORY_TYPES,
} from "../../../types/components";
import { assertCount } from "../../../utils/validation";
import { Component } from "../base";
import { TextDisplay } from "./text";

export class Section extends Component {
    public readonly type = ComponentType.Section;

    private textComponents: TextDisplay[] = [];
    private accessoryComponent?: Component;

    public setText(text: TextDisplay | string): this {
        this.textComponents = [normalizeText(text)];
        return this;
    }

    public addText(text: TextDisplay | string): this {
        this.textComponents.push(normalizeText(text));
        return this;
    }

    public setAccessory(accessory: Component): this {
        this.accessoryComponent = accessory;
        return this;
    }

    public toJSON(): APISectionComponent {
        assertCount(this.textComponents, 1, 3, "Section text components");
        if (!this.accessoryComponent) throw new Error("Section requires setAccessory().");
        if (!SECTION_ACCESSORY_TYPES.has(this.accessoryComponent.type)) {
            throw new Error(
                `Component type ${this.accessoryComponent.type} cannot be a Section accessory (use Button or Thumbnail).`
            );
        }

        return {
            ...this.baseJSON(),
            type: this.type,
            components: this.textComponents.map((text) => text.toJSON()) as APISectionComponent["components"],
            accessory: this.accessoryComponent.toJSON() as APISectionComponent["accessory"],
        } as APISectionComponent;
    }
}

function normalizeText(text: TextDisplay | string): TextDisplay {
    return typeof text === "string" ? new TextDisplay(text) : text;
}
