import type { APIThumbnailComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import {
    assertMaxLength,
    assertMediaUrl,
} from "../../../utils/validation";
import { Component } from "../base";

export class Thumbnail extends Component {
    public readonly type = ComponentType.Thumbnail;

    private url?: string;
    private description?: string | null;
    private spoiler = false;

    public setUrl(url: string): this {
        this.url = assertMediaUrl(url, "Thumbnail URL");
        return this;
    }

    public setMedia(url: string): this {
        return this.setUrl(url);
    }

    public setDescription(description: string | null): this {
        this.description = description === null ? null : assertMaxLength(description, 1024, "Thumbnail description");
        return this;
    }

    public setSpoiler(spoiler = true): this {
        this.spoiler = spoiler;
        return this;
    }

    public toJSON(): APIThumbnailComponent {
        if (!this.url) throw new Error("Thumbnail requires setUrl().");

        const payload: APIThumbnailComponent = {
            ...this.baseJSON(),
            type: this.type,
            media: { url: this.url },
        };

        if (this.description !== undefined) payload.description = this.description;
        if (this.spoiler) payload.spoiler = true;

        return payload;
    }
}
