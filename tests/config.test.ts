import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Config } from "@arx.js/core";
import "@arx.js/tools";

function loadFixture(content: string): void {
    const directory = mkdtempSync(join(tmpdir(), "arx-config-"));
    const file = join(directory, "config.ini");

    try {
        writeFileSync(file, content, "utf8");
        Config.loadSync(file);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

describe("Config", () => {
    it("registra la sección GENERAL y aplica sus defaults", () => {
        loadFixture("[GENERAL]\ndebug=true\n");

        expect(Config.get("GENERAL").debug).toBe(true);
        expect(Config.get("GENERAL").defaultLanguage).toBe("en-GB");
    });

    it("lee secciones planas del INI con barras (TOOLS/CACHE)", () => {
        loadFixture("[TOOLS/CACHE]\nfoo=bar\n");

        expect(Config.get("TOOLS/CACHE")).toEqual({});
    });

    it("es case-insensitive con los nombres de sección", () => {
        loadFixture("[general]\ndebug=true\n");

        expect(Config.get("GENERAL").debug).toBe(true);
    });
});
