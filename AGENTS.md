# AGENTS.md — Zed ORM

> **Source of truth for all AI agents and developers working on Zed ORM.**
>
> Read this file before modifying code. Search the repository before adding abstractions.
> Prefer reuse over reinvention. Keep packages loosely coupled.

---

## Project vision

**Zed ORM** is a lightweight, TypeScript-first ORM with a Prisma-inspired schema DSL and first-class relational soft deletion.

### What Zed is

- An independent ORM for Node.js / TypeScript
- Prisma-inspired in developer experience (schema DSL familiarity), not a clone
- Designed for PostgreSQL first, MySQL second, with database-independent architecture
- Strong NestJS integration via a dedicated package
- Differentiated by **relational soft delete** as a core feature

### What Zed is not

- **Not** a wrapper around Prisma
- **Not** using Prisma internally
- **Not** a copy of Prisma source code or internals
- **Not** Prisma-compatible (familiar concepts where useful; own APIs where better)
- **Not** a kitchen-sink ORM — correctness and architecture over feature breadth

### Priority order

```text
Correctness → Architecture → Type Safety → Developer Experience → Performance → Feature Breadth
```

---

## Architecture

High-level pipeline:

```text
schema.zed → Lexer → Parser → AST → Schema Validator
                                      ├→ Type Generator → Generated Client → Runtime → Query Builder → Driver
                                      └→ Migration Engine → SQL Migrations
```

NestJS sits above the core:

```text
NestJS → @zed-orm/nestjs → @zed-orm/client → @zed-orm/runtime → Database Driver
```

### Package responsibilities

| Package | npm name | Responsibility |
|---------|----------|----------------|
| `ast` | `@zed-orm/ast` | AST interfaces, node types, source locations. No SQL. No drivers. |
| `parser` | `@zed-orm/parser` | Lexer, tokenizer, parser, syntax errors. Produces AST. No SQL. |
| `schema` | `@zed-orm/schema` | Semantic validation, relation resolution, schema graph. |
| `query-builder` | `@zed-orm/query-builder` | Query IR, parameterized SQL generation, joins, conditions. |
| `runtime` | `@zed-orm/runtime` | Connection lifecycle, query execution, transactions, hooks. |
| `client` | `@zed-orm/client` | Public developer-facing API (`db.user.findMany(...)`). |
| `generator` | `@zed-orm/generator` | Deterministic TypeScript client/type generation. |
| `migration` | `@zed-orm/migration` | Snapshots, diff, migration generation & execution. |
| `cli` | `@zed-orm/cli` | `zed` CLI (`init`, `validate`, `generate`, `migrate`, …). |
| `shared` | `@zed-orm/shared` | Cross-cutting utilities, error base types, shared constants. |
| `drivers/postgres` | `@zed-orm/driver-postgres` | PostgreSQL driver implementation. |
| `drivers/mysql` | `@zed-orm/driver-mysql` | MySQL driver implementation. |
| `nestjs` | `@zed-orm/nestjs` | NestJS module, DI, lifecycle. **Only** package that depends on NestJS. |

### Dependency rules (enforced by design)

```text
parser        → ast, shared
schema        → ast, shared
query-builder → shared          (must NOT depend on parser)
generator     → ast, schema, shared
migration     → ast, schema, shared
runtime       → query-builder, shared (+ driver interfaces)
client        → runtime, shared
cli           → parser, schema, generator, migration, shared
nestjs        → client          (must NOT be depended on by core)
drivers/*     → shared (+ driver interface from runtime/shared)
```

**Hard rules:**

- Parser must not depend on SQL or drivers.
- Query builder must not depend on the parser.
- Database-specific code belongs inside drivers.
- NestJS must not pollute the ORM core.
- Never use Prisma internally. Never copy Prisma source.

---

## Repository structure

```text
zed-orm/
├── AGENTS.md                 # This file — agent/developer source of truth
├── README.md                 # Public project overview
├── LICENSE                   # MIT
├── package.json              # Root workspace scripts
├── pnpm-workspace.yaml       # pnpm workspace definition
├── tsconfig.json             # Base TypeScript config (strict)
├── tsconfig.build.json       # Build-oriented base config
├── eslint.config.js          # ESLint flat config
├── prettier.config.js        # Prettier config
├── vitest.config.ts          # Root Vitest config
│
├── packages/
│   ├── ast/                  # @zed-orm/ast
│   ├── parser/               # @zed-orm/parser
│   ├── schema/               # @zed-orm/schema
│   ├── query-builder/        # @zed-orm/query-builder
│   ├── runtime/              # @zed-orm/runtime
│   ├── client/               # @zed-orm/client
│   ├── generator/            # @zed-orm/generator
│   ├── migration/            # @zed-orm/migration
│   ├── cli/                  # @zed-orm/cli
│   ├── shared/               # @zed-orm/shared
│   ├── drivers/
│   │   ├── postgres/         # @zed-orm/driver-postgres
│   │   └── mysql/            # @zed-orm/driver-mysql
│   └── nestjs/               # @zed-orm/nestjs
│
├── examples/                 # Runnable examples (Milestone 17+)
│   ├── basic/
│   ├── relations/
│   ├── soft-delete/
│   └── nestjs/
│
├── tests/                    # Cross-package integration / e2e tests
├── benchmarks/               # Performance benchmarks (no claims without data)
└── docs/                     # Architecture and feature documentation
    ├── architecture.md
    ├── roadmap.md
    ├── schema.md
    ├── client.md
    ├── relations.md
    ├── soft-delete.md
    ├── migrations.md
    ├── transactions.md
    ├── drivers.md
    ├── performance.md
    └── integrations/
        ├── nodejs.md
        └── nestjs.md
```

### Why this structure

Packages are split by **responsibility boundaries**, not by premature npm publishing convenience. Separation allows independent testing and clear dependency direction. A future umbrella package (`zed-orm`) may re-export the public client for a simpler install experience.

---

## Coding standards

### TypeScript

- `strict: true` everywhere.
- Avoid `any`. Prefer `unknown` with narrowing.
- Prefer explicit return types on public APIs.
- Prefer `readonly` for immutable data structures (AST nodes, configs).
- Use `const` assertions and discriminated unions where they improve safety.
- Target Node.js (see [Node.js support](#nodejs-support)). No browser APIs in core.

### Naming conventions

| Kind | Convention | Example |
|------|------------|---------|
| Packages | `@zed-orm/<name>` | `@zed-orm/parser` |
| Files | `kebab-case.ts` | `schema-validator.ts` |
| Types / interfaces | `PascalCase` | `ModelNode`, `DatabaseDriver` |
| Functions / variables | `camelCase` | `parseSchema`, `findMany` |
| Constants | `SCREAMING_SNAKE` or `camelCase` | `ZED_PARSE_ERROR` |
| Error codes | `ZED_*_ERROR` | `ZED_SCHEMA_ERROR` |
| Generated symbols | Stable, schema-derived | `UserCreateInput` |

### Error handling

- Use structured errors extending a shared `ZedError` base (in `@zed-orm/shared`).
- Include: `code`, actionable `message`, and source location when applicable.
- Never silently swallow errors.
- Never log secrets (connection strings, passwords).

Error code families:

```text
ZED_PARSE_ERROR
ZED_SCHEMA_ERROR
ZED_RELATION_ERROR
ZED_QUERY_ERROR
ZED_MIGRATION_ERROR
ZED_DRIVER_ERROR
ZED_TRANSACTION_ERROR
ZED_SOFT_DELETE_ERROR
ZED_GENERATION_ERROR
```

### Imports & exports

- Prefer explicit named exports. Avoid default exports for library APIs.
- Public entry: `src/index.ts` per package.
- Do not re-export internal modules from the public surface unless intentional.
- Use workspace protocol (`workspace:*`) for internal package dependencies.

### Async patterns

- Prefer `async`/`await` over raw promise chains.
- Public I/O APIs return `Promise<T>`.
- Do not block the event loop with sync FS in hot paths (CLI/init is fine).

### Public API rules

- Document and test public APIs.
- Never silently change public APIs.
- Internal modules may evolve freely; do not expose them accidentally.
- Once published, follow semantic versioning for breaking changes.

---

## Parser rules

*(Implemented starting Milestone 1–2. Design constraints apply now.)*

### Lexer

- Tokenize `schema.zed` into a stream of tokens with source locations.
- Do not use regex as the complete parser.
- Keywords, identifiers, literals, punctuation, comments must be first-class tokens.

### Parser

- Hand-written recursive-descent or equivalent structured parser (not regex).
- Produce a typed AST (`SchemaAST` and node types in `@zed-orm/ast`).
- Must **not** generate SQL.
- Must **not** perform semantic validation (that belongs in `@zed-orm/schema`).

### AST

- AST lives in `@zed-orm/ast` so parser, schema, generator, and migration share one representation.
- Nodes carry source locations (`line`, `column`, `offset`, `length` or equivalent).
- Designed for evolution (add optional fields; avoid breaking node shapes casually).

### Source locations

- Every meaningful node should retain location metadata for diagnostics.
- Errors must report file, line, and column when available.

### Parser errors

- Distinct from semantic validation errors.
- Include error code (`ZED_PARSE_ERROR`), message, and location.
- Be actionable (expected vs received when useful).

### Semantic validation

- Lives in `@zed-orm/schema`, after parsing.
- Validates duplicates, types, attributes, relations, IDs, defaults, indexes, FKs.
- Parser errors and schema errors remain separate categories.

---

## Query system

*(Implemented starting Milestone 5.)*

### Query builder

- Independent of the parser.
- Builds an internal query representation, then emits SQL.
- Supports filters, ordering, pagination, joins, relation queries over time.

### SQL generation

- Always **parameterized**. Never concatenate untrusted values into SQL.
- Dialect-specific quoting/types may be delegated to drivers or dialect helpers inside the query-builder with explicit dialect awareness — never leak `pg`/`mysql2` into the builder.

### Parameterization

- User values → bind parameters (`$1`, `?`, etc. per dialect).
- Identifiers (table/column names) come from trusted schema metadata, properly quoted.

### Relation queries

- Design for efficient execution; avoid naive N+1 by default.
- `include` / `select` semantics planned; implement after basic CRUD is stable.

### Query execution

- Runtime owns execution via `DatabaseDriver`.
- Query builder produces SQL + params; runtime/driver execute.

---

## Database drivers

Drivers implement a shared abstraction (exact interface may evolve; shape below is the target):

```ts
interface DatabaseDriver {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T>;
}
```

**Boundaries:**

- ORM core must not depend on `pg` or `mysql2` directly.
- PostgreSQL is the first fully supported database.
- MySQL follows after PostgreSQL is solid.
- Connection pooling: prefer mature driver/pool support; Zed manages lifecycle.

---

## Migration system

*(Implemented starting Milestone 12.)*

### Schema snapshots

- Persist validated schema state for comparison across versions.

### Schema diff

- Explicit, reviewable operations (add column, create index, …).
- Do not blindly recreate tables.

### Migration generation

- Emit SQL (or structured migration files) that developers can review.

### Migration execution

- Track migration history.
- Support deploy/dev/reset/status workflows via CLI over time.

### Migration safety

- Destructive changes (drop column/table, nullable → required) must warn.
- Never silently destroy data.
- Prefer explicit developer confirmation for dangerous ops in dev workflows.

---

## Soft-delete system

*(Core differentiator. Implemented Milestones 10–11.)*

### Principles

- Soft delete is integrated into the ORM, not a bolt-on helper.
- Models opt in (e.g. `@@softDelete` / equivalent — final syntax TBD for consistency).
- Default reads exclude soft-deleted rows (`deletedAt IS NULL` or configured field).

### Behaviors to support

| Behavior | Intent |
|----------|--------|
| Normal filtering | Exclude deleted by default |
| Deletion | Soft-delete for opted-in models |
| Restoration | Explicit restore API |
| `withDeleted` | Include deleted rows |
| `onlyDeleted` | Only deleted rows |
| Relational soft delete | Propagate per relation policy |
| `cascade` | Soft-delete dependents |
| `restrict` | Block if dependents exist |
| `nullify` | Clear FK references where valid |
| `ignore` | Do not propagate |
| Transactions | Propagation must be transactional |
| Cycles | Detect and handle relation cycles safely |
| Restoration | Prefer explicit relational restore; do not auto-restore graphs without defined semantics |

### Implementation constraints

- Prefer set-based SQL over per-row recursive application loads.
- Do not implement relational soft delete as “load every child and UPDATE one-by-one” unless documented with a strong reason.
- Handle concurrency, partial failure, and already-deleted rows carefully.

---

## Generated client

*(Milestone 6+.)*

- Generator emits TypeScript client, model types, input types, relation/operation types.
- Output must be **deterministic**: same schema → same output (no timestamps/random IDs).
- Generated code should be readable and stable across repeated `zed generate` runs.
- Type safety is a primary feature; invalid query shapes should fail at compile time.

---

## Node.js support

| Requirement | Value |
|-------------|-------|
| Primary runtime | Node.js |
| Minimum (target) | Node.js 20 LTS+ |
| Module systems | ESM first; CJS interop where practical |
| TypeScript | First-class |
| Browser APIs | Not used in core |

Node-specific concerns (FS, process, networking) belong in `runtime`, `cli`, and drivers.
AST / parser / schema / query-builder should stay as runtime-independent as practical.

---

## NestJS integration

Package: `@zed-orm/nestjs` only.

### Planned surface

- `ZedModule.forRoot(...)`
- `ZedModule.forRootAsync(...)`
- `@InjectZed()` (or equivalent DI token)
- `OnModuleInit` / `OnModuleDestroy` for connect/disconnect
- Transactions remain framework-independent (`db.$transaction`); NestJS only wires DI/lifecycle

### Boundary rules

```text
client, runtime, query-builder, parser, schema  MUST NOT depend on NestJS
Only @zed-orm/nestjs depends on NestJS
```

---

## Testing

| Layer | Scope |
|-------|-------|
| Unit | Parser, schema, query-builder, soft-delete logic, pure utils |
| Integration | Real PostgreSQL (later MySQL): CRUD, relations, tx, migrations, soft delete |
| Type tests | Generated client types must reject invalid queries at compile time |
| Migration tests | Diff correctness, safety warnings, execution |
| Database tests | Driver behavior against live engines |
| NestJS tests | Module config, DI, lifecycle, shutdown |
| Benchmarks | Measure; never invent numbers |

Test runner: **Vitest**.

---

## Dependencies

Do not add a dependency unless there is a strong reason.

Before adding, ask:

1. Is it necessary?
2. Can we implement it ourselves reasonably?
3. Bundle/install size impact?
4. Runtime overhead?
5. Maintenance / supply-chain risk?
6. License compatibility?

### Current foundation dependencies (document when changed)

| Dependency | Where | Reason |
|------------|-------|--------|
| `typescript` | root / packages | Language / build |
| `vitest` | root | Unit & integration test runner |
| `eslint` + typescript-eslint | root | Linting |
| `prettier` | root | Formatting |
| `tsup` | packages | Fast dual ESM/CJS builds with DTS |

Driver packages will later add `pg` / `mysql2` **only inside those packages**.
NestJS package will later add `@nestjs/*` **only inside `@zed-orm/nestjs`**.

---

## AI agent rules

Every AI agent must:

1. Read `AGENTS.md` before modifying code.
2. Search the repository before adding new abstractions.
3. Reuse existing abstractions where appropriate.
4. Avoid duplicate functionality.
5. Add tests for new functionality.
6. Update documentation when behavior changes.
7. Never silently change public APIs.
8. Never make large architectural changes without explanation.
9. Never claim incomplete functionality is production-ready.
10. Never use Prisma internally.
11. Never copy Prisma source code.
12. Keep packages loosely coupled.
13. Keep generated code deterministic.
14. Keep database-specific logic inside drivers.
15. Keep parser logic independent from SQL.
16. Keep NestJS integration outside the core ORM.

### Strict architectural change rule

> **Never make a large architectural change without first explaining the problem, proposed solution, alternatives, trade-offs, affected packages, and migration strategy.**

---

## Security

- Always parameterize user values in SQL.
- Never concatenate untrusted input into SQL.
- Never log secrets.
- Never execute arbitrary schema-provided SQL blindly.
- Never disable validation for convenience.
- Fail closed on connection / auth errors; do not swallow them.

---

## Git conventions

Conventional commits:

```text
feat:  fix:  refactor:  test:  docs:  perf:  chore:
```

Examples:

```text
feat(parser): add model declaration parser
feat(soft-delete): add automatic deletedAt filtering
test(parser): add invalid schema cases
```

Keep commits logically isolated.

---

## Current status

**Milestone 0 — Foundation:** complete. 
**Milestone 1 — AST:** complete. 
**Milestone 2 — Parser:** complete. 
**Milestone 3 — Schema validation:** complete (`validateSchema`, `ValidatedSchema`).
**Milestone 4 — PostgreSQL driver:** complete (`createPostgresDriver`, connect/query/transaction).
**Milestone 5 — Query builder:** complete (read path SQL generation for PostgreSQL).
**Milestone 6 — Generated client:** complete (`generateClient`, `zed generate`).
**Milestone 7 — Mutations:** complete (`create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`).
**Milestone 8 — Relations:** complete (`include`, batched relation loading).
**Milestone 9 — Transactions:** complete (`db.$transaction`, commit/rollback, savepoints).
**Milestone 10 — Soft delete:** complete (`@@softDelete`, read filtering, `restore`, `withDeleted` / `onlyDeleted`).
**Milestone 11 — Relational soft delete:** complete (`onSoftDelete` policies, transactional propagation).
**Milestone 12 — Migration engine:** complete (snapshots, diff, reviewable SQL, execution, warnings).
**Milestone 13 — CLI:** complete (`zed init`, `validate`, `generate`, `migrate` dev/deploy/reset/status).
**Milestone 14 — NestJS:** complete (`ZedModule.forRoot` / `forRootAsync`, `@InjectZed`, lifecycle connect/disconnect).
**Milestone 15 — MySQL:** complete (`createMysqlDriver`, MySQL dialect, integration tests).
**Milestone 16 — Performance:** complete (benchmarks in `benchmarks/`, `pnpm bench`).
**Milestone 17 — Production readiness:** complete (CI, examples, release workflow, CONTRIBUTING, versioning).

See `docs/roadmap.md` for milestones and `docs/architecture.md` for deeper design notes.
