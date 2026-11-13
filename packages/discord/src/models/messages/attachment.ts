export interface AttachmentData {
    id: string;
    filename: string;
    size: number;
    url: string;
    proxyUrl: string;
    contentType?: string | null;
    height?: number | null;
    width?: number | null;
    description?: string | null;
    ephemeral?: boolean;
}

export class Attachment {
    readonly id: string;
    readonly filename: string;
    readonly size: number;
    readonly url: string;
    readonly proxyUrl: string;
    readonly contentType?: string | null;
    readonly height?: number | null;
    readonly width?: number | null;
    readonly description?: string | null;
    readonly ephemeral: boolean;

    constructor(data: AttachmentData) {
        this.id = data.id;
        this.filename = data.filename;
        this.size = data.size;
        this.url = data.url;
        this.proxyUrl = data.proxyUrl;
        this.contentType = data.contentType ?? null;
        this.height = data.height ?? null;
        this.width = data.width ?? null;
        this.description = data.description ?? null;
        this.ephemeral = Boolean(data.ephemeral);

        Object.freeze(this);
    }

    get isImage(): boolean {
        return Boolean(this.contentType?.startsWith("image/"));
    }

    get isVideo(): boolean {
        return Boolean(this.contentType?.startsWith("video/"));
    }

    get isAudio(): boolean {
        return Boolean(this.contentType?.startsWith("audio/"));
    }

    get sizeInKB(): number {
        return Math.round((this.size / 1024) * 100) / 100;
    }

    get sizeInMB(): number {
        return Math.round((this.size / (1024 * 1024)) * 100) / 100;
    }

    toJSON(): AttachmentData {
        return {
            id: this.id,
            filename: this.filename,
            size: this.size,
            url: this.url,
            proxyUrl: this.proxyUrl,
            contentType: this.contentType,
            height: this.height,
            width: this.width,
            description: this.description,
            ephemeral: this.ephemeral
        };
    }
}