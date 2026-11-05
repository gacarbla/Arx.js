import type { APIRoleSelectComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../../types/components";
import { BaseSelect } from "./base";

export class RoleSelect extends BaseSelect {
    public readonly type = ComponentType.RoleSelect;

    public setCustomId(customId: string): this {
        this.setCustomIdBase(customId);
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.setPlaceholderBase(placeholder);
        return this;
    }

    public toJSON(): APIRoleSelectComponent {
        return {
            ...this.getBaseJSON(),
            type: this.type,
        } as APIRoleSelectComponent;
    }
}
