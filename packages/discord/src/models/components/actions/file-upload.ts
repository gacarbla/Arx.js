import type { APIFileUploadComponent, FileUploadType } from "discord-api-types/v10";
import { ComponentType } from "../../../types/components";
import {
    assertCustomId,
    assertRange,
} from "../../../utils/validation";
import { Component } from "../base";

/** File upload input for modals (component type 19). */
export class FileUpload extends Component {
    public readonly type = ComponentType.FileUpload;

    private customId?: string;
    private minValues?: number;
    private maxValues?: number;
    private required = true;
    private fileTypes?: FileUploadType[];

    public setCustomId(customId: string): this {
        this.customId = assertCustomId(customId);
        return this;
    }

    public setMinValues(minValues: number): this {
        this.minValues = assertRange(minValues, 0, 10, "FileUpload minValues");
        return this;
    }

    public setMaxValues(maxValues: number): this {
        this.maxValues = assertRange(maxValues, 1, 10, "FileUpload maxValues");
        return this;
    }

    public setRequired(required = true): this {
        this.required = required;
        return this;
    }

    public setFileTypes(types: readonly FileUploadType[]): this {
        if (types.length > 10) throw new RangeError("FileUpload supports at most 10 file types.");
        this.fileTypes = [...types];
        return this;
    }

    public toJSON(): APIFileUploadComponent {
        if (!this.customId) throw new Error("FileUpload requires setCustomId().");
        if (this.minValues !== undefined && this.maxValues !== undefined && this.minValues > this.maxValues) {
            throw new RangeError("FileUpload minValues cannot be greater than maxValues.");
        }

        const payload: APIFileUploadComponent = {
            ...this.baseJSON(),
            type: this.type,
            custom_id: this.customId,
            required: this.required,
        };

        if (this.minValues !== undefined) payload.min_values = this.minValues;
        if (this.maxValues !== undefined) payload.max_values = this.maxValues;
        if (this.fileTypes) payload.file_types = [...this.fileTypes];

        return payload;
    }
}
