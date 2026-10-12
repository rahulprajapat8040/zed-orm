# Soft delete

> **Status:** Done (Milestones 10–11). Core product differentiator.

## Overview

Soft delete is opt-in per model via `@@softDelete`. Models must declare an optional `deletedAt DateTime?` field.

```zed
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  deletedAt DateTime?
  posts     Post[]

  @@softDelete
}
```

## Read behavior

| API | Behavior |
|-----|----------|
| Default reads (`findMany`, `findFirst`, `findUnique`) | Exclude rows where `deletedAt IS NOT NULL` |
| `withDeleted: true` | Include soft-deleted rows |
| `onlyDeleted: true` | Return only soft-deleted rows |

`withDeleted` and `onlyDeleted` cannot be combined.

## Write behavior

| API | Behavior |
|-----|----------|
| `delete` / `deleteMany` on `@@softDelete` models | `UPDATE` sets `deletedAt` (defaults to `new Date()`) |
| `delete` / `deleteMany` on other models | Hard `DELETE` (unchanged) |
| `restore` / `restoreMany` | Clears `deletedAt` for matching **already deleted** rows |

Restoration is **explicit** — restoring a parent does not restore dependents.

## Relational policies

Declare propagation on the FK-owning `@relation`:

```zed
model Post {
  id       String  @id
  authorId String?
  author   User    @relation(
    fields: [authorId],
    references: [id],
    onSoftDelete: Cascade
  )
  deletedAt DateTime?

  @@softDelete
}
```

| Policy | When parent is soft-deleted |
|--------|----------------------------|
| `Cascade` | Soft-delete active dependents (or hard-delete if child has no `@@softDelete`) |
| `Restrict` | Fail if active dependents exist |
| `Nullify` | Set FK columns to `NULL` (FK fields must be optional) |
| `Ignore` | No propagation |

Default policy when omitted: **`Restrict`**.

Many-to-many relations default to **`Ignore`** until join-table semantics are defined.

## Transactions

Relational propagation runs inside a database transaction when deleting from the root client. Nested `$transaction` delegates reuse the active transaction.

## Implementation notes

- Query builder applies soft-delete filters and generates parameterized SQL.
- Runtime `applyRelationalSoftDelete` prefers set-based `UPDATE`/`SELECT` statements.
- Cascade planning tracks visited `(model, ids)` sets to handle relation cycles safely.

See [`relations.md`](./relations.md) and [`client.md`](./client.md).
