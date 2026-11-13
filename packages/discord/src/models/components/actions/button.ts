import type { APIButtonComponent } from "discord-api-types/v10";
import {
    ButtonStyleValue,
    ComponentType,
    type ButtonStyle,
} from "../../../types/components";
import { Emoji } from "../../emojis/emoji";
import { assertCustomId, assertMaxLength, assertUrl } from "../../../utils/validation";
import { Component } from "../base";

export class Button extends Component {
    public readonly type = ComponentType.Button;

    private customId?: string;
    private label?: string;
    private style: number = ButtonStyleValue.Primary;
    private url?: string;
    private skuId?: string;
    private emoji?: Emoji;
    private disabled = false;

    public setCustomId(customId: string): this {
        assertCustomId(customId);
        this.customId = customId;
        this.url = undefined;
        this.skuId = undefined;
        if (this.style === ButtonStyleValue.Link || this.style === ButtonStyleValue.Premium) {
            this.style = ButtonStyleValue.Primary;
        }
        return this;
    }

    public setLabel(label: string): this {
        this.label = assertMaxLength(label, 80, "Button label");
        return this;
    }

    public setStyle(style: ButtonStyle): this {
        this.style = ButtonStyleValue[style];
        return this;
    }

    /** Escape hatch for raw numeric styles. */
    public setStyleValue(style: number): this {
        if (!Number.isInteger(style) || style < 1 || style > 6) {
            throw new RangeError("Button style must be an integer between 1 and 6.");
        }
        this.style = style;
        return this;
    }

    public setUrl(url: string): this {
        this.url = assertUrl(url, "Button URL");
        this.style = ButtonStyleValue.Link;
        this.customId = undefined;
        this.skuId = undefined;
        return this;
    }

    public setSKUId(skuId: string): this {
        this.skuId = skuId;
        this.style = ButtonStyleValue.Premium;
        this.customId = undefined;
        this.url = undefined;
        return this;
    }

    public setEmoji(emoji: Emoji): this {
        this.emoji = emoji;
        return this;
    }

    public setDisabled(disabled = true): this {
        this.disabled = disabled;
        return this;
    }

    public toJSON(): APIButtonComponent {
        const payload: Record<string, unknown> = {
            ...this.baseJSON(),
            style: this.style,
        };

        if (this.label) payload.label = this.label;
        if (this.emoji) payload.emoji = this.emoji.toComponentJSON();
        if (this.disabled) payload.disabled = true;

        if (this.style === ButtonStyleValue.Link) {
            if (!this.url) throw new Error("Link buttons require setUrl().");
            payload.url = this.url;
        } else if (this.style === ButtonStyleValue.Premium) {
            if (!this.skuId) throw new Error("Premium buttons require setSKUId().");
            payload.sku_id = this.skuId;
        } else {
            if (!this.customId) throw new Error("Interactive buttons require setCustomId().");
            payload.custom_id = this.customId;
        }

        return payload as unknown as APIButtonComponent;
    }
}
