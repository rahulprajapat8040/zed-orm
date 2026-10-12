# Roadmap

Zed ORM ships in ordered milestones. Complete each milestone with tests and docs before expanding scope.

Status legend: `planned` · `in progress` · `done`

---

## Milestone 0 — Foundation

**Status:** done

- [x] `AGENTS.md`
- [x] Monorepo (pnpm workspaces)
- [x] TypeScript (strict)
- [x] Testing harness (Vitest)
- [x] Linting (ESLint)
- [x] Formatting (Prettier)
- [x] Package boundaries + minimal entry points
- [x] CI-ready structure
- [x] README + architecture docs

**Exit criteria:** `pnpm install`, `pnpm build`, `pnpm typecheck`, `pnpm test`, and `pnpm lint` succeed.

---

## Milestone 1 — AST

**Status:** done

- [x] AST types and node kinds
- [x] Source location / span types
- [x] Schema representation (`SchemaAST`, models, fields, enums, datasources, generators)
- [x] Factories and type guards
- [x] Unit tests
- [x] No SQL, no validation logic beyond types

---

## Milestone 2 — Parser

**Status:** done

- [x] Lexer / tokens
- [x] Recursive-descent parser producing AST
- [x] Syntax errors with locations and `ZED_PARSE_ERROR`
- [x] Unit tests for valid and invalid schemas

---

## Milestone 3 — Schema validation

**Status:** done

- [x] Model / field / attribute validation
- [x] Relation resolution
- [x] Semantic error codes (`ZED_SCHEMA_ERROR`, `ZED_RELATION_ERROR`)
- [x] Validated schema graph for downstream tools

---

## Milestone 4 — PostgreSQL driver

**Status:** done

- [x] `DatabaseDriver` implementation for Postgres
- [x] Connect / disconnect
- [x] Parameterized queries
- [x] Transactions
- [x] Integration tests against real PostgreSQL (set `DATABASE_URL` to run)

---

## Milestone 5 — Query builder

**Status:** done

- [x] `findUnique` / `findFirst` / `findMany`
- [x] `where`, `select`, `orderBy`, `take`, `skip`
- [x] Parameterized SQL generation
- [x] Unit tests for SQL shape + params

---

## Milestone 6 — Generated client

**Status:** done

- [x] Deterministic TypeScript generation
- [x] Model types, input types, query APIs
- [x] `zed generate` (minimal CLI surface)
- [x] Type tests

---

## Milestone 7 — Mutations

**Status:** done

- [x] `create` / `createMany`
- [x] `update` / `updateMany`
- [x] `delete` / `deleteMany` (hard delete until soft-delete milestone)
- [x] Tests for CRUD round-trips

---

## Milestone 8 — Relations

**Status:** done

- [x] one-to-one, one-to-many, many-to-one, many-to-many
- [x] `include` / nested `select`
- [x] Efficient loading strategy (batched `IN` queries, avoid default N+1)

---

## Milestone 9 — Transactions

**Status:** done

- [x] `db.$transaction`
- [x] Commit / rollback
- [x] Savepoints for nested transactions
- [x] Clear nested-transaction semantics (savepoints, not faked connections)

---

## Milestone 10 — Soft delete

**Status:** done

- [x] Opt-in model soft delete (`@@softDelete` + `deletedAt DateTime?`)
- [x] Automatic filtering on reads
- [x] Soft `delete` / `deleteMany`
- [x] `restore` / `restoreMany`
- [x] `withDeleted` / `onlyDeleted`

---

## Milestone 11 — Relational soft delete

**Status:** done

- [x] Policies: `Cascade`, `Restrict`, `Nullify`, `Ignore` via `onSoftDelete` on `@relation`
- [x] Transaction-safe, set-based SQL
- [x] Cycle handling (visited planning for cascade)
- [x] Explicit restoration semantics (no auto-restore of dependents)

---

## Milestone 12 — Migration engine

**Status:** done

- [x] Schema snapshots
- [x] Schema diff
- [x] Migration generation (reviewable SQL)
- [x] Migration execution + history (`_zed_migrations`)
- [x] Destructive-change warnings

---

## Milestone 13 — CLI

**Status:** done

- [x] `zed init`
- [x] `zed validate`
- [x] `zed generate`
- [x] `zed migrate` (dev / deploy / reset / status)
- [ ] `zed db` / `zed format` as they mature

---

## Milestone 14 — NestJS

**Status:** done

- [x] `ZedModule.forRoot` / `forRootAsync`
- [x] `@InjectZed` (and `ZED_CLIENT` token)
- [x] Lifecycle connect/disconnect (`OnModuleInit` / `OnModuleDestroy`)
- [x] NestJS integration tests
- [x] NestJS example app (`examples/nestjs/`)

---

## Milestone 15 — MySQL

**Status:** done

- [x] `@zed-orm/driver-mysql` (`mysql2`, pooling, transactions, savepoints)
- [x] MySQL dialect in query builder and migration engine
- [x] Provider-aware generated clients and `zed migrate`
- [x] Dialect differences documented (`docs/drivers.md`)
- [x] Integration tests (`MYSQL_DATABASE_URL`)

---

## Milestone 16 — Performance

**Status:** done

- [x] Benchmarks: parse, SQL generation, soft-delete propagation, client generation, migration diff
- [x] Package `dist/` size tracking
- [x] `pnpm bench` script
- [x] Measured results in `docs/performance.md`

---

## Milestone 17 — Production readiness

**Status:** done

- [x] Runnable examples (`basic`, `relations`, `soft-delete`, `nestjs`)
- [x] CI matrix (Node 20, 22) with PostgreSQL service
- [x] Release workflow (`.github/workflows/release.yml`)
- [x] `CONTRIBUTING.md`, `CHANGELOG.md`, versioning policy
- [x] Updated README and integration docs

---

## Explicitly deferred

Do not schedule until the core is stable:

- Middleware / query extensions
- Read replicas
- Studio / admin UI
- SQLite / CockroachDB / serverless adapters
- Full Prisma API compatibility

---

## Recommendation after Milestone 17

Core milestones are complete. Next work should focus on deferred features (middleware, read replicas, additional databases) only after stabilizing the published API and gathering real-world feedback.
