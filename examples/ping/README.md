# Ejemplo: ping

Bot mínimo con el driver nativo.

```bash
npm run build
export DISCORD_TOKEN="..."   # PowerShell: $env:DISCORD_TOKEN="..."
node examples/ping/src/index.ts
```

- Carga `src/commands` con `client.loadCommands()`.
- Registra los comandos en `ready` con `client.syncCommands()`.
- El comando recibe un `CommandContext` y responde con `ctx.reply()`.
