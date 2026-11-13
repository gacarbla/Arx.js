import type {
    APIActionRowComponent,
    APIComponentInMessageActionRow,
} from "discord-api-types/v10";
import {
    ComponentType,
    MESSAGE_ACTION_ROW_CHILD_TYPES,
} from "../../../types/components";
import { assertCount } from "../../../utils/validation";
import { Component } from "../base";

export class ActionRow extends Component {
    public readonly type = ComponentType.ActionRow;

    private components: Component[] = [];

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

    public toJSON(): APIActionRowComponent<APIComponentInMessageActionRow> {
        assertCount(this.components, 1, 5, "Action row components");

        const selectCount = this.components.filter(
            (component) =>
                component.type === ComponentType.StringSelect ||
                component.type === ComponentType.UserSelect ||
                component.type === ComponentType.RoleSelect ||
                component.type === ComponentType.MentionableSelect ||
                component.type === ComponentType.ChannelSelect
        ).length;

        if (selectCount > 1) {
            throw new Error("An action row can contain at most one select menu.");
        }
        if (selectCount === 1 && this.components.length > 1) {
            throw new Error("A select menu cannot share an action row with other components.");
        }

        for (const component of this.components) {
            if (!MESSAGE_ACTION_ROW_CHILD_TYPES.has(component.type)) {
                throw new Error(`Component type ${component.type} cannot be placed inside a message ActionRow.`);
            }
        }

        return {
            ...this.baseJSON(),
            type: this.type,
            components: this.components.map(
                (component) => component.toJSON()
            ) as APIComponentInMessageActionRow[],
        } as APIActionRowComponent<APIComponentInMessageActionRow>;
    }
}
