/** Flattens modal submit components into a `custom_id -> value` map. */
export function parseModalFields(components: unknown): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    collect(components, fields);
    return fields;
}

function collect(components: unknown, fields: Record<string, unknown>): void {
    if (!Array.isArray(components)) return;

    for (const component of components) {
        if (!component || typeof component !== "object") continue;
        const data = component as any;

        if (Array.isArray(data.components)) {
            collect(data.components, fields);
        }
        if (data.component) {
            collect([data.component], fields);
        }

        if (!data.custom_id) continue;

        if (Array.isArray(data.values)) {
            fields[data.custom_id] = data.values;
        } else if (data.value !== undefined) {
            fields[data.custom_id] = data.value;
        } else if (data.default !== undefined) {
            fields[data.custom_id] = data.default;
        }
    }
}
