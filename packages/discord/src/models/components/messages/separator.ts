import type { APISeparatorComponent } from "discord-api-types/v10";
import {
    ComponentType,
    SeparatorSpacingValue,
    type SeparatorSpacing,
} from "../../../types/components";
import { Component } from "../base";

export class Separator extends Component {
    public readonly type = ComponentType.Separator;

    private divider = true;
    private spacing?: number;

    constructor(options: { divider?: boolean; spacing?: SeparatorSpacing } = {}) {
        super();
        if (options.divider !== undefined) this.divider = options.divider;
        if (options.spacing) this.spacing = SeparatorSpacingValue[options.spacing];
    }

    public setDivider(divider = true): this {
        this.divider = divider;
        return this;
    }

    public setSpacing(spacing: SeparatorSpacing): this {
        this.spacing = SeparatorSpacingValue[spacing];
        return this;
    }

    public toJSON(): APISeparatorComponent {
        const payload: APISeparatorComponent = {
            ...this.baseJSON(),
            type: this.type,
            divider: this.divider,
        };

        if (this.spacing !== undefined) payload.spacing = this.spacing as APISeparatorComponent["spacing"];

        return payload;
    }
}
