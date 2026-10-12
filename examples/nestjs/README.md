# NestJS example

Demonstrates `ZedModule`, dependency injection, lifecycle connect/disconnect, and CRUD via a generated client.

## Layout

```text
examples/nestjs/
├── schema.zed
├── generated/zed/     # output of `zed generate`
├── src/
│   ├── app.module.ts
│   ├── main.ts
│   └── users/
└── package.json
```

## Prerequisites

- Node.js 20+
- PostgreSQL (`DATABASE_URL`)
- `User` table matching `schema.zed` (apply migrations or create manually)

## Run

```bash
pnpm install
pnpm --filter @zed-orm/example-nestjs start
```

`prestart` runs `zed generate` so the client matches `schema.zed`.

## Usage pattern

```ts
import { ZedModule } from "@zed-orm/nestjs";
import { createClient } from "../generated/zed/client.js";

@Module({
  imports: [
    ZedModule.forRoot({
      databaseUrl: process.env.DATABASE_URL!,
      createClient,
    }),
    UsersModule,
  ],
})
export class AppModule {}
```

Inject the client in services with `@InjectZed()`. Transactions stay on the client (`db.$transaction`).
