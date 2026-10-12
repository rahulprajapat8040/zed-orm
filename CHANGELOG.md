# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MySQL driver (`@zed-orm/driver-mysql`) with connection pooling, transactions, and savepoints
- MySQL dialect support in query builder and migration engine
- Provider-aware generated clients and `zed migrate` driver selection
- Performance benchmarks (`pnpm bench`)
- CI workflow (Node 20/22 matrix, PostgreSQL integration tests)
- Release workflow for npm publishing
- Runnable examples: `basic`, `relations`, `soft-delete`
- `CONTRIBUTING.md` and versioning policy
