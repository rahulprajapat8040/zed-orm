# Soft delete example

Demonstrates `@@softDelete`, relational cascade on delete, and `onlyDeleted` reads.

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database with soft-delete-enabled tables
- Built workspace (`pnpm build` from repo root)

## Run

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/zed"
pnpm install
pnpm start
```
