import type { APITextDisplayComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import { assertMinLength } from "../../../utils/validation";
import { Component } from "../base";

export class TextDisplay extends Component {
    public readonly type = ComponentType.TextDisplay;

    private content = "";

    constructor(content?: string) {
        super();
        if (content !== undefined) this.setContent(content);
    }

    public setContent(content: string): this {
        this.content = assertMinLength(content, 1, 4000, "TextDisplay content");
        return this;
    }

    public toJSON(): APITextDisplayComponent {
        if (!this.content) throw new Error("TextDisplay requires setContent().");

        return {
            ...this.baseJSON(),
            type: this.type,
            content: this.content,
        } as APITextDisplayComponent;
    }
}
