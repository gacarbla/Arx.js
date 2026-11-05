import type { APIChannelSelectComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../../types/components";
import type { ChannelType } from "../../../../types/channels";
import { BaseSelect } from "./base";

export class ChannelSelect extends BaseSelect {
    public readonly type = ComponentType.ChannelSelect;

    private channelTypes: ChannelType[] = [];

    public setCustomId(customId: string): this {
        this.setCustomIdBase(customId);
        return this;
    }

    public setPlaceholder(placeholder: string): this {
        this.setPlaceholderBase(placeholder);
        return this;
    }

    public setChannelTypes(types: readonly ChannelType[]): this {
        this.channelTypes = [...types];
        return this;
    }

    public addChannelType(type: ChannelType): this {
        this.channelTypes.push(type);
        return this;
    }

    public toJSON(): APIChannelSelectComponent {
        const payload = {
            ...this.getBaseJSON(),
            type: this.type,
        } as APIChannelSelectComponent;

        if (this.channelTypes.length > 0) {
            payload.channel_types = [...this.channelTypes];
        }

        return payload;
    }
}
