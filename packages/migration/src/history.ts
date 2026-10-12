export const MIGRATIONS_TABLE = "_zed_migrations" as const;

export const DEFAULT_MIGRATIONS_DIR = "migrations" as const;

export const SNAPSHOT_FILE_NAME = "snapshot.json" as const;

/** SQL to create the migration history table. */
export function createMigrationsTableSql(): string {
  return `
CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`.trim();
}

/** Format a migration directory name: YYYYMMDDHHMMSS_slug */
export function formatMigrationDirectoryName(slug: string, timestamp = new Date()): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "");
  const safeSlug = normalized.length > 0 ? normalized : "migration";
  const stamp = [
    timestamp.getUTCFullYear(),
    String(timestamp.getUTCMonth() + 1).padStart(2, "0"),
    String(timestamp.getUTCDate()).padStart(2, "0"),
    String(timestamp.getUTCHours()).padStart(2, "0"),
    String(timestamp.getUTCMinutes()).padStart(2, "0"),
    String(timestamp.getUTCSeconds()).padStart(2, "0"),
  ].join("");
  return `${stamp}_${safeSlug}`;
}
