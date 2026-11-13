# Arx.js · Diseño de `@arx.js/discord` y `@arx.js/discord.js`

> Estado: propuesta de arquitectura (alpha). Este documento es la referencia para
> terminar ambos paquetes y sustituye al código actual como fuente de verdad.
>
> **M0–M7 completados.** Alpha `1.0.0-alpha.2` lista para publicar con
> `changeset publish` (tag `alpha`).

## 1. Objetivo

Dos productos con una sola API:

| Paquete | Qué es | Qué NO es |
| --- | --- | --- |
| `@arx.js/discord` | Cliente nativo de Discord (Gateway + REST) sin caché implícita, más el framework de comandos y componentes. | Un clon de discord.js. |
| `@arx.js/discord.js` | Driver que implementa el mismo contrato sobre `discord.js`, con la misma API de desarrollador y caché desactivada por defecto. | Un wrapper que obliga a aprender discord.js. |

La pieza clave es que **el código del bot no cambia al elegir driver**:

```ts
// nativo
import { Client } from "@arx.js/discord";

// o bridge
import { Client } from "@arx.js/discord.js";

const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  intents: ["Guilds", "GuildMessages", "MessageContent"],
});

client.commands.add(
  slash("ping", "Mide la latencia del bot")
    .run(async (ctx) => {
      await ctx.reply(`Pong · ${client.ws.ping} ms`);
    })
);

await client.start();
```

Esto solo es posible si el framework (comandos, builders, estructuras, router de
interacciones) **no depende del transporte**. Por eso la arquitectura se divide
en `kit` (transport-agnóstico) y `driver` (nativo o discord.js).

---

## 2. Diagnóstico del estado actual

### 2.1 Inventario real

- `packages/discord`: ~2.200 líneas. Gateway y REST mínimos, builders de comandos,
  modelos DTO y builders de componentes. **No compila como librería publicable**:
  `src/index.ts` importa `./test/index`, que crea un bot y se conecta al importar.
- `packages/discord.js`: ~130 líneas. Solo un `Client` que hereda de discord.js y
  un `Command` a medio hacer. Sin loaders, sin router, sin build.
- `packages/discord/src/structures/**` y `src/types/**`: casi todos vacíos.
- `tests/`: vacío. No hay ningún test en ninguno de los dos paquetes.
- Los scripts de la raíz solo construyen `core` y `tools`.

### 2.2 Bugs y bloqueos (P0)

| # | Problema | Archivo | Impacto |
| --- | --- | --- | --- |
| 1 | Token real hardcodeado | `packages/discord/src/test/index.ts` | **Seguridad**. Revocar el token ya. Ya fue redactado en el working tree, pero sigue en el historial si se llegó a commitear. |
| 2 | `index.ts` importa el test y ejecuta `login()` al importar | `packages/discord/src/index.ts` | Cualquier `import "@arx.js/discord"` arranca un bot. La librería no es importable. |
| 3 | Los comandos se registran **sin opciones ni subcomandos** | `loaders/commandLoader.ts` + `builders/Command.ts` | `registerSlashCommands` serializa `cmd.data`, que solo contiene `{ name, description }`. Los `options`, `subcommands` y `categories` viven fuera de `data` y nunca se envían. |
| 4 | Export `./console` apunta a `dist/console/index` inexistente | `packages/discord/package.json` | El paquete está roto en ese subpath. |
| 5 | Componentes V2 con tipos string | `models/components/messages/*` | `"container"`, `"section"`, `"text_display"` no existen en la API. Deben ser `17`, `9`, `10`. |
| 6 | `Container` usa `type: 15` conceptual y `Section`/`TextDisplay` con strings | idem | Discord rechaza el payload (400). |
| 7 | `EmbedTemplateV1.build(params)` ignora `params` | `models/embeds/v1.ts` | Las plantillas de embed no sustituyen nada. |
| 8 | `MessageLayout` es el único sitio con sustitución real, con regex distinta a la del tipo | `models/components/messages/layout.ts` | Comportamiento impredecible entre tipos y runtime. |
| 9 | El bridge redefine `this.execution` con `setExecution` | `discord.js/src/models/interactions/commands/command.ts` | El método y la propiedad comparten nombre; el tipado y el runtime discrepan. |
| 10 | `packages/discord.js/package.json` sin `exports`, `types`, `build` ni dependencia de `@arx.js/tools` | `package.json` | No se puede consumir ni publicar; el bridge usa `Memory` sin declararlo. |
| 11 | Configuración con module augmentation sobre `"@arx.js/core"` | `discord/src/config.ts`, `tools/src/cache/config.ts`, `console/src/config.ts` | La interfaz `ArxConfigRegistry` real vive en `./configBuilder/types`; el augmentation crea otra interfaz y no tipa `Config.get("DISCORD")`. |
| 12 | La sección por defecto de `core` nunca se registra | `packages/core/src/index.ts` | No importa `./config`, así que `GENERAL` no existe en el registry ni se valida. |
| 13 | `discord/src/config.ts` declara `CONSOLE` pero registra `DISCORD` | `packages/discord/src/config.ts` | El tipo y la clave real no coinciden. Además colisiona con `@arx.js/console`, que también registra `CONSOLE`. |
| 14 | Las claves con `/` no se leen del INI | `packages/core/src/configBuilder/index.ts` | `extractSection` navega `data.TOOLS.CONSOLE`, pero `ini` produce la clave plana `"TOOLS/CONSOLE"`. `TOOLS/*` nunca carga del archivo. |
| 15 | Uso de `console.*` global y `console.success` monkeypatcheado | Gateway, REST, loaders, index | La librería no se puede silenciar ni testear; rompe en entornos sin TTY. |

### 2.3 Problemas de diseño (P1)

**Transporte**

- Gateway: sin `resume`, sin gestión de `session_id`/`resume_gateway_url`, sin zlib,
  sin backoff con jitter, sin cola de `IDENTIFY`, sin sharding, sin política por
  close code, sin validación de payloads. `op 9` (invalid session) no se maneja.
- Heartbeat: hace `clearInterval` pero no espera al ACK antes de reconectar; el
  jitter inicial obligatorio no existe. `ackReceived = true` en `op 10` es incorrecto.
- REST: maneja 429 recursivamente sin límite (puede colgarse para siempre), sin
  buckets por ruta, sin rate limit global, sin reintentos 5xx, sin backoff, sin
  multipart, sin `X-Audit-Log-Reason`, sin timeout/abort, sin errores tipados.
- El User-Agent tiene una URL de ejemplo (`tu-repo`).

**Modelos y estructuras**

- Hay dos capas paralelas: `models/*` (DTOs inmutables con camelCase) y
  `structures/*` (vacíos). Los DTO no se corresponden con el JSON de la API
  (snake_case), así que no hay mapeo ni acciones de red salvo en `ReceivedMessage`.
- `Object.freeze(this)` impide cualquier hidratación perezosa o caché por referencia.
- No existen estructuras para guild, canal, miembro, rol, usuario ni interacciones.
- Las interacciones se pasan como `any` al handler; no hay `reply`, `defer`,
  `editReply`, `followUp`, `modal` ni `update`.
- `InteractionCreate` solo procesa `type === 2`. Se ignoran botones, selects,
  modales y autocompletado.

**Comandos**

- `Command`/`Subcommand`/`CommandCategory` no serializan a la API (P0 #3).
- `CommandCategory` es en realidad un *subcommand group* (tipo 2 de Discord).
  Conviene renombrarlo; "categoría" es un concepto de documentación, no de API.
- Faltan opciones: `channel_types`, localizaciones, `required` en subcomandos,
  `default_member_permissions`, `dm_permission`, `nsfw`, `contexts`,
  `integration_types`, `autocomplete`, límites de longitud/valor.
- `addOption` está duplicado en `Command`, `Subcommand` y `CommandCategory` con
  firmas distintas y sin nombre/descripción obligatorios.
- El middleware recibe la interacción cruda y no hay contexto, errores, ni
  `next()` tipado. No hay autocompletado ni guards reutilizables.
- No hay sincronización con Discord: no se borran comandos obsoletos, no hay
  diff, no hay scope por guild, no hay `dryRun`.

**Shebang/DX**

- `getCallerFilePath()` con `Error.prepareStackTrace` es frágil y se rompe con
  bundlers, workers y ESM. La ruta base debe ser explícita.
- El loader hace logs síncronos por archivo, `statSync` recursivo y no ignora
  `dist`, `node_modules`, `*.d.ts` ni `*.map`.
- No hay hot reload controlado, ni validación de duplicados, ni errores agregados.
- No hay eventos tipados, ni `ready`, ni cierre ordenado, ni `dispose`.

**Componentes**

- Falta la mitad de V2: Thumbnail (11), MediaGallery (12), File (13), Separator (14),
  Label (18), FileUpload (19), RadioGroup (21), CheckboxGroup (22), Checkbox (23).
- `Checkbox` es un componente **solo de modal** y debe ir dentro de un `Label`
  (18). Hoy se emite como mensaje con `type: "checkbox"`.
- `Button` serializa la instancia `Emoji` en lugar de `{ id, name, animated }`.
- No se valida ningún límite (5 action rows, 5 botones por row, 25 opciones,
  4000 caracteres, etc.).
- `MessageLayout` no activa el flag `IS_COMPONENTS_V2` (`1 << 15`).
- No se pueden combinar `content`/`embeds` con V2 (Discord los desactiva).

**Bridge**

- El `Command` no tiene `data` (nombre/descripción), así que no se puede registrar.
- `Subcommand`, `SubcommandGroup` y `Event` están vacíos.
- No hay router de interacciones ni loaders.
- `memory` es una idea interesante pero no se usa en ningún sitio.
- El paquete se llama `@arx.js/discord.js-bridge`: conviene renombrarlo a
  `@arx.js/discord.js` (o `@arx.js/discord-driver-discordjs` si se publica aparte).
- No se desactiva la caché de discord.js, que es justo el motivo del proyecto.

---

## 3. Principios de diseño

1. **Sin caché implícita.** Nada se guarda si no se pide. `messages` y `presences`
   empiezan en 0. El Gateway entrega el payload; el usuario decide qué retener.
2. **REST-first.** Toda acción de red es explícita y pasa por el `RestClient`. Las
   estructuras son vistas ligeras, no repositorios.
3. **Payload de la API como fuente de verdad.** Tipos `snake_case` de
   `discord-api-types/v10` (solo tipos). Las estructuras exponen getters en
   camelCase y `toJSON()` devuelve el payload original.
4. **Lazy por defecto.** No se hidratan listas de miembros, roles ni canales.
   `guild.members.fetch()` es explícito. `guild.members.cache` existe solo si se
   configuró.
5. **Un contrato, dos drivers.** `kit` no importa `ws` ni `discord.js`. El driver
   nativo y el bridge implementan `ArxDriver` / `InteractionAdapter`.
6. **Todo inyectable.** Logger, reloj, fetch y WebSocket se inyectan para tests.
7. **Errores tipados y observables.** `DiscordAPIError`, `RateLimitError`,
   `GatewayError`; eventos `debug`, `warn`, `error` con namespace.
8. **Sin side effects al importar.** Nada de `login()` ni `console.*` global en
   el índice del paquete.
9. **Validación en el borde.** Los builders validan límites de Discord antes de
   enviar y lanzan errores claros con la ruta del campo.
10. **Copiar y adaptar, no importar Kynetic.** Ver §8.

---

## 4. Arquitectura objetivo

```
┌──────────────────────────────────────────────────────────────┐
│                     Código del bot                           │
│  commands/  events/  components/  (módulos de usuario)       │
└───────────────┬──────────────────────────────────────────────┘
                │ misma API
┌───────────────▼──────────────────────────────────────────────┐
│  @arx.js/discord · kit                                       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Builders     │ │ Command      │ │ Interaction router  │  │
│  │ msg/embed/   │ │ registry +   │ │ buttons/selects/    │  │
│  │ components   │ │ runner       │ │ modals/autocomplete │  │
│  └──────────────┘ └──────────────┘ └──────────────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │ Structures   │ │ CacheStore   │ │ Event bus tipado     │  │
│  │ lazy + REST  │ │ LRU/TTL 0..n │ │ (sin EventEmitter    │  │
│  │              │ │              │ │  sin tipos)          │  │
│  └──────────────┘ └──────────────┘ └──────────────────────┘  │
└───────────────┬──────────────────────────┬───────────────────┘
                │                          │
   ┌────────────▼───────────┐   ┌──────────▼────────────────┐
   │ Driver nativo          │   │ Driver discord.js         │
   │ Gateway + REST propios │   │ Client + REST de discord  │
   │ ws, zlib, buckets      │   │ caché desactivada         │
   └────────────┬───────────┘   └──────────┬────────────────┘
                │                          │
         Discord API v10            Discord API v10
```

### 4.1 Contrato del driver

```ts
// kit/driver.ts — sin imports de ws ni discord.js
export interface ArxDriver {
  readonly applicationId: string;
  readonly user: ClientUser;
  readonly rest: RestAdapter;
  connect(): Promise<void>;
  destroy(): Promise<void>;
  on<K extends keyof DriverEvents>(event: K, fn: DriverEvents[K]): Unsubscribe;
  /** Crea el adaptador de respuesta para una interacción cruda. */
  createInteraction(raw: APIInteraction): InteractionAdapter;
}
```

`InteractionAdapter` es la pieza que permite que un comando funcione igual en los
dos drivers:

```ts
export interface InteractionAdapter {
  readonly raw: APIInteraction;
  readonly id: string;
  readonly type: InteractionType;
  readonly guildId: Snowflake | null;
  readonly channelId: Snowflake | null;
  readonly userId: Snowflake;
  readonly locale: string;

  reply(payload: ReplyPayload): Promise<InteractionResult>;
  defer(options?: { ephemeral?: boolean }): Promise<void>;
  editReply(payload: ReplyPayload): Promise<InteractionResult>;
  followUp(payload: ReplyPayload): Promise<InteractionResult>;
  update(payload: ReplyPayload): Promise<InteractionResult>;
  showModal(modal: ModalPayload): Promise<void>;
  autocomplete(choices: AutocompleteChoice[]): Promise<void>;
}
```

- Driver nativo: implementa con `RestClient` y el endpoint de callbacks.
- Driver discord.js: delega en `interaction.reply()`, `.deferReply()`, etc.,
  usando `interaction.toRaw()` para `raw`.

Así el runner de comandos **nunca** toca `discord.js` ni `ws`.

### 4.2 Estructura de paquetes propuesta

```
packages/discord/
  src/
    index.ts                 # API pública (Client, builders, structures, tipos)
    kit/
      driver.ts              # contratos
      events.ts
      errors.ts
      logger.ts
      cache/                 # LruTtlMap, CacheStore, políticas
      builders/              # mensajes, embeds, componentes V2
      commands/              # CommandBuilder, registry, runner, middleware
      router/                # customId codec, componente/modal/autocomplete
      structures/            # Guild, Channel, Member, Role, User, Message
      loaders/               # comandos, eventos, componentes
      rest/                  # contrato RestAdapter + helpers de rutas
    native/
      client.ts              # Client nativo
      gateway/               # ShardManager, Shard, heartbeat, resume, zlib
      rest/                  # RestClient, BucketManager, errors, multipart
      cache/                 # updater de eventos -> cache opcional
      structures/            # implementaciones que usan el RestClient nativo
  package.json               # exports: ".", "./kit", "./builders", "./components", ...
packages/discord.js/
  src/
    index.ts                 # Client con la misma API
    client.ts                # ArxClient extends discord.js.Client
    driver.ts                # DiscordJsDriver
    interaction.ts           # adaptador de interacciones
    cache.ts                 # opciones de caché seguras por defecto
    loaders.ts               # reexporta/implementa loaders del kit
  package.json               # exports, types, build, deps correctas
```

> Alternativa si se quiere evitar que el bridge arrastre `ws`: publicar el kit
> como `@arx.js/discord-kit`. Recomiendo **no** crear un tercer paquete todavía;
> con `exports` por subpath y `peerDependencies` el coste es aceptable en alpha.
> Si el tamaño importa, el paso a `@arx.js/discord-kit` es mecánico.

---

## 5. Diseño detallado de `@arx.js/discord`

### 5.1 Cliente y ciclo de vida

```ts
const client = new Client({
  token: process.env.DISCORD_TOKEN!,
  intents: ["Guilds", "GuildMessages", "MessageContent"],
  rest: { retries: 3, timeout: 15_000, userAgent: "mi-bot/1.0" },
  gateway: { compress: true, shards: "auto" },
  cache: {
    guilds: 100,
    channels: 1_000,
    roles: 1_000,
    members: 0,      // opt-in
    messages: 0,     // opt-in
    presences: 0,    // opt-in
  },
  logger: arxConsole, // opcional; si no, logger silencioso + debug event
});

client.on("ready", (me) => { /* me.user, me.guilds */ });
client.on("interactionCreate", (ctx) => { /* ya enrutado */ });
client.on("error", (err) => { /* nunca unhandled */ });

await client.start();
await client.destroy();
```

Responsabilidades del `Client`:

- Validar options y construir `RestClient`, `Gateway`, `CacheStore`, `CommandRegistry`.
- Gestionar el ciclo `start → ready → destroy` con idempotencia.
- Enrutar `INTERACTION_CREATE` al `InteractionRouter`.
- Actualizar la caché **solo** para las entidades configuradas.
- Emitir eventos tipados; `error` siempre tiene listener por defecto que loguea.

### 5.2 REST

```ts
interface RestOptions {
  token: string;
  api?: string;              // default https://discord.com/api/v10
  retries?: number;          // 3
  timeout?: number;          // 15s
  userAgent?: string;
  fetch?: typeof fetch;      // inyectable
  clock?: Clock;             // inyectable para tests
}
```

`RestClient.request<T>(route, options)`:

1. Normaliza la ruta y calcula la clave de bucket:
   `method:route:majorParam` (p. ej. `POST:/channels/:id/messages`).
2. Espera turno en la cola del bucket (semáforo por bucket, no por petición).
3. Envía con `Authorization: Bot <token>`, `User-Agent`, `X-Audit-Log-Reason` si
   procede, y body JSON o `multipart/form-data`.
4. Lee `X-RateLimit-Bucket`, `Limit`, `Remaining`, `Reset-After`, `Scope` y
   `Global`; actualiza el bucket y reprograma el reset.
5. En `429`: espera `retry_after` (segundos, no ms) y reintenta hasta `retries`.
6. En `5xx` y errores de red: backoff exponencial con jitter; nunca reintentar
   `400/401/403/404/422`.
7. En `2xx`: parsea JSON o devuelve `undefined` en `204`. Soporta
   `withResponse` para callbacks de interacción.
8. Errores: `DiscordAPIError` con `status`, `code`, `errors`, `method`, `route`,
   `body`; `RateLimitError` si se agotan reintentos.

Extras:

- `requestFiles(route, payload, files)` para adjuntos (`payload_json` + `files[n]`).
- Helpers tipados generados a mano o por plantilla: `rest.channels.sendMessage`,
  `rest.messages.edit`, `rest.interactions.callback`, etc. No hace falta cubrir
  los 200 endpoints al principio; sí los de mensajes, canales, guilds, miembros,
  roles, interacciones y comandos.
- `rest.raw()` como escape hatch.

### 5.3 Gateway

`ShardManager`:

- Obtiene `/gateway/bot` para `shards`, `session_start_limit` y `url`.
- Arranca shards con concurrencia `max_concurrency` (rate limit de identify).
- Política `shards: "auto" | number | number[]`.

`Shard` (máquina de estados):

```
IDLE → CONNECTING → IDENTIFYING → READY
                 ↘ RESUMING → READY
        DISCONNECTED → (backoff) → CONNECTING
```

- `HELLO (10)`: primer heartbeat con jitter `random() * interval`, luego cada
  `interval`; `ACK (11)` obligatorio antes del siguiente; si no, cerrar y reanudar.
- `IDENTIFY (2)`: token, intents, properties, `shard`, `presence` opcional.
- `RESUME (6)`: `session_id`, `seq`, token, `resume_gateway_url`.
- `INVALID_SESSION (9)`: si `d === true`, reintentar resume; si `false`, esperar
  1-5 s y volver a identificar.
- `RECONNECT (7)`: cerrar y reanudar.
- Close codes:
  - reanudables: `4000, 4001, 4002, 4003, 4005, 4007, 4009`;
  - no reanudables: `4004, 4010, 4011, 4012, 4013, 4014` (identificar de nuevo;
    `4013/4014` son error de configuración de intents y se propagan).
  - `1000/1001`: cierre limpio, no reconectar.
- zlib: `?v=10&encoding=json&compress=zlib-stream` si `compress: true`, con
  inflate incremental y buffer hasta el sufijo `\x00\x00\xff\xff`.
- Backoff: `min(30s, 1s * 2^attempt) * (0.5 + random()/2)`; reset al recibir READY.
- Secuencia y sesión por shard; nunca compartir estado entre shards.

Intents: helper tipado.

```ts
import { Intents } from "@arx.js/discord";
new Client({ intents: ["Guilds", "GuildMembers", "GuildMessages", "MessageContent"] });
// o bitfield explícito
new Client({ intents: Intents.Guilds | Intents.GuildMessages });
```

Eventos: mapa tipado `ClientEvents` generado a partir de `discord-api-types`.
Cada dispatch pasa por `eventHandlers` (cache updater + router) y luego a los
listeners del usuario. Los errores de un listener no rompen el shard.

### 5.4 Caché

```ts
interface CacheOptions {
  guilds?: number;                          // max entries, 0 = off
  channels?: number;
  roles?: number;
  members?: number;
  messages?: number | { max: number; ttl: number };
  presences?: number;                       // default 0
  sweepInterval?: number;                   // default 5 min
}
```

- Implementación `LruTtlMap<K, V>`: `Map` + lista doble o `Map` reordenado;
  `get` refresca, `set` expulsa, `sweep()` elimina expirados.
- `CacheStore` por tipo. `client.cache.guilds`, `.channels`, `.members`, etc.
  Son `ReadonlyMap` con métodos `get`, `has`, `size`, `values`.
- **No hay caché de mensajes por defecto.** Si se activa, solo se cachean los
  mensajes recibidos por gateway y los enviados por el propio bot; nunca se
  rellena hacia atrás.
- Los updaters de eventos son funciones puras: `applyGuildCreate(cache, d)`.
  Se registran solo si el tipo está habilitado.
- Sin hidratación en cascada: `GUILD_CREATE` no crea miembros si `members: 0`.
- `guild.members.fetch()` y `channel.messages.fetch()` van a REST y, si hay caché,
  hidratan solo esos resultados.

Esto responde directamente al problema de discord.js: la memoria no crece con el
tamaño del servidor salvo que el usuario lo pida.

### 5.5 Estructuras

Una estructura es una **vista**:

```ts
class Guild {
  readonly id: Snowflake;
  readonly client: Client;
  readonly raw: APIGuild;                 // payload original
  get name() { return this.raw.name; }
  get ownerId() { return this.raw.owner_id; }
  channels: GuildChannelManager;          // operaciones + cache opcional
  members: GuildMemberManager;
  roles: RoleManager;
}
```

- No se copian arrays ni se congelan objetos.
- Los managers exponen `cache` (puede estar vacío), `fetch`, `search`, `edit`, etc.
- `toJSON()` devuelve `structuredClone(raw)` o el raw tal cual (documentado).
- `Message`: `reply`, `edit`, `delete`, `react`, `pin`, `startThread`, `fetch`.
  La estructura recibida conserva `channelId`, `guildId`, `authorId` y `raw`.
- `Interaction` cruda queda envuelta en `CommandContext` (ver §5.6).

Nombres y convenciones:

- `Snowflake = string & { __brand: "Snowflake" }`.
- `Permissions` como `bigint` con helpers `has`, `add`, `remove`.
- Fechas: `Date` en getters (`createdAt`, `joinedAt`), string en `toJSON()`.
- `channel.type` numérico; helpers `isText()`, `isVoice()`, `isThread()`.

### 5.6 Comandos

#### Builders

```ts
const ban = slash("ban", "Expulsa a un miembro")
  .defaultMemberPermissions(Permissions.BanMembers)
  .contexts("Guild")
  .addUser("target", "Miembro a expulsar", (o) => o.required())
  .addString("reason", "Motivo", (o) => o.maxLength(400).autocomplete())
  .addSubcommandGroup("config", "Configuración", (g) => g
    .addSubcommand("set", "Cambia un ajuste", (s) => s
      .addString("key", "Ajuste", (o) => o.required().choices(["log", "mod"]))
      .addString("value", "Valor", (o) => o.required())
      .run(async (ctx) => { /* ... */ })
    )
  )
  .run(async (ctx) => { /* ... */ });
```

Reglas:

- `slash()` devuelve un builder con estado (`LEAF`/`PARENT`) para impedir
  `run()` y `addSubcommand()` a la vez, pero **la validación real también ocurre
  en runtime** (`toJSON()` lanza si es inválido).
- `toJSON()` produce el payload completo, incluyendo opciones, grupos y
  localizaciones. Esta es la corrección del P0 #3.
- `CommandRegistry` guarda por nombre y detecta duplicados.
- `sync()`:
  - `scope: "global" | { guildId }`;
  - compara `name + type` y hace `PUT` del set completo;
  - `deleteMissing` (default `true`) elimina comandos viejos;
  - `dryRun` devuelve el diff;
  - errores por comando, no aborta todo.

#### Runner

```ts
interface CommandContext<Args = Record<string, unknown>> {
  readonly client: Client;
  readonly interaction: InteractionAdapter;
  readonly command: string;
  readonly args: Args;                 // tipado si se usa schema
  readonly guild: Guild | null;
  readonly member: GuildMember | null;
  readonly channel: Channel | null;
  readonly user: User;
  readonly locale: string;
  get t(): Translator;
  reply(data): Promise<InteractionResult>;
  defer(opts?): Promise<void>;
  editReply(data): Promise<InteractionResult>;
  followUp(data): Promise<InteractionResult>;
  update(data): Promise<InteractionResult>;
  modal(modal): Promise<void>;
  autocomplete(choices): Promise<void>;
}
```

- El runner resuelve grupo/subcomando desde `data.options` (tipo 1 y 2) y
  ejecuta la cadena de middlewares:
  `global → guild? → command → group → subcommand → handler`.
- Middleware: `(ctx, next) => void | Promise<void>`; `next()` una sola vez; si no
  se llama, se corta la cadena. `false` ya no es necesario.
- Errores: `onCommandError` configurable; por defecto responde (o edita) con un
  mensaje genérico y emite `error` con `command`, `interactionId`, `cause`.
- `autoDefer`: opcional por comando (`{ defer: "public" | "ephemeral" }`) y por
  handler si tarda más de `deferAfter` ms. Evita el "interaction failed".
- Autocomplete: handler separado `autocomplete(ctx)`, con `ctx.focused` y
  `ctx.autocomplete(...)`.
- Un `CommandContext` se crea una vez por interacción y se reutiliza en
  middlewares y handler.
- Los args se parsean a un objeto plano (`ctx.args.target` = `User`), con
  coerción por tipo. Se puede añadir un schema Zod opcional para validación.

#### Componentes y modales

- `customId` con codec:
  `arx:<namespace>:<action>:<base64url(JSON)>`, con límite de 100 caracteres.
- Registro:
  ```ts
  client.components.button("confirm:delete", async (ctx) => { ... });
  client.components.select("role", async (ctx) => { ... });
  client.components.modal("feedback", async (ctx) => { ... });
  ```
- Soporte de comodines (`confirm:*`) y de estado con TTL (`ctx.state`), sin
  guardar en memoria global.
- `ctx.update()` para editar el mensaje original de un componente.
- Modales: `Label` (18) obligatorio envolviendo `TextInput` (4), selects,
  `FileUpload` (19), `RadioGroup` (21), `CheckboxGroup` (22), `Checkbox` (23).

#### Localización

- `name_localizations` / `description_localizations` en builders.
- `client.i18n` con `t(locale, key, params)`; por defecto un mapa de mensajes
  del usuario. No imponer un formato; exponer interfaz.

### 5.7 Builders de mensajes, embeds y componentes

```ts
const payload = message()
  .content("Hola")
  .embed(embed().setTitle("Título").setColor(0x5865f2).addField({ name: "a", value: "b" }))
  .components(
    container({ accent: 0x5865f2 }, [
      text("# Estado"),
      section("Todo operativo", thumbnail("https://.../ok.png")),
      separator(),
      actionRow(button("primary", "Recargar", { customId: "refresh" })),
    ])
  )
  .ephemeral()
  .toJSON();
```

Decisiones:

- Un solo `MessagePayload` builder para enviar/editar/responder. `toJSON()`
  valida límites y decide el flag V2:
  - si hay componentes V2 → `flags |= 1 << 15`; no se permite `content`/`embeds`.
  - si hay V1 → `content`, `embeds` y `components` normales.
- `EmbedBuilder` funcional y tipado, sin plantillas mágicas. El sistema de
  plantillas (`EmbedTemplateV1`, `toTemplate`, `MessageComponentTemplate`) se
  eliminó en M1: aportaba complejidad de tipos y no sustituía parámetros en
  runtime. `MessageLayout` ahora solo agrupa componentes y serializa.
- Componentes con tipos numéricos correctos:
  `ACTION_ROW=1`, `BUTTON=2`, `STRING_SELECT=3`, `TEXT_INPUT=4`, `USER_SELECT=5`,
  `ROLE_SELECT=6`, `MENTIONABLE_SELECT=7`, `CHANNEL_SELECT=8`, `SECTION=9`,
  `TEXT_DISPLAY=10`, `THUMBNAIL=11`, `MEDIA_GALLERY=12`, `FILE=13`,
  `SEPARATOR=14`, `CONTAINER=17`, `LABEL=18`, `FILE_UPLOAD=19`,
  `RADIO_GROUP=21`, `CHECKBOX_GROUP=22`, `CHECKBOX=23`.
- `componentsV2(children)` helper que añade el flag, como en otros SDKs.
- Validación: 5 action rows, 5 botones por row, 25 opciones de select, 1-3
  text displays por section, 1-10 hijos por container, longitudes de texto.
- Emoji: exportar `{ id?, name, animated? }`, nunca la instancia.

### 5.8 Loaders

- Ruta base explícita, sin `Error.prepareStackTrace`:
  ```ts
  await client.loadCommands(new URL("./commands", import.meta.url));
  ```
- `fs/promises` + `readdir({ withFileTypes: true })`; ignora `dist`, `*.d.ts`,
  `*.map`, `node_modules`.
- Importa `.js` y `.ts` si el runtime lo soporta; error claro si no.
- Acepta `export default command`, `export const command`, o un array de ambos.
- Valida instancia/forma con un type guard estructural, no `instanceof` (evita
  el problema de doble copia del paquete).
- Duplicados: error agregado al final con todos los nombres repetidos.
- Hot reload opcional: `watch: true`, con `import(url + "?v=" + mtime)`.
- Eventos y componentes se cargan igual (`loadEvents`, `loadComponents`).

---

## 6. Diseño detallado de `@arx.js/discord.js`

### 6.1 Objetivo

Que un usuario de discord.js obtenga:

- La misma API de comandos/builders que `@arx.js/discord`.
- Caché de discord.js desactivada o limitada por defecto (el problema original).
- Loaders y router ya resueltos.
- Un escape hatch total a discord.js.

### 6.2 Implementación

Se usa **composición**, no herencia: `discord.js.Client` ya define `user` como
`ClientUser | null`, y el kit necesita `user` como estructura lazy. Componer
evita ese choque de tipos y deja el cliente original accesible en `native`.

```ts
export class Client extends EventEmitter implements ContextClient {
  readonly native: DiscordJsClient;
  readonly rest: RestLike;                 // delegado a native.rest
  readonly cache: CacheStore;
  readonly commands: CommandRegistry;
  readonly router: InteractionRouter;
  user: User | null = null;
  applicationId: string | null = null;

  constructor(options: ArxClientOptions) {
    super();
    this.native = new DiscordJsClient({
      ...options.native,                   // opciones crudas de discord.js
      intents: resolveIntents(options.intents),
      makeCache: createCacheFactory(options.cache),
      sweepers: {},
    });
  }

  async start(token?: string) {
    await this.native.login(token ?? this.token);
  }
}
```

- `createCacheFactory`: `messages`, `presences` y `members` en `0` por defecto;
  guilds, channels y roles se dejan a discord.js.
- `DiscordJsRestAdapter`: implementa `RestLike` sobre `native.rest`.
- `raw.ts`: reconstruye el payload API mínimo desde las estructuras de
  discord.js (discord.js v14 no expone `toRaw()`); las opciones, miembros,
  canales, roles y campos de modal se vuelven a serializar.
- `DiscordJsInteractionAdapter`: usa los métodos nativos de respuesta y devuelve
  estructuras `Message` del kit.
- Los eventos se reemiten con nombres API (`MESSAGE_CREATE`, `GUILD_CREATE`...) y
  también con el nombre de discord.js (`messageCreate`...).
- `client.native`: el `Client` original para quien necesite
  `client.guilds.fetch()` o cualquier API no cubierta.
- `client.commands` es el **mismo** `CommandRegistry` del kit.
- `client.loadCommands()` reutiliza el loader del kit.
- Los builders y estructuras del kit se exportan desde el paquete para que el
  código sea portable. Las estructuras del kit se construyen desde `raw`, así que
  funcionan igual con ambos drivers.

### 6.3 Qué no hacer

- No heredar y sobrescribir métodos de discord.js de forma incompatible.
- No mantener dos registros de comandos (uno en `client.commands` de discord.js y
  otro en el kit).
- No reexportar todo `discord.js`; exportar un subconjunto estable y documentar
  `client.native` como escape hatch.
- No obligar a usar las estructuras del kit: si el usuario quiere un
  `GuildMember` de discord.js, lo obtiene con `member.native`.

### 6.4 Nombre y metadatos

- Renombrar a `@arx.js/discord.js`.
- `exports`, `types`, `files`, `build`, `sideEffects: false`.
- `peerDependencies: { "discord.js": "^14.27.0" }` y `dependencies` solo del kit.
- `@arx.js/tools` no debe usarse para la caché del bot; la caché del kit es
  propia. Si se usa `Memory` para el registro de módulos, declararlo.

---

## 7. API pública propuesta (resumen)

```ts
// @arx.js/discord
export { Client } from "./native/client";
export { Intents, Permissions, ChannelType, MessageFlags } from "./kit/constants";
export { slash, command, subcommand, group } from "./kit/commands";
export { message, embed, actionRow, button, stringSelect, container, section,
         text, thumbnail, mediaGallery, file, separator, label, textInput,
         fileUpload, radioGroup, checkboxGroup, checkbox } from "./kit/builders";
export { Guild, Channel, Member, Role, User, Message } from "./kit/structures";
export type { CommandContext, InteractionAdapter, ArxDriver, CacheOptions } from "./kit";

// @arx.js/discord.js
export { Client } from "./client";
export * from "@arx.js/discord/kit";   // mismos builders, contextos y tipos
```

---

## 8. Reutilización de KyneticLibs (copiar y adaptar)

Regla: **copiar el archivo, adaptar imports/estilo y añadir tests**. Nunca
importar `@kyneticweb/*` desde Arx.

| Origen Kynetic | Destino en Arx | Qué copiar | Adaptación |
| --- | --- | --- | --- |
| `packages/container/src/item-store.ts` | `packages/discord/src/kit/cache/store.ts` | Base de `Map` con `getOrThrow`, `entries`, `clone` | Añadir LRU + TTL + `sweep()` |
| `packages/container/src/basic-container.ts` | `packages/discord/src/kit/cache/collection.ts` | API de contenedor tipado | Renombrar a `Collection<K,V>`; sin `toolKind` |
| `packages/container/src/strict-container.ts` | `packages/tools/src/cache/` (futuro) | Tipado de claves | Solo si se unifica la caché de tools |
| `packages/console/src/log-store.ts` | `packages/discord/src/kit/logger/store.ts` | Buffer circular con `maxEntries` | Sin blessed; interfaz `Logger` |
| `packages/console/src/log-writer.ts` | `packages/discord/src/kit/logger/writer.ts` | Persistencia y rotación | Inyección de `fs` para tests |
| `packages/console/src/formatters.ts` | `packages/discord/src/kit/logger/format.ts` | Color y formato de línea | Sin depender de `blessed` |
| `packages/console/src/renderers/plain-renderer.ts` | `packages/discord/src/kit/logger/plain.ts` | Render plano | Opcional; el logger del kit puede ser mínimo |
| `packages/utils/src/date-formatter.ts` | `packages/tools/src/format/dates.ts` | Tokens y formateo | Ya existe una implementación similar; unificar en tools, no duplicar |
| `packages/utils/src/identifier.ts` | `packages/discord/src/kit/utils/id.ts` | `randomId` | Para `customId`/correlación; `crypto.randomUUID` |
| `packages/core/src/core.ts` | `packages/discord/src/kit/plugins/registry.ts` | Registro por alias + `dispose` | Adaptar a plugins del bot (no exponer propiedades mágicas) |
| `packages/versions/src/version-manager.ts` | `packages/tools` (futuro) | Comparación de versiones | Solo para un comando `about`/CLI; baja prioridad |
| `packages/parser/src/*` | — | — | No se necesita para slash commands; no copiar |
| `packages/reactive/src/*` | — | — | `Config.onChange` ya cubre el caso; no copiar |
| `compiler`, `dom`, `counter` | — | — | Fuera de alcance |

Notas:

- `packages/tools/src/cache/memory.ts` ya es una adaptación de Kynetic; tiene
  cambios locales sin commitear. No tocarlo en esta fase.
- El logger de Kynetic es más maduro que el de `@arx.js/tools` (renderers,
  rotación, buffer). Vale la pena adaptarlo **una vez** en `kit/logger` y hacer
  que `@arx.js/console` lo use, en lugar de mantener dos consolas.
- La estética de Kynetic (JSDoc bilingüe, errores claros, tests) es el estándar
  que deberían seguir estos paquetes.

---

## 9. Hoja de ruta

### M0 · Higiene y seguridad (1-2 días)

- [x] Revocar el token filtrado y comprobar el historial de git.
- [x] Sacar `src/test/**` del paquete; mover a `examples/basic`.
- [x] Quitar el import con side effects de `src/index.ts`.
- [x] Arreglar `package.json` de ambos paquetes (`exports`, `types`, `build`,
      `sideEffects`, deps reales).
- [x] Añadir scripts raíz: `build`, `test`, `typecheck` para todos.
- [x] CI mínima (typecheck + tests) y Vitest.
- [x] Corregir el augmentation de `ArxConfigRegistry`, importar `./config` en
      `@arx.js/core`, unificar la clave `DISCORD` y arreglar la lectura de claves
      con `/` en el INI.

**Salida:** `import "@arx.js/discord"` no hace nada; `npm run build` construye todo.

### M1 · Tipos, builders y serialización (3-5 días)

- [x] Adoptar `discord-api-types/v10` como dependencia **solo de tipos**.
- [x] `MessagePayload`, `EmbedBuilder`, componentes V1+V2 completos con tipos
      numéricos y validación.
- [x] `CommandBuilder` con `toJSON()` completo (opciones, grupos, localizaciones).
- [x] Tests de snapshot contra payloads válidos de la API.

**Salida:** un comando con opciones/subcomandos se serializa exactamente como
Discord lo espera.

### M2 · REST robusto (3-5 días)

- [x] `BucketManager` (por ruta + major params), cola, rate limit global.
- [x] Reintentos 429/5xx/red con backoff y jitter; timeout/abort.
- [x] Multipart, `reason`, `withResponse`, errores tipados.
- [x] Tests con reloj y `fetch` falsos; casos 429 global, 429 de bucket, 5xx.

**Salida:** 100 peticiones concurrentes respetan buckets y no cuelgan.

### M3 · Gateway (5-7 días)

- [x] `ShardManager` y `Shard` con estados, heartbeat con jitter y ACK.
- [x] Resume, invalid session, close codes, backoff.
- [x] zlib-stream.
- [x] Eventos tipados y dispatcher.
- [x] Tests con servidor WS falso (hello, ack, reconnect, resume, zombie).

**Salida:** el bot sobrevive a caídas de red y reinicia sin perder eventos
resumibles.

### M4 · Estructuras, caché e interacciones (5-7 días)

- [x] `LruTtlMap`, `CacheStore`, updaters opcionales.
- [x] Estructuras lazy + managers (`Guild`, `Channel`, `Member`, `Message`...).
- [x] `InteractionAdapter` nativo (reply/defer/edit/followUp/modal/autocomplete).
- [x] Envío/edición/borrado de mensajes, reacciones, pins, adjuntos.

**Salida:** un bot puede responder a una interacción y enviar mensajes sin
discord.js y sin caché de mensajes.

### M5 · Framework de comandos (5-7 días)

- [x] `CommandRegistry`, `sync()` con diff y `deleteMissing`.
- [x] Runner con grupos/subcomandos, middleware, args tipados, errores.
- [x] Router de botones/selects/modales/autocomplete con codec de `customId`.
- [x] Loaders de comandos/eventos/componentes.
- [x] `autoDefer`, `ctx.t`, guards de permisos.

**Salida:** API de bot completa y testeada de extremo a extremo con un gateway
falso.

### M6 · Bridge discord.js (4-6 días)

- [x] Renombrar paquete y arreglar metadatos.
- [x] `DiscordJsInteractionAdapter` + reconstrucción del payload API (`raw.ts`).
- [x] Caché segura por defecto y sweepers.
- [x] Reexportar kit; `client.native` como escape hatch.
- [x] Suite de conformidad de superficie y adaptadores.

**Salida:** el mismo bot funciona cambiando solo el import.

### M7 · Publicación alpha (2-3 días)

- [x] Ejemplos (`examples/ping`, `examples/components-v2`, `examples/bridge`).
- [x] README de ambos paquetes con matriz de compatibilidad y límites.
- [x] Changesets, versión `1.0.0-alpha.2`, `npm publish --dry-run` verificado.
- [x] Benchmarks de memoria: 1 guild vs 100 guilds, con y sin caché.

**Salida:** alpha publicable y medible.

### Fuera de alcance (por ahora)

- Voz (voice) y `@discordjs/voice`.
- Sharding distribuido / múltiples procesos.
- Webhooks entrantes (se pueden añadir como helper REST).
- Comandos de mensaje/prefijo (el foco es slash + componentes).
- Plantillas de embed con types mágicos.

---

## 10. Estrategia de pruebas

| Nivel | Herramienta | Qué cubre |
| --- | --- | --- |
| Unit | Vitest | Builders, validadores, `LruTtlMap`, parser de opciones, codec de `customId`. |
| REST | `undici` MockAgent o `fetch` fake | Buckets, 429, 5xx, multipart, errores. |
| Gateway | `ws` server falso | Hello/ack/resume/reconnect/close codes/zlib. |
| Contrato | Vitest parametrizado | La misma suite para `NativeDriver` y `DiscordJsDriver`. |
| Integración | Guild de pruebas con `DISCORD_TOKEN` (opt-in) | Registro real de comandos, respuesta a interacción. |
| Memoria | `--expose-gc` + snapshots | Caché off vs on; garantía de no fuga. |

Reglas:

- Ningún test requiere red por defecto.
- Reloj y `fetch`/`ws` inyectables.
- Los snapshots de payloads se comparan con tipos de `discord-api-types` para
  detectar campos mal nombrados.

---

## 11. Decisiones pendientes

1. **`discord-api-types`**: ✅ aceptado como dependencia **solo de tipos**.
   Ahorra cientos de tipos y evita drift con la API; no añade runtime.
   Alternativa descartada: generar/copiar los tipos con mantenimiento manual.
2. **Nombre del bridge**: `@arx.js/discord.js` (recomendado) vs
   `@arx.js/discord-bridge`.
3. **Paquete `kit`**: subpath dentro de `@arx.js/discord` (recomendado para
   alpha) vs paquete `@arx.js/discord-kit`.
4. **Tipado de args**: getters estilo discord.js (`ctx.options.getString`) vs
   inferencia completa (`ctx.args.target`). Recomiendo getters en alpha y
   inferencia después; la inferencia puede volverse un infierno de tipos.
5. **Plantillas de embed/componentes**: ✅ eliminadas en M1. Los builders
   serializan directamente y validan en `toJSON()`.
6. **Consola**: unificar en `kit/logger` + `@arx.js/console` (recomendado) vs
   mantener `@arx.js/tools/console` y `@arx.js/console` por separado.

---

## 12. Referencias rápidas de la API

- Gateway: op `0` dispatch, `1` heartbeat, `2` identify, `6` resume, `7`
  reconnect, `9` invalid session, `10` hello, `11` ack.
- Interacciones: `1` PING, `2` APPLICATION_COMMAND, `3` MESSAGE_COMPONENT,
  `4` AUTOCOMPLETE, `5` MODAL_SUBMIT.
- Componentes: `1` row, `2` button, `3` string select, `4` text input,
  `5` user select, `6` role select, `7` mentionable select, `8` channel select,
  `9` section, `10` text display, `11` thumbnail, `12` media gallery, `13` file,
  `14` separator, `17` container, `18` label, `19` file upload, `21` radio group,
  `22` checkbox group, `23` checkbox.
- Flag V2: `1 << 15` (`32768`). Con V2 no se usan `content` ni `embeds`.
- Rate limits REST: buckets por ruta + major params; `429` con `retry_after` en
  segundos; límite global de 50 req/s; identificar 1/5 s.
- Adjuntos: `multipart/form-data` con `payload_json` y `files[n]`.

---

## 13. Criterio de "terminado"

Un paquete está terminado cuando:

1. Se puede importar sin side effects y sin token.
2. `npm run build` y `npm test` pasan desde la raíz.
3. Tiene tests de REST, Gateway, builders y runner; el bridge pasa la misma
   suite de contrato.
4. Un ejemplo mínimo funciona contra Discord real.
5. La memoria se mantiene estable con 100 guilds y caché por defecto.
6. La API pública está documentada y no expone `any` en las rutas principales.
7. No queda ningún `console.*` en el runtime del paquete (solo logger inyectado).
8. No hay secretos en el repo ni en el historial.
