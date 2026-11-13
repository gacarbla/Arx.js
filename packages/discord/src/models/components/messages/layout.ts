import type { ComponentPayload } from "../../../types/components";
import { Component } from "../base";

/**
 * Ordered collection of top-level message components.
 *
 * This replaced the old template system: builders now produce payloads
 * directly and the layout only groups them.
 */
export class MessageLayout {
    private components: Component[] = [];

    public addComponent(component: Component): this {
        this.components.push(component);
        return this;
    }

    public addComponents(components: readonly Component[]): this {
        this.components.push(...components);
        return this;
    }

    public setComponents(components: readonly Component[]): this {
        this.components = [...components];
        return this;
    }

    public toJSON(): ComponentPayload[] {
        return this.components.map((component) => component.toJSON());
    }
}
