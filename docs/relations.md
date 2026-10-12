# Relations

> **Status:** Done (Milestone 8).

## Supported relation kinds

| Kind | Schema pattern | Loading |
|------|----------------|---------|
| many-to-one | `author User @relation(fields: [authorId], references: [id])` | Batch `WHERE id IN (...)` on parent |
| one-to-many | `posts Post[]` (FK on child) | Batch `WHERE authorId IN (...)` on child |
| one-to-one | Singular `@relation` on FK-owning side | Same as many-to-one |
| many-to-many | `tags Tag[]` ↔ `posts Post[]` (implicit join table) | Join table + related model in one query |

Relation metadata is resolved during schema validation (`@zed-orm/schema`), enriched in the generator (`schema-to-relations`), and consumed by the runtime relation loader.

## `include` / nested `select`

```ts
const users = await db.user.findMany({
  include: {
    posts: {
      select: { id: true, title: true },
      include: { author: true },
    },
  },
});
```

- `include: { field: true }` loads the full related record(s).
- Nested `select` limits scalar columns on the related model.
- Nested `include` continues loading deeper relations.

## N+1 avoidance

The runtime uses **batched queries** per relation level:

1. Load parent rows.
2. Collect foreign-key values.
3. Load all related rows in one `IN (...)` query (or one join query for many-to-many).
4. Attach results in memory.

This avoids per-row relation queries by default.

## Implicit many-to-many tables

Paired list fields without `fields` / `references` use a join table named `_${ModelA}To${ModelB}` (models sorted alphabetically) with columns `A` and `B`. Create this table in migrations before querying.

Soft-delete interaction is documented in [`soft-delete.md`](./soft-delete.md).
