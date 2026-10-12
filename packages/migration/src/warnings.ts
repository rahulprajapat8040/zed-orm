import type { DiffResult, MigrationOp, MigrationWarning } from "./types.js";

function warningForOperation(operation: MigrationOp): MigrationWarning | undefined {
  switch (operation.op) {
    case "dropTable":
      return {
        kind: "dropTable",
        message: `Dropping table '${operation.tableName}' will destroy all rows.`,
        operation,
      };
    case "dropColumn":
      return {
        kind: "dropColumn",
        message: `Dropping column '${operation.tableName}.${operation.columnName}' will destroy column data.`,
        operation,
      };
    case "alterColumn":
      if (
        operation.from.type.kind !== operation.to.type.kind ||
        (operation.from.type.kind === "scalar" &&
          operation.to.type.kind === "scalar" &&
          operation.from.type.scalar !== operation.to.type.scalar) ||
        (operation.from.type.kind === "enum" &&
          operation.to.type.kind === "enum" &&
          operation.from.type.enumName !== operation.to.type.enumName)
      ) {
        return {
          kind: "alterColumnType",
          message: `Changing column type for '${operation.tableName}.${operation.to.name}' may fail or truncate data.`,
          operation,
        };
      }
      if (!operation.from.nullable && operation.to.nullable) {
        return undefined;
      }
      if (operation.from.nullable && !operation.to.nullable) {
        return {
          kind: "makeRequired",
          message: `Making column '${operation.tableName}.${operation.to.name}' required may fail if null values exist.`,
          operation,
        };
      }
      return undefined;
    case "dropIndex":
      return {
        kind: "dropIndex",
        message: `Dropping index '${operation.indexName}' on '${operation.tableName}'.`,
        operation,
      };
    case "dropUnique":
      return {
        kind: "dropUnique",
        message: `Dropping unique constraint '${operation.constraintName}' on '${operation.tableName}'.`,
        operation,
      };
    case "dropForeignKey":
      return {
        kind: "dropForeignKey",
        message: `Dropping foreign key '${operation.constraintName}' on '${operation.tableName}'.`,
        operation,
      };
    default:
      return undefined;
  }
}

/** Detect destructive or risky operations in a diff result. */
export function detectDestructiveChanges(
  operations: readonly MigrationOp[],
): readonly MigrationWarning[] {
  const warnings: MigrationWarning[] = [];
  for (const operation of operations) {
    const warning = warningForOperation(operation);
    if (warning !== undefined) {
      warnings.push(warning);
    }
  }
  return warnings;
}

/** Attach warnings to a diff result. */
export function withWarnings(operations: readonly MigrationOp[]): DiffResult {
  const warnings = detectDestructiveChanges(operations);
  return { operations, warnings };
}
