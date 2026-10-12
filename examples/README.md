# Examples

Runnable examples for Zed ORM. Each example is a workspace package with its own `schema.zed` and generated client.

| Example | Description |
|---------|-------------|
| [basic](./basic/) | Minimal Node.js CRUD |
| [relations](./relations/) | One-to-many relations and `include` |
| [soft-delete](./soft-delete/) | `@@softDelete` and relational cascade |
| [nestjs](./nestjs/) | NestJS module, DI, and lifecycle |

## Prerequisites

- Node.js 20+
- pnpm 9+
- Built workspace (`pnpm build` from repo root)
- `DATABASE_URL` pointing at PostgreSQL (MySQL examples can use `provider = "mysql"` in schema)

## Run an example

```bash
cd examples/basic
export DATABASE_URL="postgresql://user:pass@localhost:5432/zed"
pnpm install
pnpm start
```

The `prestart` script runs `zed generate` before executing the example.
