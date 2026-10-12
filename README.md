# Zed ORM

> A lightweight, TypeScript-first ORM with a Prisma-inspired schema DSL and first-class relational soft deletion.

**Status:** Milestones 0–17 complete. PostgreSQL and MySQL drivers, generated client, migrations, CLI, NestJS integration, benchmarks, and CI are implemented.

Zed is an independent ORM. It is **not** a Prisma wrapper and does **not** use Prisma internally.

## Why Zed?

- Familiar schema experience for Prisma developers, independently implemented
- Strong TypeScript type safety as a primary goal
- First-class **relational soft delete** (cascade / restrict / nullify / ignore)
- Clean package architecture with database drivers at the edges
- Excellent NestJS integration without polluting the ORM core
- PostgreSQL-first, MySQL supported

## Quick start

```bash
# From a project directory
npx zed init
zed validate
zed generate
```

```ts
import { createClient } from "./generated/zed/index.js";

const db = createClient({ databaseUrl: process.env.DATABASE_URL! });
await db.connect();

const users = await db.user.findMany();
await db.user.create({ data: { email: "you@example.com" } });

await db.disconnect();
```

See [docs/client.md](./docs/client.md) and [examples/basic](./examples/basic/).

## Monorepo packages

| Package | Description |
|---------|-------------|
| `@zed-orm/ast` | Schema AST types |
| `@zed-orm/parser` | Schema lexer & parser |
| `@zed-orm/schema` | Semantic validation |
| `@zed-orm/query-builder` | Parameterized SQL builder |
| `@zed-orm/runtime` | Connections, execution, transactions |
| `@zed-orm/client` | Public ORM API |
| `@zed-orm/generator` | Deterministic client generation |
| `@zed-orm/migration` | Migrations |
| `@zed-orm/cli` | `zed` CLI |
| `@zed-orm/shared` | Shared errors & utilities |
| `@zed-orm/driver-postgres` | PostgreSQL driver |
| `@zed-orm/driver-mysql` | MySQL driver |
| `@zed-orm/nestjs` | NestJS module & DI |

## Requirements

- Node.js 20+
- pnpm 9+ (workspace)

## Development

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm bench    # performance benchmarks
```

## Documentation

- [AGENTS.md](./AGENTS.md) — source of truth for contributors and AI agents
- [Architecture](./docs/architecture.md)
- [Roadmap](./docs/roadmap.md)
- [Schema](./docs/schema.md)
- [Client](./docs/client.md)
- [Relations](./docs/relations.md)
- [Soft delete](./docs/soft-delete.md)
- [Migrations](./docs/migrations.md)
- [Drivers](./docs/drivers.md)
- [Performance](./docs/performance.md)
- [NestJS integration](./docs/integrations/nestjs.md)
- [Node.js integration](./docs/integrations/nodejs.md)
- [Versioning](./docs/versioning.md)

## Examples

| Example | Description |
|---------|-------------|
| [basic](./examples/basic/) | Minimal CRUD with generated client |
| [relations](./examples/relations/) | Relations and `include` |
| [soft-delete](./examples/soft-delete/) | Soft delete and cascade |
| [nestjs](./examples/nestjs/) | NestJS module and DI |

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) and [AGENTS.md](./AGENTS.md). Use conventional commits (`feat:`, `fix:`, `docs:`, …).

## License

[MIT](./LICENSE)
