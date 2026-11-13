import type {
    APIEmbed,
    APIEmbedField,
} from "discord-api-types/v10";
import {
    assertMaxLength,
    assertMediaUrl,
    assertRange,
    assertUrl,
} from "../../utils/validation";

export interface EmbedAuthorOptions {
    name: string;
    url?: string;
    iconUrl?: string;
}

export interface EmbedFooterOptions {
    text: string;
    iconUrl?: string;
}

export interface EmbedFieldInput {
    name: string;
    value: string;
    inline?: boolean;
}

export class EmbedBuilder {
    private title?: string;
    private description?: string;
    private url?: string;
    private timestamp?: string;
    private color?: number;
    private footer?: APIEmbed["footer"];
    private image?: APIEmbed["image"];
    private thumbnail?: APIEmbed["thumbnail"];
    private author?: APIEmbed["author"];
    private fields: APIEmbedField[] = [];

    public setTitle(title: string): this {
        this.title = assertMaxLength(title, 256, "Embed title");
        return this;
    }

    public setDescription(description: string): this {
        this.description = assertMaxLength(description, 4096, "Embed description");
        return this;
    }

    public setURL(url: string): this {
        this.url = assertUrl(url, "Embed URL");
        return this;
    }

    public setTimestamp(timestamp?: Date | number | string | null): this {
        if (timestamp === null || timestamp === undefined) {
            this.timestamp = undefined;
            return this;
        }

        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        if (Number.isNaN(date.getTime())) {
            throw new TypeError("Embed timestamp is not a valid date.");
        }
        this.timestamp = date.toISOString();
        return this;
    }

    public setColor(color: number | string): this {
        this.color = parseColor(color);
        return this;
    }

    public setFooter(textOrOptions: string | EmbedFooterOptions, iconUrl?: string): this {
        const options: EmbedFooterOptions =
            typeof textOrOptions === "string" ? { text: textOrOptions, iconUrl } : textOrOptions;

        const footer: NonNullable<APIEmbed["footer"]> = {
            text: assertMaxLength(options.text, 2048, "Embed footer text"),
        };
        if (options.iconUrl) footer.icon_url = assertUrl(options.iconUrl, "Embed footer icon URL");

        this.footer = footer;
        return this;
    }

    public setImage(url: string): this {
        this.image = { url: assertMediaUrl(url, "Embed image URL") };
        return this;
    }

    public setThumbnail(url: string): this {
        this.thumbnail = { url: assertMediaUrl(url, "Embed thumbnail URL") };
        return this;
    }

    public setAuthor(options: EmbedAuthorOptions | string, iconUrl?: string): this {
        const authorOptions: EmbedAuthorOptions =
            typeof options === "string" ? { name: options, iconUrl } : options;

        const author: NonNullable<APIEmbed["author"]> = {
            name: assertMaxLength(authorOptions.name, 256, "Embed author name"),
        };
        if (authorOptions.url) author.url = assertUrl(authorOptions.url, "Embed author URL");
        if (authorOptions.iconUrl) author.icon_url = assertUrl(authorOptions.iconUrl, "Embed author icon URL");

        this.author = author;
        return this;
    }

    public addField(field: EmbedFieldInput): this {
        this.fields.push(normalizeField(field));
        return this;
    }

    public addFields(fields: readonly EmbedFieldInput[]): this {
        for (const field of fields) this.addField(field);
        return this;
    }

    public setFields(fields: readonly EmbedFieldInput[]): this {
        this.fields = fields.map(normalizeField);
        return this;
    }

    public clearFields(): this {
        this.fields = [];
        return this;
    }

    public toJSON(): APIEmbed {
        if (this.fields.length > 25) {
            throw new RangeError(`Embeds support at most 25 fields (received ${this.fields.length}).`);
        }

        const payload: APIEmbed = {};
        if (this.title !== undefined) payload.title = this.title;
        if (this.description !== undefined) payload.description = this.description;
        if (this.url !== undefined) payload.url = this.url;
        if (this.timestamp !== undefined) payload.timestamp = this.timestamp;
        if (this.color !== undefined) payload.color = this.color;
        if (this.footer !== undefined) payload.footer = this.footer;
        if (this.image !== undefined) payload.image = this.image;
        if (this.thumbnail !== undefined) payload.thumbnail = this.thumbnail;
        if (this.author !== undefined) payload.author = this.author;
        if (this.fields.length > 0) payload.fields = this.fields;

        const totalLength =
            (this.title?.length ?? 0) +
            (this.description?.length ?? 0) +
            (this.footer?.text.length ?? 0) +
            (this.author?.name.length ?? 0) +
            this.fields.reduce((sum, field) => sum + field.name.length + field.value.length, 0);

        if (totalLength > 6000) {
            throw new RangeError(`Embed total length must be at most 6000 characters (received ${totalLength}).`);
        }

        return payload;
    }
}

function normalizeField(field: EmbedFieldInput): APIEmbedField {
    return {
        name: assertMaxLength(field.name, 256, "Embed field name"),
        value: assertMaxLength(field.value, 1024, "Embed field value"),
        inline: field.inline ?? false,
    };
}

function parseColor(color: number | string): number {
    if (typeof color === "number") {
        return assertRange(color, 0x000000, 0xffffff, "Embed color");
    }

    const hex = color.replace(/^#/, "").replace(/^0x/i, "");
    if (!/^[0-9a-f]{6}$/i.test(hex)) {
        throw new TypeError(`Embed color "${color}" must be a #RRGGBB string or a number.`);
    }
    return Number.parseInt(hex, 16);
}
