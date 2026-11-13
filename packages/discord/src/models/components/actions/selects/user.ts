import type { APIUserSelectComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../../types/components";
import { BaseSelect } from "./base";

export class UserSelect extends BaseSelect {
    public readonly type = ComponentType.UserSelect;

    public setCustomId(customId: string): this {
        this.setCustomIdBase(customId);
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.setPlaceholderBase(placeholder);
        return this;
    }

    public toJSON(): APIUserSelectComponent {
        return {
            ...this.getBaseJSON(),
            type: this.type,
        } as APIUserSelectComponent;
    }
}
