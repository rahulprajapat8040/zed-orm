# Transactions

> **Status:** Done (Milestone 9).

Framework-independent API on the generated client:

```ts
await db.$transaction(async (tx) => {
  await tx.user.create({ data: { /* ... */ } });
  await tx.post.create({ data: { /* ... */ } });
});
```

## Behavior

| Scenario | Result |
|----------|--------|
| Callback completes | `COMMIT` |
| Callback throws | `ROLLBACK` |
| Nested `tx.$transaction` | PostgreSQL `SAVEPOINT` / `RELEASE` / `ROLLBACK TO` |

All queries inside a transaction must use the `tx` delegates (`tx.user`, `tx.post`, …). Operations on the root `db` client use the connection pool and are **not** part of the open transaction.

## Nested transactions

Nested `tx.$transaction` uses **savepoints**, not separate connections. An inner failure rolls back only the nested work; the outer transaction can still commit if it handles the error or the inner callback succeeds.

```ts
await db.$transaction(async (tx) => {
  await tx.user.create({ data: { id: "u1", email: "a@x.com", role: "USER" } });

  try {
    await tx.$transaction(async (nested) => {
      await nested.user.create({ data: { id: "u2", email: "b@x.com", role: "USER" } });
      throw new Error("abort inner");
    });
  } catch {
    // outer transaction continues; u1 remains visible after commit
  }
});
```

NestJS does not own transactions; it only injects the client.
