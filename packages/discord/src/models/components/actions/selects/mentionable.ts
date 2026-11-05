import type { APIMentionableSelectComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../../types/components";
import { BaseSelect } from "./base";

export class MentionableSelect extends BaseSelect {
    public readonly type = ComponentType.MentionableSelect;

    public setCustomId(customId: string): this {
        this.setCustomIdBase(customId);
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.setPlaceholderBase(placeholder);
        return this;
    }

    public toJSON(): APIMentionableSelectComponent {
        return {
            ...this.getBaseJSON(),
            type: this.type,
        } as APIMentionableSelectComponent;
    }
}
