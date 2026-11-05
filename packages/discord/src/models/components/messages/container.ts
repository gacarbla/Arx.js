import type { APIContainerComponent } from "discord-api-types/v10";
import {
    CONTAINER_CHILD_TYPES,
    ComponentType,
} from "../../../types/components";
import {
    assertCount,
    assertRange,
} from "../../../utils/validation";
import { Component } from "../base";

export class Container extends Component {
    public readonly type = ComponentType.Container;

    private accentColor?: number;
    private spoiler = false;
    private components: Component[] = [];

    public setAccentColor(color: number): this {
        this.accentColor = assertRange(color, 0x000000, 0xffffff, "Container accent color");
        return this;
    }

    public setSpoiler(spoiler = true): this {
        this.spoiler = spoiler;
        return this;
    }

    public addComponent(component: Component): this {
        this.components.push(component);
        return this;
    }

    public addComponents(components: readonly Component[]): this {
        this.components.push(...components);
        return this;
    }

    public setComponents(components: readonly Component[]): this {
        this.components = [...components];
        return this;
    }

    public toJSON(): APIContainerComponent {
        assertCount(this.components, 1, 10, "Container components");

        for (const component of this.components) {
            if (!CONTAINER_CHILD_TYPES.has(component.type)) {
                throw new Error(`Component type ${component.type} cannot be placed inside a Container.`);
            }
        }

        const payload: APIContainerComponent = {
            ...this.baseJSON(),
            type: this.type,
            components: this.components.map((component) => component.toJSON()) as APIContainerComponent["components"],
        };

        if (this.accentColor !== undefined) payload.accent_color = this.accentColor;
        if (this.spoiler) payload.spoiler = true;

        return payload;
    }
}
