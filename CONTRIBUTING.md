# Contributing to Zed ORM

Thank you for contributing. Read [AGENTS.md](./AGENTS.md) first — it is the source of truth for architecture, package boundaries, and coding standards.

## Development setup

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

Integration tests that require PostgreSQL are skipped unless `DATABASE_URL` is set. MySQL driver integration tests use `MYSQL_DATABASE_URL`.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
feat(parser): add model declaration parser
fix(soft-delete): filter deleted rows in findMany
docs: update drivers guide
test(migration): add MySQL enum rendering case
```

## Pull requests

1. Keep changes focused and within package boundaries described in AGENTS.md.
2. Add or update tests for behavior changes.
3. Update docs when public behavior changes.
4. Run `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm lint` before opening a PR.

## Architecture rules (summary)

- Parser must not depend on SQL or drivers.
- Query builder must not depend on the parser.
- Database-specific code belongs in drivers.
- NestJS integration lives only in `@zed-orm/nestjs`.
- Never use Prisma internally.

See [AGENTS.md](./AGENTS.md) for the full list.

## Release process

See [docs/versioning.md](./docs/versioning.md).
