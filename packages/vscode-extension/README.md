# Zed ORM VS Code extension

Provides syntax highlighting and context-aware schema-language tooling for `.zed` files.

This extension uses the shared Zed ORM parser and schema validator to offer diagnostics and completion for schema files without requiring a database connection.

Completions follow the syntax currently implemented by Zed ORM:

- Field attributes: `@id`, `@unique`, `@default(...)`, `@updatedAt`, and `@relation(...)`.
- Model attributes: `@@id([...])`, `@@unique([...])`, `@@index([...])`, and `@@softDelete`.
- Default functions: `uuid()` and `cuid()` for `String`, and `now()` for `DateTime`; literal suggestions are filtered by field type.
- Relation arguments: `fields`, `references`, `name`, and `onSoftDelete` with its supported policies.

Unsupported Prisma attributes such as `@map`, `@@map`, `@db.*`, and `autoincrement()` are intentionally not suggested. The schema validator reports unsupported attributes and arguments rather than silently accepting them.

## Build and package

From this directory, run `pnpm build` to compile the server dependencies and bundle both the extension entry point and language server into `dist/`. Then run `pnpm exec vsce package` to create the VSIX. The published VSIX contains the bundled runtime and does not require the Zed ORM workspace packages to be installed separately.

Set `zedOrm.debug` to `true` in VS Code settings to log language-server startup, parse failures, completion contexts, and result counts in the **Zed ORM** output channel.
