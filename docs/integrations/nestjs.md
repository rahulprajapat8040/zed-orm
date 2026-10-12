# NestJS integration

> **Status:** Implemented (Milestone 14). Package: `@zed-orm/nestjs`.

## Boundaries

Only `@zed-orm/nestjs` may depend on NestJS. Core ORM packages must not.

## Installation

```bash
pnpm add @zed-orm/nestjs @nestjs/common @nestjs/core reflect-metadata
```

Your app also needs the **generated** Zed client for your schema (`zed generate`).

## `ZedModule.forRoot`

Register the generated client factory and database URL. The module connects on init and disconnects on shutdown.

```ts
import { Module } from "@nestjs/common";
import { ZedModule } from "@zed-orm/nestjs";
import { createClient } from "./generated/zed/client.js";

@Module({
  imports: [
    ZedModule.forRoot({
      databaseUrl: process.env.DATABASE_URL!,
      createClient,
    }),
  ],
})
export class AppModule {}
```

Pass a pre-built client instead when testing:

```ts
ZedModule.forRoot({ client: mockClient, isGlobal: false })
```

## `ZedModule.forRootAsync`

```ts
ZedModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    databaseUrl: config.getOrThrow<string>("DATABASE_URL"),
    createClient,
  }),
})
```

## `@InjectZed()`

Inject the client in services or resolvers:

```ts
import { Injectable } from "@nestjs/common";
import { InjectZed } from "@zed-orm/nestjs";
import type { GeneratedClient } from "./generated/zed/client.js";

@Injectable()
export class UsersService {
  constructor(@InjectZed() private readonly db: GeneratedClient) {}

  findAll() {
    return this.db.user.findMany();
  }
}
```

The injection token is also exported as `ZED_CLIENT` if you prefer `@Inject(ZED_CLIENT)`.

## Lifecycle

`ZedLifecycleService` (registered automatically) implements `OnModuleInit` / `OnModuleDestroy`:

- **Init:** `client.connect()`
- **Destroy:** `client.disconnect()`

## Transactions

NestJS does not own transactions. Use the generated client:

```ts
await this.db.$transaction(async (tx) => {
  await tx.user.create({ data: { /* … */ } });
});
```

## Example

See [`examples/nestjs/`](../../examples/nestjs/).
