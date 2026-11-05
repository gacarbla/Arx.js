# Publicación

El repo usa **Changesets** en modo prerelease `alpha`.

## Flujo

```bash
# 1. Registrar el cambio
npm run changeset

# 2. Aplicar versiones y changelogs
npm run version

# 3. Verificar
npm run build
npm run typecheck
npm test

# 4. Publicar con la etiqueta alpha
npm run release
# equivale a: npm run build && changeset publish
# changeset publish usa el tag de .changeset/pre.json (alpha)
```

`changeset publish` publica con la etiqueta configurada en `.changeset/pre.json`
(`alpha`). Para una release estable:

```bash
npx changeset pre exit
npx changeset version
npm run release
```

## Dry run

```bash
npm publish --dry-run --tag alpha --workspace=@arx.js/discord
npm publish --dry-run --tag alpha --workspace=@arx.js/discord.js
```

## Requisitos de paquete

- `files: ["dist"]` y `exports` correctos.
- `README.md` incluido automáticamente.
- `sideEffects` ajustado (`false` salvo entry points con registro de config).
- `publishConfig.access: "public"`.

## Versión actual

`1.0.0-alpha.2`.
