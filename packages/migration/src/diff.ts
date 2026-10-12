import { MigrationError } from "./errors.js";
import { withWarnings } from "./warnings.js";
import type {
  DiffResult,
  MigrationOp,
  SchemaSnapshot,
  SnapshotColumn,
  SnapshotForeignKey,
  SnapshotIndex,
  SnapshotTable,
  SnapshotUnique,
} from "./types.js";

function tableMap(snapshot: SchemaSnapshot): Map<string, SnapshotTable> {
  return new Map(snapshot.tables.map((table) => [table.name, table]));
}

function enumMap(snapshot: SchemaSnapshot): Map<string, readonly string[]> {
  return new Map(snapshot.enums.map((enumDef) => [enumDef.name, enumDef.values]));
}

function columnEquals(left: SnapshotColumn, right: SnapshotColumn): boolean {
  return (
    left.name === right.name &&
    JSON.stringify(left.type) === JSON.stringify(right.type) &&
    left.nullable === right.nullable &&
    left.isUnique === right.isUnique &&
    JSON.stringify(left.default ?? null) === JSON.stringify(right.default ?? null)
  );
}

function indexKey(index: SnapshotIndex): string {
  return `${index.name}:${index.columns.join(",")}`;
}

function uniqueKey(unique: SnapshotUnique): string {
  return `${unique.name}:${unique.columns.join(",")}`;
}

function foreignKeyKey(foreignKey: SnapshotForeignKey): string {
  return `${foreignKey.name}:${foreignKey.columns.join(",")}->${foreignKey.referencedTable}(${foreignKey.referencedColumns.join(",")})`;
}

function diffEnums(from: SchemaSnapshot, to: SchemaSnapshot): MigrationOp[] {
  const fromEnums = enumMap(from);
  const toEnums = enumMap(to);
  const operations: MigrationOp[] = [];

  for (const [name, values] of toEnums) {
    const previous = fromEnums.get(name);
    if (previous === undefined) {
      operations.push({ op: "createEnum", name, values: [...values] });
      continue;
    }

    const previousSet = new Set(previous);
    for (const value of values) {
      if (!previousSet.has(value)) {
        operations.push({ op: "addEnumValue", enumName: name, value });
      }
    }
  }

  return operations;
}

function diffTableCreates(
  fromTables: Map<string, SnapshotTable>,
  toTables: Map<string, SnapshotTable>,
): MigrationOp[] {
  const operations: MigrationOp[] = [];

  for (const [name, table] of toTables) {
    if (!fromTables.has(name)) {
      operations.push({ op: "createTable", table });
    }
  }

  return operations;
}

function diffTableDrops(
  fromTables: Map<string, SnapshotTable>,
  toTables: Map<string, SnapshotTable>,
): MigrationOp[] {
  const operations: MigrationOp[] = [];

  for (const name of fromTables.keys()) {
    if (!toTables.has(name)) {
      operations.push({ op: "dropTable", tableName: name });
    }
  }

  return operations;
}

function diffColumns(
  fromTable: SnapshotTable,
  toTable: SnapshotTable,
): MigrationOp[] {
  const operations: MigrationOp[] = [];
  const fromColumns = new Map(fromTable.columns.map((column) => [column.name, column]));
  const toColumns = new Map(toTable.columns.map((column) => [column.name, column]));

  for (const [name, column] of toColumns) {
    const previous = fromColumns.get(name);
    if (previous === undefined) {
      operations.push({
        op: "addColumn",
        tableName: toTable.name,
        column,
      });
      continue;
    }

    if (!columnEquals(previous, column)) {
      operations.push({
        op: "alterColumn",
        tableName: toTable.name,
        from: previous,
        to: column,
      });
    }
  }

  for (const name of fromColumns.keys()) {
    if (!toColumns.has(name)) {
      operations.push({
        op: "dropColumn",
        tableName: toTable.name,
        columnName: name,
      });
    }
  }

  return operations;
}

function diffIndexes(
  fromTable: SnapshotTable,
  toTable: SnapshotTable,
): MigrationOp[] {
  const operations: MigrationOp[] = [];
  const fromIndexes = new Map(fromTable.indexes.map((index) => [indexKey(index), index]));
  const toIndexes = new Map(toTable.indexes.map((index) => [indexKey(index), index]));

  for (const index of toIndexes.values()) {
    if (!fromIndexes.has(indexKey(index))) {
      operations.push({
        op: "createIndex",
        tableName: toTable.name,
        index,
      });
    }
  }

  for (const index of fromIndexes.values()) {
    if (!toIndexes.has(indexKey(index))) {
      operations.push({
        op: "dropIndex",
        tableName: toTable.name,
        indexName: index.name,
      });
    }
  }

  return operations;
}

function diffUniques(
  fromTable: SnapshotTable,
  toTable: SnapshotTable,
): MigrationOp[] {
  const operations: MigrationOp[] = [];
  const fromUniques = new Map(
    fromTable.uniqueConstraints.map((unique) => [uniqueKey(unique), unique]),
  );
  const toUniques = new Map(
    toTable.uniqueConstraints.map((unique) => [uniqueKey(unique), unique]),
  );

  for (const unique of toUniques.values()) {
    if (!fromUniques.has(uniqueKey(unique))) {
      operations.push({
        op: "addUnique",
        tableName: toTable.name,
        unique,
      });
    }
  }

  for (const unique of fromUniques.values()) {
    if (!toUniques.has(uniqueKey(unique))) {
      operations.push({
        op: "dropUnique",
        tableName: toTable.name,
        constraintName: unique.name,
      });
    }
  }

  return operations;
}

function diffForeignKeys(
  fromTable: SnapshotTable,
  toTable: SnapshotTable,
): MigrationOp[] {
  const operations: MigrationOp[] = [];
  const fromForeignKeys = new Map(
    fromTable.foreignKeys.map((foreignKey) => [foreignKeyKey(foreignKey), foreignKey]),
  );
  const toForeignKeys = new Map(
    toTable.foreignKeys.map((foreignKey) => [foreignKeyKey(foreignKey), foreignKey]),
  );

  for (const foreignKey of toForeignKeys.values()) {
    if (!fromForeignKeys.has(foreignKeyKey(foreignKey))) {
      operations.push({
        op: "addForeignKey",
        tableName: toTable.name,
        foreignKey,
      });
    }
  }

  for (const foreignKey of fromForeignKeys.values()) {
    if (!toForeignKeys.has(foreignKeyKey(foreignKey))) {
      operations.push({
        op: "dropForeignKey",
        tableName: toTable.name,
        constraintName: foreignKey.name,
      });
    }
  }

  return operations;
}

function diffExistingTables(
  fromTables: Map<string, SnapshotTable>,
  toTables: Map<string, SnapshotTable>,
): MigrationOp[] {
  const operations: MigrationOp[] = [];

  for (const [name, toTable] of toTables) {
    const fromTable = fromTables.get(name);
    if (fromTable === undefined) {
      continue;
    }

    operations.push(...diffColumns(fromTable, toTable));
    operations.push(...diffIndexes(fromTable, toTable));
    operations.push(...diffUniques(fromTable, toTable));
    operations.push(...diffForeignKeys(fromTable, toTable));
  }

  return operations;
}

function orderOperations(operations: readonly MigrationOp[]): MigrationOp[] {
  const createEnums = operations.filter((op) => op.op === "createEnum");
  const addEnumValues = operations.filter((op) => op.op === "addEnumValue");
  const createTables = operations.filter((op) => op.op === "createTable");
  const addColumns = operations.filter((op) => op.op === "addColumn");
  const alterColumns = operations.filter((op) => op.op === "alterColumn");
  const createIndexes = operations.filter((op) => op.op === "createIndex");
  const addUniques = operations.filter((op) => op.op === "addUnique");
  const addForeignKeys = operations.filter((op) => op.op === "addForeignKey");
  const dropForeignKeys = operations.filter((op) => op.op === "dropForeignKey");
  const dropIndexes = operations.filter((op) => op.op === "dropIndex");
  const dropUniques = operations.filter((op) => op.op === "dropUnique");
  const dropColumns = operations.filter((op) => op.op === "dropColumn");
  const dropTables = operations.filter((op) => op.op === "dropTable");

  return [
    ...createEnums,
    ...addEnumValues,
    ...createTables,
    ...addColumns,
    ...alterColumns,
    ...createIndexes,
    ...addUniques,
    ...addForeignKeys,
    ...dropForeignKeys,
    ...dropIndexes,
    ...dropUniques,
    ...dropColumns,
    ...dropTables,
  ];
}

/**
 * Diff two schema snapshots into ordered migration operations.
 *
 * `from` is the previously applied schema; `to` is the desired schema.
 */
export function diffSchemas(from: SchemaSnapshot, to: SchemaSnapshot): DiffResult {
  if (from.provider !== to.provider) {
    throw new MigrationError(
      `Cannot diff snapshots with different providers (${from.provider} -> ${to.provider}).`,
    );
  }

  const fromTables = tableMap(from);
  const toTables = tableMap(to);

  const operations = orderOperations([
    ...diffEnums(from, to),
    ...diffTableCreates(fromTables, toTables),
    ...diffExistingTables(fromTables, toTables),
    ...diffTableDrops(fromTables, toTables),
  ]);

  return withWarnings(operations);
}
