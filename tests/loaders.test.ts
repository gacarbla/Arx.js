import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    CommandLoader,
    CommandRegistry,
    ComponentLoader,
    EventLoader,
    collectFiles,
} from "@arx.js/discord";

const directories: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "arx-loader-"));
    directories.push(directory);

    for (const [path, content] of Object.entries(files)) {
        const target = join(directory, path);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, "utf8");
    }

    return directory;
}

afterEach(async () => {
    for (const directory of directories.splice(0)) {
        await rm(directory, { recursive: true, force: true });
    }
});

describe("loaders", () => {
    it("ignores build directories and collects module files", async () => {
        const directory = await fixture({
            "commands/ping.mjs": "export default {};",
            "commands/ignored.d.ts": "export {};",
            "commands/dist/compiled.mjs": "export default {};",
        });

        const files = await collectFiles(join(directory, "commands"));

        expect(files).toHaveLength(1);
        expect(files[0]).toContain("ping.mjs");
    });

    it("loads commands from a directory", async () => {
        const directory = await fixture({
            "commands/ping.mjs": `export default {
                data: { name: "ping" },
                toJSON() { return { name: "ping", description: "Ping", type: 1 }; }
            };`,
        });

        const registry = new CommandRegistry();
        const loader = new CommandLoader({ commands: registry, rest: {} as any });

        await expect(loader.loadSlashCommands(join(directory, "commands"))).resolves.toBe(1);
        expect(registry.has("ping")).toBe(true);
    });

    it("loads events into the target", async () => {
        const directory = await fixture({
            "events/ready.mjs": `export default { name: "ready", once: true, execute() {} };`,
        });

        const target = { on: vi.fn(), once: vi.fn() };
        const loader = new EventLoader(target);

        await expect(loader.load(join(directory, "events"))).resolves.toBe(1);
        expect(target.once).toHaveBeenCalledWith("ready", expect.any(Function));
        expect(target.on).not.toHaveBeenCalled();
    });

    it("registers components in the router", async () => {
        const directory = await fixture({
            "components/confirm.mjs": `export default { type: "button", id: "confirm", execute() {} };`,
        });

        const router = { register: vi.fn() };
        const loader = new ComponentLoader(router as any);

        await expect(loader.load(join(directory, "components"))).resolves.toBe(1);
        expect(router.register).toHaveBeenCalledWith("button", "confirm", expect.any(Function));
    });
});
