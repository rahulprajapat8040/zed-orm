import type { SqlDialect } from "./meta.js";

/** Quote a SQL identifier for the target dialect. */
export function quoteIdentifier(dialect: SqlDialect, name: string): string {
  if (dialect === "postgresql") {
    return `"${name.replaceAll('"', '""')}"`;
  }
  if (dialect === "mysql") {
    return `\`${name.replaceAll("`", "``")}\``;
  }
  return name;
}
