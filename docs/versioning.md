# Versioning policy

> **Status:** Implemented (Milestone 17).

Zed ORM publishes independent packages under the `@zed-orm/*` scope.

## Semantic versioning

Once published, all public packages follow [Semantic Versioning 2.0.0](https://semver.org/):

| Change | Version bump |
|--------|----------------|
| Breaking API or behavior | Major (`1.0.0` → `2.0.0`) |
| Backward-compatible features | Minor (`1.0.0` → `1.1.0`) |
| Backward-compatible fixes | Patch (`1.0.0` → `1.0.1`) |

## Pre-1.0

While packages remain at `0.x`, minor bumps may include breaking changes. Patch bumps are reserved for fixes.

## Monorepo releases

- Packages version together during early releases for simplicity.
- Tag format: `vX.Y.Z` (e.g. `v0.1.0`).
- Publishing is automated via `.github/workflows/release.yml` when a version tag is pushed.
- Set `NPM_TOKEN` in repository secrets before publishing.

## Public API surface

Treat these as public and semver-governed once published:

- Generated client APIs (`createClient`, model delegates)
- `@zed-orm/runtime` exports used by generated clients
- `@zed-orm/nestjs` module and decorators
- `zed` CLI commands documented in `docs/`

Internal modules may change without a major bump until explicitly documented as public.
