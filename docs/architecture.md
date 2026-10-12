# Architecture

This document explains **how** Zed ORM is structured and **why**.

For agent/developer rules, see [`AGENTS.md`](../AGENTS.md).
For delivery order, see [`roadmap.md`](./roadmap.md).

---

## Goals

Zed ORM prioritizes:

1. Correctness
2. Clear package boundaries
3. Type safety
4. Developer experience (Prisma-inspired schema familiarity)
5. Measured performance
6. First-class relational soft delete
7. Excellent NestJS integration **without** polluting the core

Zed is **not** Prisma-compatible and must never wrap or embed Prisma.

---

## Pipeline

```text
                    schema.zed
                         │
                         ▼
                       Lexer
                         │
                         ▼
                       Parser
                         │
                         ▼
                        AST
                         │
                         ▼
                 Schema Validator
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
       Type Generator          Migration Engine
             │                       │
             ▼                       ▼
      Generated Client        SQL Migrations
             │
             ▼
        Zed Runtime
             │
             ▼
       Query Builder
             │
             ▼
      Database Driver
             │
        ┌────┴────┐
        ▼         ▼
   PostgreSQL    MySQL
```

NestJS integration:

```text
NestJS
   │
   ▼
@zed-orm/nestjs
   │
   ▼
@zed-orm/client
   │
   ▼
@zed-orm/runtime
   │
   ▼
Database Driver
```

---

## Package map

| Package | Role | Must not |
|---------|------|----------|
| `@zed-orm/shared` | Errors, constants, small shared utilities | Depend on NestJS, drivers, or SQL dialects |
| `@zed-orm/ast` | Schema AST + locations | Depend on SQL or drivers |
| `@zed-orm/parser` | Lex + parse → AST | Generate SQL; semantic validation |
| `@zed-orm/schema` | Semantic validation + schema graph | Depend on drivers |
| `@zed-orm/query-builder` | Query IR + parameterized SQL | Depend on parser |
| `@zed-orm/runtime` | Connections, execution, transactions | Depend on NestJS or concrete `pg`/`mysql2` |
| `@zed-orm/client` | Public ORM API | Depend on NestJS |
| `@zed-orm/generator` | Deterministic TS client generation | Emit nondeterministic output |
| `@zed-orm/migration` | Snapshots, diff, migrate | Silently destroy data |
| `@zed-orm/cli` | Developer CLI | Embed NestJS |
| `@zed-orm/driver-postgres` | Postgres driver | Leak into core packages |
| `@zed-orm/driver-mysql` | MySQL driver | Leak into core packages |
| `@zed-orm/nestjs` | Nest module / DI / lifecycle | Be imported by core packages |

---

## Design decisions

### 1. Monorepo with many packages

**Why:** Enforces dependency direction and makes each concern independently testable.

**Trade-off:** Slightly more scaffolding than a single package. Acceptable for a library intended for open-source longevity.

### 2. AST in its own package

**Why:** Parser, validator, generator, and migrations all need a shared schema representation without circular deps.

### 3. Parser ≠ validator

**Why:** Syntax errors and semantic errors are different product surfaces. Separating them keeps the parser simpler and diagnostics clearer.

### 4. Query builder ≠ parser

**Why:** Runtime queries are not schema-language parsing. Keeping them separate prevents accidental coupling and lets each evolve independently.

### 5. Drivers own database specifics

**Why:** Core stays portable; `pg` / `mysql2` stay at the edges. PostgreSQL is prioritized first.

### 6. NestJS is an integration, not a core dependency

**Why:** Most Node users should not pull NestJS. Framework lifecycle and DI belong in `@zed-orm/nestjs` only.

### 7. Soft delete is a core subsystem

**Why:** Relational soft delete is a primary differentiator. It must be designed into query filtering, mutations, and relation policies — not bolted on later as middleware-only.

### 8. Deterministic generation

**Why:** Stable diffs, reproducible builds, and trustworthy type-check CI. No timestamps or random IDs in generated output.

### 9. Parameterized SQL only

**Why:** Security. User values never concatenate into SQL strings.

### 10. Incremental milestones

**Why:** Correctness over feature count. Foundation first; each milestone ships testable surface area.

---

## Soft-delete architecture (preview)

Opt-in per model. Default reads exclude soft-deleted rows.

Relational policies (planned):

- `cascade` — soft-delete dependents in-set
- `restrict` — fail if live dependents exist
- `nullify` — clear FKs where allowed
- `ignore` — no propagation

Propagation should prefer **set-based SQL inside a transaction**, with explicit cycle handling. Restoration of relation graphs must be explicit and well-documented — never implicit full-graph restore by default.

Details: [`soft-delete.md`](./soft-delete.md).

---

## Error model

Structured errors with stable codes (`ZED_PARSE_ERROR`, `ZED_SCHEMA_ERROR`, …) live in `@zed-orm/shared` and are specialized per package. Diagnostics should be actionable and include source locations when available.

---

## Testing architecture

```text
packages/*/src/**/__tests__   unit tests close to code
tests/                        cross-package / integration
benchmarks/                   measured performance only
```

Integration tests will use real PostgreSQL. Type tests will assert generated client reject invalid shapes at compile time.

---

## Publishing strategy (future)

Packages may publish independently under `@zed-orm/*`, with a possible umbrella `zed-orm` for ergonomic installs. Do not prematurely complicate versioning before Milestone 17.

---

## What is intentionally not built yet

Milestone 0 provides boundaries and tooling only. The following are **stubs / docs placeholders**:

- Lexer / parser / AST implementations
- Schema validation
- Query builder / runtime / client behavior
- Drivers
- Migrations / CLI commands
- Soft delete
- NestJS module runtime
- Examples beyond placeholders

See [`roadmap.md`](./roadmap.md) for the ordered plan.
