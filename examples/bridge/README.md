# Ejemplo: bridge discord.js

El mismo bot que `examples/ping`, cambiando solo el import:

```ts
// nativo
import { Bot } from "@arx.js/discord";

// bridge
import { Client } from "@arx.js/discord.js";
```

```bash
npm run build
export DISCORD_TOKEN="..."
node examples/bridge/src/index.ts
```

- Misma API de comandos, contextos, router, i18n y caché.
- `client.native` / `client.discord` dan acceso a discord.js.
- La caché de mensajes, miembros y presencias está desactivada por defecto.
