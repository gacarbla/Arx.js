# Ejemplo: Components V2

Demuestra:

- `Container`, `Section`, `TextDisplay`, `Thumbnail`, `Separator` y `ActionRow`.
- El flag `IS_COMPONENTS_V2` se añade automáticamente.
- `encodeCustomId()` para botones.
- `InteractionRouter` para responder al botón con `ctx.update()`.

```bash
npm run build
export DISCORD_TOKEN="..."
node examples/components-v2/src/index.ts
```
