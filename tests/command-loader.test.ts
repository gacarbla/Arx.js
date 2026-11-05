import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ApplicationCommandOptionType,
    Command,
    CommandLoader,
    CommandRegistry,
    RestClient,
} from "@arx.js/discord";

function fakeBot(commands: Command<any>[], rest: RestClient) {
    const registry = new CommandRegistry();
    for (const command of commands) {
        registry.set(command.data.name, command);
    }
    return { commands: registry, rest };
}

describe("CommandLoader registration", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("sends the full serialized command (options included)", async () => {
        const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
            return new Response(JSON.stringify([]), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "log").mockImplementation(() => undefined);

        const command = new Command({ name: "buscar", description: "Busca algo" }).addOption(
            (option) =>
                option
                    .setName("texto")
                    .setDescription("Texto a buscar")
                    .setType(ApplicationCommandOptionType.String)
                    .setRequired()
        );

        const loader = new CommandLoader(
            fakeBot(
                [command],
                new RestClient("token", { fetch: fetchMock as unknown as typeof fetch })
            )
        );
        await loader.registerSlashCommands({ token: "token", applicationId: "123" });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        const putCall = fetchMock.mock.calls.find(
            ([, init]) => (init as RequestInit | undefined)?.method === "PUT"
        );
        expect(putCall).toBeDefined();

        const body = JSON.parse(String((putCall![1] as RequestInit).body));
        expect(body).toEqual([
            {
                name: "buscar",
                description: "Busca algo",
                type: 1,
                options: [
                    {
                        type: 3,
                        name: "texto",
                        description: "Texto a buscar",
                        required: true,
                    },
                ],
            },
        ]);
    });
});
