# Cross-package tests

Integration and foundation tests that span multiple packages.

- `foundation.test.ts` — Milestone 0 package boundary smoke tests
- `packages/drivers/postgres/src/integration.test.ts` — PostgreSQL driver integration (requires `DATABASE_URL`)
- `packages/generator/src/types.test.ts` — generated type shape tests
- `packages/nestjs/src/zed.module.test.ts` — NestJS module unit tests
- `packages/nestjs/src/nestjs.integration.test.ts` — NestJS + PostgreSQL (requires `DATABASE_URL`)
