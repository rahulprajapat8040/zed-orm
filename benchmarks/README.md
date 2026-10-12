# Benchmarks

Performance benchmarks for Zed ORM (Milestone 16).

**Rule:** Never publish performance claims without running benchmarks in this directory.

## Run

```bash
pnpm build   # required for package-size benchmarks
pnpm bench
```

## Suites

| File | Measures |
|------|----------|
| `parse.bench.ts` | Schema parsing and validation |
| `sql-generation.bench.ts` | Query builder SQL generation |
| `client-startup.bench.ts` | Client code generation |
| `soft-delete-propagation.bench.ts` | Relational soft-delete planning |
| `migration-diff.bench.ts` | Schema snapshot diffing |
| `package-size.bench.ts` | Built `dist/` size per package |

Results are environment-dependent. Record numbers in [docs/performance.md](../docs/performance.md) only from local or CI runs.
