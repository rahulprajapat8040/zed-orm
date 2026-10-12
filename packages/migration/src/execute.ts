import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { MigrationError } from "./errors.js";
import {
  DEFAULT_MIGRATIONS_DIR,
  createMigrationsTableSql,
  MIGRATIONS_TABLE,
} from "./history.js";
import type {
  MigrationExecutor,
  MigrationRecord,
  MigrationStatus,
  PendingMigration,
} from "./types.js";

interface MigrationHistoryRow {
  readonly name: string;
  readonly applied_at: string | Date;
}

const MIGRATION_FILE_NAME = "migration.sql";

async function listMigrationDirectories(
  migrationsDir: string,
): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(migrationsDir);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return [];
    }
    throw error;
  }

  const directories: string[] = [];
  for (const entry of entries) {
    const fullPath = join(migrationsDir, entry);
    const entryStat = await stat(fullPath);
    if (entryStat.isDirectory()) {
      directories.push(entry);
    }
  }

  return directories.sort((left, right) => left.localeCompare(right));
}

/** Ensure the migration history table exists. */
export async function ensureMigrationsTable(
  executor: MigrationExecutor,
): Promise<void> {
  await executor.query(createMigrationsTableSql());
}

/** Read applied migrations from the database. */
export async function getAppliedMigrations(
  executor: MigrationExecutor,
): Promise<readonly MigrationRecord[]> {
  await ensureMigrationsTable(executor);
  const result = await executor.query<MigrationHistoryRow>(
    `SELECT name, applied_at FROM "${MIGRATIONS_TABLE}" ORDER BY name ASC`,
  );

  return result.rows.map((row) => ({
    name: row.name,
    appliedAt: new Date(row.applied_at),
  }));
}

/** Load pending migration files from disk. */
export async function loadPendingMigrations(
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
  appliedNames: readonly string[] = [],
): Promise<readonly PendingMigration[]> {
  const applied = new Set(appliedNames);
  const directories = await listMigrationDirectories(migrationsDir);
  const pending: PendingMigration[] = [];

  for (const directory of directories) {
    if (applied.has(directory)) {
      continue;
    }

    const migrationPath = join(migrationsDir, directory, MIGRATION_FILE_NAME);
    let sql: string;
    try {
      sql = await readFile(migrationPath, "utf8");
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        continue;
      }
      throw error;
    }

    pending.push({
      name: directory,
      path: migrationPath,
      sql,
    });
  }

  return pending;
}

/** Get migration status (applied + pending). */
export async function getMigrationStatus(
  executor: MigrationExecutor,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<MigrationStatus> {
  const applied = await getAppliedMigrations(executor);
  const pending = await loadPendingMigrations(
    migrationsDir,
    applied.map((record) => record.name),
  );
  return { applied, pending };
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

/** Apply a single migration and record it in history. */
export async function applyMigration(
  executor: MigrationExecutor,
  name: string,
  sql: string,
): Promise<void> {
  await ensureMigrationsTable(executor);

  const statements = splitSqlStatements(sql);
  for (const statement of statements) {
    await executor.query(`${statement};`);
  }

  await executor.query(
    `INSERT INTO "${MIGRATIONS_TABLE}" (name) VALUES ($1)`,
    [name],
  );
}

/** Apply all pending migrations in order. */
export async function applyPendingMigrations(
  executor: MigrationExecutor,
  migrationsDir: string = DEFAULT_MIGRATIONS_DIR,
): Promise<readonly string[]> {
  const status = await getMigrationStatus(executor, migrationsDir);
  const applied: string[] = [];

  for (const migration of status.pending) {
    try {
      await applyMigration(executor, migration.name, migration.sql);
      applied.push(migration.name);
    } catch (cause) {
      throw new MigrationError(
        `Failed to apply migration '${migration.name}'.`,
        { cause },
      );
    }
  }

  return applied;
}

/** Drop migration history and all tables listed in a reset script. */
export async function resetDatabase(
  executor: MigrationExecutor,
  dropSql: readonly string[],
): Promise<void> {
  for (const statement of dropSql) {
    await executor.query(statement);
  }

  await executor.query(`DROP TABLE IF EXISTS "${MIGRATIONS_TABLE}"`);
}
