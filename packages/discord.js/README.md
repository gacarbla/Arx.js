# `@arx.js/discord.js`

Bridge de **discord.js** con la misma API de desarrollador que
`@arx.js/discord`: comandos, contextos, router de componentes, i18n, permisos,
loaders y caché opt-in.

## Instalación

```bash
npm install @arx.js/discord.js discord.js
```

## Inicio rápido

```ts
import { Client, Command } from "@arx.js/discord.js";

const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  intents: ["Guilds", "GuildMessages"],
  cache: { messages: 0, members: 0 },
});

client.commands.add(
  new Command({ name: "ping", description: "Mide la latencia" })
    .setExecution(async (ctx) => {
      await ctx.reply(`Pong · ${ctx.client.ping ?? "?"} ms`);
    })
);

client.once("ready", () => client.syncCommands());
await client.start();
```

El único cambio frente al cliente nativo es el import:

```ts
// nativo
import { Bot } from "@arx.js/discord";

// bridge
import { Client } from "@arx.js/discord.js";
```

## Logger

Igual que el cliente nativo:

```ts
import { Client, createConsoleLogger } from "@arx.js/discord.js";

const client = new Client({ token, logger: createConsoleLogger("[bridge]") });
```

Por defecto solo se imprimen `warn` y `error`.

## Qué comparte con el cliente nativo

- `Command`, `CommandRegistry`, `CommandContext`, `ComponentContext`.
- `InteractionRouter`, codec de `customId`.
- `CacheStore`, `LruTtlMap`, `applyDispatch`.
- `I18n`, `Permissions`.
- Estructuras `User`, `Guild`, `Channel`, `Member`, `Role`, `Message`.
- Loaders de comandos, eventos y componentes.
- `syncCommands()` con diff y `dryRun`.

## Caché segura

discord.js se configura con límites conservadores:

```ts
const client = new Client({
  token,
  cache: {
    messages: 0,   // por defecto
    members: 0,    // por defecto
    presences: 0,  // por defecto
    users: 1000,
  },
});
```

La caché del kit (`client.cache`) se rellena desde los eventos de discord.js.

## Escape hatch

```ts
client.native; // discord.js.Client
client.discord; // alias
client.guilds;  // discord.js GuildManager
```

Puedes seguir usando cualquier API de discord.js sin perder el framework:

```ts
const guild = await client.native.guilds.fetch(guildId);
```

## Eventos

El cliente reemite:

- nombres API: `MESSAGE_CREATE`, `GUILD_CREATE`, `CHANNEL_UPDATE`...
- nombres de discord.js: `messageCreate`, `guildCreate`...
- `ready`, `interactionCreate`, `unhandledInteraction`.

Los event modules cargados con `client.loadEvents()` pueden usar cualquiera de
los dos formatos.

## Diferencias con `@arx.js/discord`

- El Gateway y el REST son los de discord.js.
- `client.user` es una estructura lazy del kit; el usuario nativo está en
  `client.native.user`.
- `interactionCreate` entrega un `InteractionAdapter`, no la interacción cruda.
  Usa `ctx.interaction.raw` o `client.native` si necesitas discord.js.
- El bridge **compone** discord.js en lugar de heredar, para evitar el choque
  entre `client.user` de discord.js y la estructura `User` del kit.
- El sharding lo gestiona discord.js; usa `client.native.shard` o
  `client.native` para esa API.

## Matriz de compatibilidad

| Elemento | Soporte |
| --- | --- |
| discord.js | ^14.27.0 |
| Node.js | >= 20 |
| Misma API que `@arx.js/discord` | Sí |
| Caché de mensajes/miembros/presencias | Desactivada por defecto |
| Componentes V2 | Sí (vía kit) |
| Voz | No (fuera de alcance) |

## Tests

```bash
npm test
npm run typecheck
```

Más contexto: [`../../docs/discord/ARCHITECTURE.md`](../../docs/discord/ARCHITECTURE.md).
