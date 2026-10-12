# Basic example

Minimal Node.js CRUD using a generated Zed client.

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL database
- Built workspace (`pnpm build` from repo root)

## Run

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/zed"
pnpm install
pnpm start
```

The `prestart` script runs `zed generate` before executing `src/main.ts`.
