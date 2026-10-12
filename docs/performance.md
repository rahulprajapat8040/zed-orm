# Performance

> **Status:** Implemented (Milestone 16).

## Philosophy

1. Correctness first
2. Benchmark second
3. Optimize measured bottlenecks only

Never publish unsupported performance claims. Numbers below are from `pnpm bench` on the development machine used for Milestone 16 (Node.js 22, Linux).

## How to run

```bash
pnpm build
pnpm bench
```

Benchmarks live in `benchmarks/`. See [benchmarks/README.md](../benchmarks/README.md).

## Measured results

### Schema parsing (ops/sec, higher is better)

| Benchmark | ops/sec | mean |
|-----------|---------|------|
| `parseSchema` | ~20,500 | ~49 µs |
| `validateSchema` | ~18,900 | ~53 µs |

### SQL generation (ops/sec)

| Benchmark | ops/sec | mean |
|-----------|---------|------|
| `buildFindMany` | ~239,500 | ~4.2 µs |
| `buildUpdate` | ~214,000 | ~4.7 µs |
| `buildCreate` | ~195,800 | ~5.1 µs |

### Client generation

| Benchmark | ops/sec | mean |
|-----------|---------|------|
| `generateClient` | ~3,770 | ~266 µs |

### Migration diff

| Benchmark | ops/sec | mean |
|-----------|---------|------|
| `diffSchemas` (empty → schema) | ~438,000 | ~2.3 µs |

### Package `dist/` size (bytes, ESM + CJS + DTS)

| Package | Size |
|---------|------|
| `@zed-orm/migration` | 90,754 |
| `@zed-orm/query-builder` | 64,847 |
| `@zed-orm/ast` | 56,569 |
| `@zed-orm/parser` | 52,994 |
| `@zed-orm/runtime` | 51,009 |
| `@zed-orm/cli` | 49,413 |
| `@zed-orm/generator` | 49,030 |
| `@zed-orm/schema` | 38,531 |
| `@zed-orm/driver-postgres` | 13,745 |
| `@zed-orm/driver-mysql` | 13,335 |
| `@zed-orm/nestjs` | 12,126 |
| `@zed-orm/shared` | 4,444 |
| `@zed-orm/client` | 2,870 |

**Total built core (all packages):** ~539 KB

## Notes

- Results vary by CPU, Node.js version, and system load. Re-run locally before comparing changes.
- Database I/O is excluded from these benchmarks; see integration tests for end-to-end behavior.
- Soft-delete propagation planning is benchmarked in `benchmarks/soft-delete-propagation.bench.ts` (mock executor, no database).
