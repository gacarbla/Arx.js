# `@arx.js/discord`

Cliente nativo de Discord (Gateway + REST) con framework de comandos,
componentes V1/V2, interacciones y caché **opt-in**.

## Instalación

```bash
npm install @arx.js/discord
```

## Inicio rápido

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

## Logger

El cliente acepta cualquier objeto con `debug/info/warn/error`:

```ts
import { Bot, createConsoleLogger } from "@arx.js/discord";

const client = new Bot({
  token,
  logger: createConsoleLogger("[bot]"),
});
```

Por defecto solo se imprimen `warn` y `error`.

## Comandos

```ts
new Command({ name: "config", description: "Configura el bot" })
  .addCategory((group) =>
    group
      .setName("admin")
      .setDescription("Ajustes de administración")
      .addSubcommand((sub) =>
        sub
          .setName("set")
          .setDescription("Cambia un ajuste")
          .addOption((option) =>
            option
              .setName("clave")
              .setDescription("Clave")
              .setRequired()
              .addChoice("Logs", "logs")
          )
          .setExecution(async (ctx) => {
            const clave = ctx.getString("clave", true);
            await ctx.reply(`Ajuste: ${clave}`);
          })
      )
  )
  .setDefer("ephemeral");
```

`CommandContext` ofrece:

- `getString`, `getInteger`, `getNumber`, `getBoolean`
- `getUser`, `getMember`, `getChannel`, `getRole`, `getAttachment`
- `getFocused`
- `args`, `resolved`, `options`
- `guild`, `channel`, `member`, `user`, `locale`
- `reply`, `defer`, `editReply`, `followUp`, `update`, `modal`
- `hasPermission(Permissions.ManageGuild)`
- `t("clave", { name: "..." })`

Middlewares:

```ts
new Command({ name: "mod", description: "Moderación" })
  .addMiddleware(async (ctx, next) => {
    if (!ctx.hasPermission(Permissions.ManageGuild)) {
      await ctx.reply({ content: "Sin permisos", ephemeral: true });
      return;
    }
    await next();
  })
  .setExecution(async (ctx) => {
    /* ... */
  });
```

## Componentes V2

```ts
import {
  ActionRow, Button, Container, OutboundMessage, Section,
  Separator, TextDisplay, Thumbnail, encodeCustomId,
} from "@arx.js/discord";

const refresh = encodeCustomId("panel", "refresh");

const payload = new OutboundMessage()
  .addComponent(
    new Container()
      .setAccentColor(0x5865f2)
      .addComponent(new TextDisplay("## Estado"))
      .addComponent(
        new Section()
          .setText("Todo operativo")
          .setAccessory(new Thumbnail().setUrl("https://example.com/ok.png"))
      )
      .addComponent(new Separator())
      .addComponent(
        new ActionRow().addComponent(
          new Button().setCustomId(refresh).setLabel("Recargar")
        )
      )
  )
  .toJSON();
```

- El flag `IS_COMPONENTS_V2` se añade automáticamente.
- Con V2 no se permiten embeds; se usa `TextDisplay`/`Container`.
- `OutboundMessage` valida límites y tipos de componentes.

## Interacciones

```ts
client.router.button("panel:refresh", async (ctx) => {
  await ctx.update(/* nuevo payload */);
});

client.router.select("roles", async (ctx) => {
  console.log(ctx.values);
});

client.router.modal("feedback", async (ctx) => {
  const name = ctx.getRequiredField<string>("name");
  await ctx.reply(`Gracias, ${name}`);
});
```

- `encodeCustomId("namespace", "action", payload)` produce IDs seguros de
  máximo 100 caracteres.
- También se aceptan `custom_id` crudos.

## Caché

Todo es opt-in:

```ts
const client = new Bot({
  token,
  cache: {
    guilds: 100,
    channels: 1000,
    roles: 1000,
    users: 1000,
    members: 0,      // desactivado por defecto
    messages: 0,     // desactivado por defecto
    presences: 0,    // desactivado por defecto
    sweepInterval: 300_000,
  },
});
```

- `LruTtlMap` por colección.
- `max: 0` desactiva.
- Las actualizaciones parciales se fusionan con el payload existente.
- Sin caché de mensajes, la memoria no crece con el tráfico.

## Estructuras lazy

Dentro de un comando, `ctx.guild` ya es una estructura lazy:

```ts
.setExecution(async (ctx) => {
  const channel = ctx.guild?.channels.get(channelId);
  await channel?.send("Hola");
});
```

También puedes construirlas desde la caché:

```ts
const raw = client.cache.guilds.get(guildId);
const guild = raw ? new Guild(client, raw) : null;
```

Acciones principales:

- `Channel`: `send`, `fetchMessage`, `fetchMessages`, `edit`, `delete`, `setTopic`, `createInvite`.
- `Message`: `reply`, `edit`, `delete`, `react`, `pin`, `unpin`, `fetch`.
- `User`: `send`, `createDM`, `fetch`.
- `Member`: `edit`, `kick`, `ban`, `addRole`, `removeRole`.
- `Role`: `edit`, `delete`.
- `Guild`: `fetch`, `edit`, `leave`.

`send`, `reply` y `edit` aceptan `files` (multipart).

## Gateway

- Shards `"auto"`, número o lista.
- Heartbeat con jitter y ACK; detección de zombie.
- Resume con `session_id`, `sequence` y `resume_gateway_url`.
- Manejo de `INVALID_SESSION` y close codes.
- Backoff con jitter.
- `compress=zlib-stream`.
- `Intents` y `resolveIntents`.
- `onDispatch("MESSAGE_CREATE", ...)` tipado.

## REST

- Buckets por ruta + major params.
- Rate limit global y por bucket.
- Reintentos `429`, `5xx`, red y timeout.
- Multipart, `X-Audit-Log-Reason`, `withResponse`, `AbortSignal`.
- Errores tipados: `DiscordAPIError`, `RateLimitError`, `RequestTimeoutError`, `NetworkError`.

## Notas de operación

- `ready` se emite cuando el Gateway está listo; los guilds/canales/roles
  aparecen en la caché conforme llegan los `GUILD_CREATE`.
- `bot.ping` es `null` hasta el primer heartbeat ACK (puede tardar hasta el
  `heartbeat_interval` inicial, ~41 s).
- `syncCommands()` evita el `PUT` si no hay cambios. Discord limita el registro
  de comandos a ~2 peticiones por ventana de ~40 s por scope; usa `dryRun` para
  inspeccionar antes de escribir.
- Sin el intent privilegiado `MessageContent`, `MESSAGE_CREATE` llega con
  `content` vacío. El resto del payload (ids, autor, adjuntos) sigue disponible.

## Matriz de compatibilidad

| Elemento | Soporte |
| --- | --- |
| Node.js | >= 20 (probado en 24) |
| Discord API | v10 |
| Components V2 | Sí (`IS_COMPONENTS_V2`) |
| Slash commands | Sí |
| Autocompletado | Sí |
| Botones/selects/modales | Sí |
| Sharding | Sí |
| Voz | No (fuera de alcance) |
| Comandos de prefijo | No (fuera de alcance) |
| Bridge discord.js | `@arx.js/discord.js` (misma API) |

## Límites conocidos

- La API es alpha y puede cambiar.
- La voz no está implementada.
- Los comandos de mensaje/prefijo no están implementados.
- La caché de miembros/mensajes/presencias está desactivada por defecto.
- El registro de comandos requiere `applicationId` (se conoce tras READY).
- `MessageContent` debe solicitarse explícitamente si se necesitan mensajes.

## Tests

```bash
npm test
npm run typecheck
```

Más contexto: [`../../docs/discord/ARCHITECTURE.md`](../../docs/discord/ARCHITECTURE.md).
