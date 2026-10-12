import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { createMysqlDriver } from "@zed-orm/driver-mysql";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import type { DatabaseDriver } from "@zed-orm/runtime";
import {
  SNAPSHOT_FILE_NAME,
  applyMigration,
  applyPendingMigrations,
  createSnapshot,
  diffSchemas,
  emptySnapshot,
  formatMigrationDirectoryName,
  getMigrationStatus,
  parseSnapshot,
  quoteIdentifier,
  renderMigration,
  resetDatabase,
  serializeSnapshot,
  type MigrationExecutor,
  type MigrationProvider,
  type SchemaSnapshot,
} from "@zed-orm/migration";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";

export interface MigrateCommandOptions {
  readonly schemaPath: string;
  readonly migrationsDir: string;
  readonly databaseUrl?: string;
  readonly name?: string;
}

function parseMigrateArgs(argv: readonly string[]): {
  subcommand: string;
  options: MigrateCommandOptions;
} {
  let subcommand = "help";
  let schemaPath = "zed/zed.schema";
  let migrationsDir: string | undefined;
  let databaseUrl = process.env["DATABASE_URL"];
  let name: string | undefined;

  if (argv[0] !== undefined && !argv[0].startsWith("-")) {
    subcommand = argv[0];
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema" || arg === "-s") {
      schemaPath = argv[index + 1] ?? schemaPath;
      index += 1;
      continue;
    }
    if (arg === "--migrations" || arg === "-m") {
      migrationsDir = argv[index + 1] ?? migrationsDir;
      index += 1;
      continue;
    }
    if (arg === "--url") {
      databaseUrl = argv[index + 1] ?? databaseUrl;
      index += 1;
      continue;
    }
    if (arg === "--name") {
      name = argv[index + 1] ?? name;
      index += 1;
    }
  }

  return {
    subcommand,
    options: {
      schemaPath,
      migrationsDir: migrationsDir ?? join(dirname(schemaPath), "migrations"),
      ...(databaseUrl !== undefined ? { databaseUrl } : {}),
      ...(name !== undefined ? { name } : {}),
    },
  };
}

async function loadCurrentSnapshot(
  migrationsDir: string,
  provider: SchemaSnapshot["provider"],
): Promise<SchemaSnapshot> {
  const snapshotPath = join(migrationsDir, SNAPSHOT_FILE_NAME);
  try {
    const json = await readFile(snapshotPath, "utf8");
    return parseSnapshot(json);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return emptySnapshot(provider);
    }
    throw error;
  }
}

async function loadTargetSnapshot(schemaPath: string): Promise<SchemaSnapshot> {
  const source = await readFile(schemaPath, "utf8");
  const ast = parseSchema(source, schemaPath);
  const schema = validateSchema(ast);
  return createSnapshot(schema);
}

function createDriverForProvider(
  provider: MigrationProvider,
  databaseUrl: string,
): DatabaseDriver {
  if (provider === "mysql") {
    return createMysqlDriver({ databaseUrl });
  }
  return createPostgresDriver({ databaseUrl });
}

async function withExecutor<T>(
  provider: MigrationProvider,
  databaseUrl: string,
  callback: (executor: MigrationExecutor) => Promise<T>,
): Promise<T> {
  const driver = createDriverForProvider(provider, databaseUrl);
  await driver.connect();
  try {
    return await callback(driver);
  } finally {
    await driver.disconnect();
  }
}

function requireDatabaseUrl(databaseUrl?: string): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    console.error("zed migrate: DATABASE_URL is required.");
    return "";
  }
  return databaseUrl;
}

async function writeMigrationFiles(
  migrationsDir: string,
  migrationName: string,
  sql: string,
  snapshot: SchemaSnapshot,
): Promise<string> {
  const migrationDir = join(migrationsDir, migrationName);
  await mkdir(migrationDir, { recursive: true });
  await writeFile(join(migrationDir, "migration.sql"), sql, "utf8");
  await writeFile(
    join(migrationsDir, SNAPSHOT_FILE_NAME),
    serializeSnapshot(snapshot),
    "utf8",
  );
  return migrationDir;
}

async function runMigrateDev(options: MigrateCommandOptions): Promise<number> {
  const databaseUrl = requireDatabaseUrl(options.databaseUrl);
  if (databaseUrl.length === 0) {
    return 1;
  }

  const schemaPath = resolve(options.schemaPath);
  const migrationsDir = resolve(options.migrationsDir);
  const target = await loadTargetSnapshot(schemaPath);
  const current = await loadCurrentSnapshot(migrationsDir, target.provider);
  const diff = diffSchemas(current, target);

  if (diff.operations.length === 0) {
    console.log("zed migrate dev: no schema changes detected.");
    return 0;
  }

  if (diff.warnings.length > 0) {
    console.warn("zed migrate dev: destructive or risky changes detected:");
    for (const warning of diff.warnings) {
      console.warn(`  - ${warning.message}`);
    }
  }

  const rendered = renderMigration(target.provider, diff.operations);
  const migrationName = formatMigrationDirectoryName(
    options.name ?? "migration",
  );
  const migrationDir = await writeMigrationFiles(
    migrationsDir,
    migrationName,
    rendered.sql,
    target,
  );

  await withExecutor(target.provider, databaseUrl, async (executor) => {
    await applyMigration(executor, migrationName, rendered.sql);
  });

  console.log(`zed migrate dev: created and applied ${migrationDir}`);
  return 0;
}

async function resolveMigrationProvider(
  migrationsDir: string,
  schemaPath: string,
): Promise<MigrationProvider> {
  const current = await loadCurrentSnapshot(migrationsDir, "postgresql");
  if (current.tables.length > 0 || current.enums.length > 0) {
    return current.provider;
  }

  const target = await loadTargetSnapshot(schemaPath);
  return target.provider;
}

function buildDropStatements(target: SchemaSnapshot): string[] {
  const tableDrops = target.tables
    .map((table) => table.name)
    .sort((left, right) => right.localeCompare(left))
    .map((tableName) => {
      const quoted = quoteIdentifier(target.provider, tableName);
      if (target.provider === "mysql") {
        return `DROP TABLE IF EXISTS ${quoted};`;
      }
      return `DROP TABLE IF EXISTS ${quoted} CASCADE;`;
    });

  if (target.provider === "mysql") {
    return tableDrops;
  }

  return [
    ...tableDrops,
    ...target.enums
      .map((enumDef) => enumDef.name)
      .sort((left, right) => right.localeCompare(left))
      .map(
        (enumName) =>
          `DROP TYPE IF EXISTS ${quoteIdentifier(target.provider, enumName)} CASCADE;`,
      ),
  ];
}

async function runMigrateDeploy(
  options: MigrateCommandOptions,
): Promise<number> {
  const databaseUrl = requireDatabaseUrl(options.databaseUrl);
  if (databaseUrl.length === 0) {
    return 1;
  }

  const migrationsDir = resolve(options.migrationsDir);
  const schemaPath = resolve(options.schemaPath);
  const provider = await resolveMigrationProvider(migrationsDir, schemaPath);
  const applied = await withExecutor(provider, databaseUrl, async (executor) =>
    applyPendingMigrations(executor, migrationsDir),
  );

  if (applied.length === 0) {
    console.log("zed migrate deploy: no pending migrations.");
    return 0;
  }

  console.log(`zed migrate deploy: applied ${applied.length} migration(s).`);
  return 0;
}

async function runMigrateStatus(
  options: MigrateCommandOptions,
): Promise<number> {
  const databaseUrl = requireDatabaseUrl(options.databaseUrl);
  if (databaseUrl.length === 0) {
    return 1;
  }

  const migrationsDir = resolve(options.migrationsDir);
  const schemaPath = resolve(options.schemaPath);
  const provider = await resolveMigrationProvider(migrationsDir, schemaPath);
  const status = await withExecutor(provider, databaseUrl, async (executor) =>
    getMigrationStatus(executor, migrationsDir),
  );

  console.log("zed migrate status:");
  console.log(`  applied: ${status.applied.length}`);
  for (const record of status.applied) {
    console.log(`    - ${record.name}`);
  }
  console.log(`  pending: ${status.pending.length}`);
  for (const migration of status.pending) {
    console.log(`    - ${migration.name}`);
  }
  return 0;
}

async function runMigrateReset(
  options: MigrateCommandOptions,
): Promise<number> {
  const databaseUrl = requireDatabaseUrl(options.databaseUrl);
  if (databaseUrl.length === 0) {
    return 1;
  }

  const migrationsDir = resolve(options.migrationsDir);
  const schemaPath = resolve(options.schemaPath);
  const target = await loadTargetSnapshot(schemaPath);
  const dropStatements = buildDropStatements(target);

  await withExecutor(target.provider, databaseUrl, async (executor) => {
    await resetDatabase(executor, dropStatements);
    await applyPendingMigrations(executor, migrationsDir);
  });

  console.log("zed migrate reset: database reset and migrations reapplied.");
  return 0;
}

function printMigrateHelp(): void {
  console.log(`zed migrate — database migrations

Usage:
  zed migrate dev [--name <slug>]     Create and apply a migration from schema changes
  zed migrate deploy                  Apply pending migrations
  zed migrate status                  Show applied and pending migrations
  zed migrate reset                   Drop schema objects and reapply all migrations

Options:
  -s, --schema <path>                 Schema file (default: zed/zed.schema)
  -m, --migrations <dir>              Migrations directory (default: beside schema)
      --url <database-url>            Database URL (default: DATABASE_URL env)
      --name <slug>                   Migration name for dev (default: migration)
`);
}

/** Run `zed migrate` subcommands. */
export async function runMigrate(argv: readonly string[]): Promise<number> {
  const { subcommand, options } = parseMigrateArgs(argv);

  switch (subcommand) {
    case "dev":
      return runMigrateDev(options);
    case "deploy":
      return runMigrateDeploy(options);
    case "status":
      return runMigrateStatus(options);
    case "reset":
      return runMigrateReset(options);
    case "help":
    case "--help":
    case "-h":
      printMigrateHelp();
      return 0;
    default:
      console.error(`zed migrate: unknown subcommand '${subcommand}'.`);
      printMigrateHelp();
      return 1;
  }
}
