# Node.js integration

> **Status:** Implemented (Milestones 6–7).

Zed targets **Node.js 20 LTS+** as the primary runtime.

- TypeScript and JavaScript
- ESM first; CJS where practical
- No browser APIs in core packages

## Generated client

Run `zed generate` to emit a typed client from `schema.zed`:

```ts
import { createClient } from "./generated/zed/index.js";

const db = createClient({
  databaseUrl: process.env.DATABASE_URL!,
});

await db.connect();

const users = await db.user.findMany();
await db.user.create({ data: { email: "you@example.com" } });

await db.disconnect();
```

The generated client selects the database driver from your schema datasource (`postgresql` or `mysql`).

## Examples

See [examples/basic](../../examples/basic/) for a minimal runnable project.

Node-specific I/O belongs in `runtime`, `cli`, and drivers.
