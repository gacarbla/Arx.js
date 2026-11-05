# Arx.js

Monorepo de librerías para Discord y utilidades de soporte.

| Paquete | Qué es |
| --- | --- |
| `@arx.js/discord` | Cliente nativo (Gateway + REST), framework de comandos, componentes V2, caché opt-in y estructuras lazy. |
| `@arx.js/discord.js` | Bridge sobre `discord.js` con **la misma API** y caché segura por defecto. |
| `@arx.js/core` | Configuración tipada con Zod e INI. |
| `@arx.js/tools` | Caché, consola, ficheros y formato. |
| `@arx.js/console` | Consola global opcional para bots. |

## Requisitos

- Node.js **>= 20** (probado en Node 24).
- TypeScript 5.x/7.x para desarrollo.
- Discord API v10.

## Inicio rápido

```bash
npm install
npm run build
npm test
```

```ts
import { Bot, Command } from "@arx.js/discord";

const client = new Bot({
  token: process.env.DISCORD_TOKEN!,
  intents: ["Guilds", "GuildMessages"],
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

El mismo bot con el bridge:

```ts
import { Client } from "@arx.js/discord.js";
// ...mismo Command, mismo contexto, mismo router.
```

## Ejemplos

- [`examples/ping`](./examples/ping)
- [`examples/components-v2`](./examples/components-v2)
- [`examples/bridge`](./examples/bridge)

## Scripts

```bash
npm run build       # core → tools → console → discord → discord.js
npm run typecheck   # todos los paquetes + tests
npm test            # Vitest
npm run benchmark   # memoria de la caché (requiere build)
npm run live-check  # comprobación real contra Discord (DISCORD_TOKEN)
```

## Documentación

- [`docs/discord/ARCHITECTURE.md`](./docs/discord/ARCHITECTURE.md): arquitectura,
  diagnóstico, hoja de ruta y decisiones.
- [`packages/discord/README.md`](./packages/discord/README.md)
- [`packages/discord.js/README.md`](./packages/discord.js/README.md)

## Estado

Alpha (`1.0.0-alpha.2`). La API puede cambiar antes de `1.0.0`.
