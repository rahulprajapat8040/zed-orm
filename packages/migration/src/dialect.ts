import type { MigrationProvider, SnapshotColumnType } from "./types.js";

/** Quote a SQL identifier for the target provider. */
export function quoteIdentifier(provider: MigrationProvider, name: string): string {
  if (provider === "postgresql") {
    return `"${name.replaceAll('"', '""')}"`;
  }
  if (provider === "mysql") {
    return `\`${name.replaceAll("`", "``")}\``;
  }
  return name;
}

/** Map a Zed scalar type to a provider-specific column type. */
export function scalarToSqlType(
  provider: MigrationProvider,
  scalar: string,
): string {
  if (provider === "mysql") {
    switch (scalar) {
      case "String":
        return "VARCHAR(191)";
      case "Int":
        return "INT";
      case "BigInt":
        return "BIGINT";
      case "Float":
        return "DOUBLE";
      case "Decimal":
        return "DECIMAL(65, 30)";
      case "Boolean":
        return "BOOLEAN";
      case "DateTime":
        return "DATETIME(3)";
      case "Json":
        return "JSON";
      case "Bytes":
        return "BLOB";
      default:
        return "TEXT";
    }
  }

  switch (scalar) {
    case "String":
      return "TEXT";
    case "Int":
      return "INTEGER";
    case "BigInt":
      return "BIGINT";
    case "Float":
      return "DOUBLE PRECISION";
    case "Decimal":
      return "DECIMAL";
    case "Boolean":
      return "BOOLEAN";
    case "DateTime":
      return "TIMESTAMPTZ";
    case "Json":
      return "JSONB";
    case "Bytes":
      return "BYTEA";
    default:
      return "TEXT";
  }
}

/** Render a column type for the target provider. */
export function renderColumnSqlType(
  provider: MigrationProvider,
  columnType: SnapshotColumnType,
): string {
  if (columnType.kind === "enum") {
    if (provider === "mysql") {
      const renderedValues = columnType.values
        .map((value) => `'${value.replaceAll("'", "''")}'`)
        .join(", ");
      return `ENUM(${renderedValues})`;
    }
    return quoteIdentifier(provider, columnType.enumName);
  }
  return scalarToSqlType(provider, columnType.scalar);
}
