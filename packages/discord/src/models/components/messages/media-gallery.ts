import type {
    APIMediaGalleryComponent,
    APIMediaGalleryItem,
} from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import {
    assertCount,
    assertMaxLength,
    assertMediaUrl,
} from "../../../utils/validation";
import { Component } from "../base";

export interface MediaGalleryItemInput {
    url: string;
    description?: string;
    spoiler?: boolean;
}

export class MediaGallery extends Component {
    public readonly type = ComponentType.MediaGallery;

    private items: MediaGalleryItemInput[] = [];

    public addItem(item: MediaGalleryItemInput | string): this {
        this.items.push(typeof item === "string" ? { url: item } : item);
        return this;
    }

    public addItems(items: readonly (MediaGalleryItemInput | string)[]): this {
        for (const item of items) this.addItem(item);
        return this;
    }

    public setItems(items: readonly (MediaGalleryItemInput | string)[]): this {
        this.items = items.map((item) => (typeof item === "string" ? { url: item } : item));
        return this;
    }

    public toJSON(): APIMediaGalleryComponent {
        assertCount(this.items, 1, 10, "MediaGallery items");

        return {
            ...this.baseJSON(),
            type: this.type,
            items: this.items.map((item) => {
                const payload: APIMediaGalleryItem = {
                    media: { url: assertMediaUrl(item.url, "MediaGallery item URL") },
                };
                if (item.description !== undefined) {
                    payload.description = assertMaxLength(item.description, 1024, "MediaGallery item description");
                }
                if (item.spoiler) payload.spoiler = true;
                return payload;
            }),
        } as APIMediaGalleryComponent;
    }
}
