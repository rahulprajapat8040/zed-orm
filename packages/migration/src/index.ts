/**
 * @zed-orm/migration
 *
 * Schema snapshots, diffing, and migration execution.
 */

export const PACKAGE_NAME = "@zed-orm/migration" as const;

export { MigrationError, type MigrationErrorOptions } from "./errors.js";
export {
  quoteIdentifier,
  renderColumnSqlType,
  scalarToSqlType,
} from "./dialect.js";
export { diffSchemas } from "./diff.js";
export {
  applyMigration,
  applyPendingMigrations,
  ensureMigrationsTable,
  getAppliedMigrations,
  getMigrationStatus,
  loadPendingMigrations,
  resetDatabase,
} from "./execute.js";
export {
  DEFAULT_MIGRATIONS_DIR,
  MIGRATIONS_TABLE,
  SNAPSHOT_FILE_NAME,
  createMigrationsTableSql,
  formatMigrationDirectoryName,
} from "./history.js";
export { discoverJoinTables, type JoinTableSpec } from "./join-tables.js";
export { renderMigration } from "./render.js";
export {
  createSnapshot,
  emptySnapshot,
  parseSnapshot,
  serializeSnapshot,
} from "./snapshot.js";
export { detectDestructiveChanges, withWarnings } from "./warnings.js";
export type {
  DiffResult,
  MigrationExecutor,
  MigrationOp,
  MigrationProvider,
  MigrationQueryResult,
  MigrationRecord,
  MigrationStatus,
  MigrationWarning,
  MigrationWarningKind,
  PendingMigration,
  RenderedMigration,
  SchemaSnapshot,
  SnapshotColumn,
  SnapshotColumnType,
  SnapshotDefault,
  SnapshotEnum,
  SnapshotForeignKey,
  SnapshotIndex,
  SnapshotTable,
  SnapshotUnique,
} from "./types.js";
