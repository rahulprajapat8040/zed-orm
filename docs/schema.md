# Schema language

> **Status:** AST + parser + semantic validation done (Milestones 1–3).

Zed uses a Prisma-inspired schema DSL (`.zed` files), independently implemented.

## Supported constructs

- `datasource`, `generator`, `model`, `enum`
- Fields with scalar / named types and optionality (`String?`)
- Arrays / relation lists (`Post[]`, `String[]?`)
- Field attributes: `@id`, `@unique`, `@default(...)`, `@updatedAt`, `@relation(...)`, …
- Block attributes: `@@id`, `@@index`, `@@unique`, `@@softDelete` (requires `deletedAt DateTime?`), …
- Relation policies: `onSoftDelete: Cascade | Restrict | Nullify | Ignore` on `@relation`
- Comments: `// line` and `/* block */`

## Initial scalars

`String`, `Int`, `BigInt`, `Float`, `Decimal`, `Boolean`, `DateTime`, `Json`, `Bytes`

## Pipeline

```text
schema.zed → Lexer → Parser → AST → Validator → Validated Schema
```

| Stage | Package | Error code |
|-------|---------|------------|
| Syntax | `@zed-orm/parser` | `ZED_PARSE_ERROR` |
| Semantics | `@zed-orm/schema` | `ZED_SCHEMA_ERROR` / `ZED_RELATION_ERROR` |

## Parsing

```ts
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";

const ast = parseSchema(source, "schema.zed");
const schema = validateSchema(ast);
```

### Validation checks (Milestone 3)

- Duplicate models, enums, fields, enum values
- Unknown types (must be scalar, enum, or model)
- `@id` / `@@id` required per model
- `@updatedAt` only on `DateTime`
- `@relation` fields/references existence and length match
- List relations cannot declare `fields`/`references`
- `@@index` / `@@unique` field references

See [`architecture.md`](./architecture.md) and [`AGENTS.md`](../AGENTS.md).
