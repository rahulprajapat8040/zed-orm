# Migrations

> **Status:** Implemented (Milestones 12–13).

## Goals

- Schema snapshots and explicit diffs
- Reviewable migration files (no silent table rebuilds)
- Execution with migration history
- Warnings for destructive changes

## Workflow

1. Define models in `schema.zed`.
2. Run `zed migrate dev` to diff against the last snapshot, write SQL, and apply it.
3. Commit `migrations/` and `migrations/snapshot.json` with your schema changes.
4. Run `zed migrate deploy` in CI/production to apply pending migrations.

## CLI surface

```bash
zed migrate dev [--name <slug>]   # create + apply migration from schema diff
zed migrate deploy                # apply pending migrations
zed migrate reset                 # drop schema objects and reapply all migrations
zed migrate status                # list applied and pending migrations
```

`DATABASE_URL` (or `--url`) is required for commands that touch the database.

## On-disk layout

```text
migrations/
  snapshot.json                   # last applied schema snapshot
  20251012120000_init/
    migration.sql
```

Applied migrations are tracked in the `_zed_migrations` table.

## Destructive changes

Dropping tables/columns, narrowing types, or making optional fields required produce warnings during `zed migrate dev`. Review generated SQL before deploying.

Never silently destroy data. Prefer explicit, reviewable SQL.
