import type { APIFileComponent } from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import { Component } from "../base";

export class File extends Component {
    public readonly type = ComponentType.File;

    private url?: string;
    private spoiler = false;

    /** `url` must use the `attachment://<filename>` syntax. */
    public setFile(url: string): this {
        if (!url.startsWith("attachment://")) {
            throw new Error('File components require an attachment reference ("attachment://<filename>").');
        }
        this.url = url;
        return this;
    }

    public setSpoiler(spoiler = true): this {
        this.spoiler = spoiler;
        return this;
    }

    public toJSON(): APIFileComponent {
        if (!this.url) throw new Error("File requires setFile().");

        const payload: APIFileComponent = {
            ...this.baseJSON(),
            type: this.type,
            file: { url: this.url },
        };

        if (this.spoiler) payload.spoiler = true;

        return payload;
    }
}
