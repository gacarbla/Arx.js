# Benchmark: memoria de la caché

Compara la memoria usada por `CacheStore` con la caché por defecto y con
mensajes/miembros activados, para 1 y 100 guilds.

```bash
npm run build
npm run benchmark
```

- `cache off (defaults)`: solo guilds, channels, roles y users.
- `messages on`: además cachea 50 mensajes por guild.
- `members on`: además cachea 25 miembros por guild.
- `messages + members`: ambos.

El benchmark usa `--expose-gc` para medir el heap después de recolectar basura.
