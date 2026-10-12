# Client API

> **Status:** Read + write + relations + transactions done (Milestones 5–9).

## Generated client

Generate a typed client from your schema:

```bash
zed generate
```

The CLI reads `zed/zed.schema` by default and writes the client to the path in
the `output` setting of its `generator client` block. Paths are resolved from
the project root. Pass `--schema` or `--output` to override those defaults.

```ts
import { createClient } from "./src/generated/zed/index.js";

const db = createClient({
  databaseUrl: process.env.DATABASE_URL!,
});

await db.connect();

const user = await db.user.create({
  data: { id: "u1", email: "alice@example.com", role: "USER" },
});

const withPosts = await db.user.findUnique({
  where: { id: "u1" },
  include: { posts: true },
});

await db.disconnect();
```

### Transactions

Wrap multiple operations in a single transaction. Use the `tx` delegates for all queries inside the callback:

```ts
await db.$transaction(async (tx) => {
  const user = await tx.user.create({
    data: { id: "u1", email: "alice@example.com", role: "USER" },
  });
  await tx.post.create({
    data: { id: "p1", title: "Hello", authorId: user.id },
  });
});
```

Nested `tx.$transaction` uses savepoints. See [transactions.md](./transactions.md).

### Read operations

| Operation | Description |
|-----------|-------------|
| `findMany` | Zero or more rows with `where`, `select`, `include`, `orderBy`, `take`, `skip` |
| `findFirst` | First matching row (`LIMIT 1`) |
| `findUnique` | Row by `@id` or `@unique` field (`LIMIT 1`) |

### Write operations

| Operation | Description |
|-----------|-------------|
| `create` | Insert one row (`INSERT … RETURNING`) |
| `createMany` | Insert multiple rows (same field set per batch) |
| `update` | Update one row by unique `where` (`UPDATE … RETURNING`) |
| `updateMany` | Update matching rows (returns `{ count }`) |
| `delete` | Hard-delete one row by unique `where` (`DELETE … RETURNING`) |
| `deleteMany` | Hard-delete matching rows (returns `{ count }`) |

Query arguments are typed per model (`UserFindManyArgs`, `UserCreateInput`, …).

### Relations

Use `include` on read operations to load related records. The runtime batches related queries (`WHERE fk IN (...)`) to avoid N+1 by default.

```ts
await db.user.findMany({
  include: {
    posts: {
      select: { id: true, title: true },
    },
  },
});
```

## Pipeline

```text
zed/zed.schema → parse → validate → generateClient → configured output/
                                      ↓
                            ModelDelegate + query-builder SQL
                                      ↓
                            @zed-orm/driver-postgres
```

## `@zed-orm/client`

The hand-written `@zed-orm/client` package remains a thin boundary stub. Application code should use the **generated** `createClient` factory (Milestone 6+).

## Planned operations (incremental)

Soft delete (later): `restore`, `withDeleted`, `onlyDeleted`

Zed is Prisma-inspired, not Prisma-compatible. APIs may diverge where Zed's design is clearer.
