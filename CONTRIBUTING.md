# Contributing

## Branches

Create branches from `main` using a short, typed prefix:

- `feat/...` — new behavior.
- `fix/...` — bug fix.
- `chore/...` — tooling, dependencies, maintenance.
- `docs/...` — documentation only.
- `test/...` — tests only.
- `ci/...` — GitHub Actions / release automation.

Use lowercase and hyphens: `feat/discord-components-v2`.

## Commits

Use Conventional Commits with a package scope when possible:

```text
feat(discord): add component router
fix(core): read flat INI sections
test(discord): cover gateway resume
docs: add architecture notes
chore(release): prepare 1.0.0-alpha.3
```

Keep commits focused. Do not mix formatting-only changes with behavior changes.

## Local checks

```bash
npm install
npm run build
npm run typecheck
npm test
```

For user-visible changes, add a Changeset:

```bash
npm run changeset
```

Live checks are optional and require a bot token:

```bash
DISCORD_TOKEN=... npm run live-check
```

Never commit tokens, `.env` files, `dist/`, or generated tarballs.

## Pull requests

1. Push the branch.
2. Open a PR against `main`.
3. Fill in the PR template.
4. Wait for CI (`Build, typecheck & test`) to pass.
5. Merge with a merge/squash commit and delete the branch.
6. Tag releases when the version is ready.

## Versions and releases

The repo uses Changesets in prerelease `alpha` mode.

```bash
npm run changeset      # describe the change
npm run version        # apply versions and changelogs
npm run build
npm run typecheck
npm test
```

A release is triggered by a `v*` tag. The GitHub workflow
`.github/workflows/release.yml` publishes the packages in dependency order using
the `NPM_TOKEN` secret. See `RELEASING.md`.
