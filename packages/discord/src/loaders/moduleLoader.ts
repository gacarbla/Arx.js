import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".git", "coverage"]);
const VALID_EXTENSIONS = [".js", ".mjs", ".cjs", ".ts", ".mts", ".cts"];

/** Recursively collects importable module files. */
export async function collectFiles(directory: string): Promise<string[]> {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch {
        return [];
    }

    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = join(directory, entry.name);

        if (entry.isDirectory()) {
            if (IGNORED_DIRECTORIES.has(entry.name)) continue;
            files.push(...(await collectFiles(fullPath)));
            continue;
        }

        if (!entry.isFile()) continue;
        if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".map")) continue;
        if (!VALID_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) continue;

        files.push(fullPath);
    }

    return files;
}

/** Imports a module bypassing the ESM cache when `bust` is provided. */
export async function importModule(file: string, bust = false): Promise<any> {
    const url = pathToFileURL(file);
    if (bust) {
        const info = await stat(file);
        url.searchParams.set("v", String(info.mtimeMs));
    }
    return import(url.href);
}

/** Accepts `export default`, `export const <key>` or a named export. */
export function pickExport(module: any, keys: string[]): any {
    if (module?.default) return module.default;
    for (const key of keys) {
        if (module?.[key]) return module[key];
    }
    return module;
}
