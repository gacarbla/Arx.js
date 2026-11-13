import { describe, expect, it, vi } from "vitest";
import { Command, CommandRegistry, type RestClient } from "@arx.js/discord";

function createRest(existing: any[] = []) {
    return {
        get: vi.fn(async () => existing),
        put: vi.fn(async (_route: string, body: any) => body),
        post: vi.fn(async (_route: string, body: any) => body),
        patch: vi.fn(async (_route: string, body: any) => body),
    } as unknown as RestClient;
}

function registry() {
    const commands = new CommandRegistry();
    commands.set("ping", new Command({ name: "ping", description: "Ping" }));
    return commands;
}

describe("CommandRegistry", () => {
    it("rejects duplicate names", () => {
        const commands = registry();

        expect(() =>
            commands.add(new Command({ name: "ping", description: "Duplicate" }))
        ).toThrow(/already registered/i);
    });

    it("returns a diff in dryRun mode without writing", async () => {
        const rest = createRest([
            { id: "1", application_id: "app", version: "1", type: 1, name: "ping", description: "Old" },
            { id: "2", application_id: "app", version: "1", type: 1, name: "old", description: "Old" },
        ]);
        const commands = registry();
        commands.set("new", new Command({ name: "new", description: "New" }));

        const result = await commands.sync(rest, { applicationId: "app", dryRun: true });

        expect(result.added.map((command) => command.name)).toEqual(["new"]);
        expect(result.updated.map((command) => command.name)).toEqual(["ping"]);
        expect(result.removed.map((command) => command.name)).toEqual(["old"]);
        expect(rest.put).not.toHaveBeenCalled();
        expect(rest.post).not.toHaveBeenCalled();
        expect(rest.patch).not.toHaveBeenCalled();
    });

    it("does not write when the remote state already matches", async () => {
        const rest = createRest([
            {
                id: "1",
                application_id: "app",
                version: "1",
                type: 1,
                name: "ping",
                description: "Ping",
            },
        ]);
        const commands = registry();

        const result = await commands.sync(rest, { applicationId: "app" });

        expect(result).toMatchObject({ added: [], updated: [], removed: [] });
        expect(rest.put).not.toHaveBeenCalled();
        expect(rest.post).not.toHaveBeenCalled();
        expect(rest.patch).not.toHaveBeenCalled();
    });

    it("replaces the whole command list by default", async () => {
        const rest = createRest([]);
        const commands = registry();

        await commands.sync(rest, { applicationId: "app" });

        expect(rest.get).toHaveBeenCalledWith("/applications/app/commands");
        expect(rest.put).toHaveBeenCalledWith(
            "/applications/app/commands",
            [
                {
                    name: "ping",
                    description: "Ping",
                    type: 1,
                },
            ]
        );
    });

    it("patches existing commands when deleteMissing is false", async () => {
        const rest = createRest([
            { id: "1", application_id: "app", version: "1", type: 1, name: "ping", description: "Old" },
        ]);
        const commands = registry();
        commands.set("new", new Command({ name: "new", description: "New" }));

        await commands.sync(rest, { applicationId: "app", deleteMissing: false });

        expect(rest.patch).toHaveBeenCalledWith("/applications/app/commands/1", {
            name: "ping",
            description: "Ping",
            type: 1,
        });
        expect(rest.post).toHaveBeenCalledWith("/applications/app/commands", {
            name: "new",
            description: "New",
            type: 1,
        });
        expect(rest.put).not.toHaveBeenCalled();
    });

    it("uses the guild-scoped endpoint", async () => {
        const rest = createRest([]);
        const commands = registry();

        await commands.sync(rest, { applicationId: "app", guildId: "guild" });

        expect(rest.get).toHaveBeenCalledWith("/applications/app/guilds/guild/commands");
        expect(rest.put).toHaveBeenCalledWith(
            "/applications/app/guilds/guild/commands",
            [{ name: "ping", description: "Ping", type: 1 }]
        );
    });
});
