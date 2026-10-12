# Relations example

Demonstrates one-to-many relations and `include` loading.

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database with `User` and `Post` tables (run migrations or create tables manually)
- Built workspace (`pnpm build` from repo root)

## Run

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/zed"
pnpm install
pnpm start
```
