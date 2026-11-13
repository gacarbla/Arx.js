import type {
    ComponentPayload,
    ComponentType,
} from "../../types/components";

/**
 * Base class for every outbound component builder.
 *
 * Builders are mutable and chainable; `toJSON()` validates Discord limits and
 * returns a plain API payload. Incoming components are never instances of this
 * class (they are raw payloads).
 */
export abstract class Component {
    /** Numeric Discord component type. */
    public abstract readonly type: ComponentType;

    /** Optional 32-bit identifier used by Components V2 responses. */
    public id?: number;

    public setId(id: number): this {
        if (!Number.isInteger(id) || id < 0 || id > 0xffffffff) {
            throw new RangeError("Component id must be a 32-bit unsigned integer.");
        }
        this.id = id;
        return this;
    }

    /** Serializes the component to an API payload. */
    public abstract toJSON(): ComponentPayload;

    protected baseJSON(): Record<string, unknown> {
        const payload: Record<string, unknown> = { type: this.type };
        if (this.id !== undefined) payload.id = this.id;
        return payload;
    }
}
