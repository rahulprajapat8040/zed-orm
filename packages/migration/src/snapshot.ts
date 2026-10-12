import {
  BlockAttributeName,
  FieldAttributeName,
  isArrayExpression,
  isBooleanLiteral,
  isFunctionCall,
  isIdentifier,
  isNumericLiteral,
  isStringLiteral,
  type AttributeArgNode,
  type FieldNode,
  type ModelNode,
} from "@zed-orm/ast";
import type { ValidatedField, ValidatedModel, ValidatedSchema } from "@zed-orm/schema";
import { MigrationError } from "./errors.js";
import { discoverJoinTables } from "./join-tables.js";
import type {
  MigrationProvider,
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

function readProvider(schema: ValidatedSchema): MigrationProvider {
  const datasource = schema.datasources[0];
  if (datasource === undefined) {
    return "postgresql";
  }

  for (const entry of datasource.config) {
    if (entry.key.name !== "provider") {
      continue;
    }
    if (
      isStringLiteral(entry.value) &&
      (entry.value.value === "postgresql" || entry.value.value === "mysql")
    ) {
      return entry.value.value;
    }
    if (isStringLiteral(entry.value)) {
      throw new MigrationError(
        `Unsupported datasource provider '${entry.value.value}'. Supported providers: postgresql, mysql.`,
      );
    }
  }

  return "postgresql";
}

function readIdentifierArrayArg(
  args: readonly AttributeArgNode[],
  label: string,
): string[] {
  const positional = args.find((arg) => arg.name === undefined);
  if (positional === undefined || !isArrayExpression(positional.value)) {
    throw new MigrationError(`${label} requires a field list argument.`);
  }

  const names: string[] = [];
  for (const element of positional.value.elements) {
    if (!isIdentifier(element)) {
      throw new MigrationError(`${label} field list must contain identifiers.`);
    }
    names.push(element.name);
  }
  return names;
}

function readDefaultExpression(
  field: FieldNode,
): SnapshotDefault | undefined {
  const defaultAttr = field.attributes.find(
    (attr) => attr.name.name === FieldAttributeName.Default,
  );
  if (defaultAttr === undefined) {
    return undefined;
  }

  const arg = defaultAttr.args[0];
  if (arg === undefined) {
    return undefined;
  }

  const value = arg.value;
  if (isStringLiteral(value)) {
    return { kind: "literal", value: value.value };
  }
  if (isNumericLiteral(value)) {
    const parsed = Number(value.value);
    return { kind: "literal", value: Number.isNaN(parsed) ? value.value : parsed };
  }
  if (isBooleanLiteral(value)) {
    return { kind: "literal", value: value.value };
  }
  if (isFunctionCall(value)) {
    return { kind: "function", name: value.name.name };
  }

  return undefined;
}

function toColumnType(
  field: ValidatedField,
  schema: ValidatedSchema,
): SnapshotColumnType {
  if (field.typeKind === "enum") {
    const enumDef = schema.enums.get(field.typeName);
    if (enumDef === undefined) {
      throw new MigrationError(
        `Unknown enum type '${field.typeName}' for field '${field.name}'.`,
      );
    }
    return {
      kind: "enum",
      enumName: field.typeName,
      values: [...enumDef.values],
    };
  }
  if (field.typeKind === "scalar") {
    return { kind: "scalar", scalar: field.typeName };
  }
  throw new MigrationError(
    `Cannot snapshot relation field '${field.name}' as a column.`,
  );
}

function toSnapshotColumn(
  field: ValidatedField,
  schema: ValidatedSchema,
): SnapshotColumn {
  const defaultValue = readDefaultExpression(field.node);
  return {
    name: field.name,
    type: toColumnType(field, schema),
    nullable: field.isOptional,
    isUnique: field.isUnique,
    ...(defaultValue !== undefined ? { default: defaultValue } : {}),
  };
}

function indexName(tableName: string, columns: readonly string[]): string {
  return `${tableName}_${columns.join("_")}_idx`;
}

function uniqueName(tableName: string, columns: readonly string[]): string {
  return `${tableName}_${columns.join("_")}_key`;
}

function foreignKeyName(
  tableName: string,
  columns: readonly string[],
  referencedTable: string,
): string {
  return `${tableName}_${columns.join("_")}_${referencedTable}_fk`;
}

function readBlockIndexes(model: ModelNode): SnapshotIndex[] {
  const indexes: SnapshotIndex[] = [];

  for (const attr of model.attributes) {
    if (attr.name.name !== BlockAttributeName.Index) {
      continue;
    }
    const columns = readIdentifierArrayArg(attr.args, `@@index on '${model.name.name}'`);
    indexes.push({
      name: indexName(model.name.name, columns),
      columns,
    });
  }

  return indexes;
}

function readBlockUniques(
  model: ModelNode,
  fieldUniques: ReadonlySet<string>,
): SnapshotUnique[] {
  const uniques: SnapshotUnique[] = [];

  for (const attr of model.attributes) {
    if (attr.name.name !== BlockAttributeName.Unique) {
      continue;
    }
    const columns = readIdentifierArrayArg(attr.args, `@@unique on '${model.name.name}'`);
    uniques.push({
      name: uniqueName(model.name.name, columns),
      columns,
    });
  }

  for (const fieldName of fieldUniques) {
    uniques.push({
      name: uniqueName(model.name.name, [fieldName]),
      columns: [fieldName],
    });
  }

  return uniques;
}

function modelToTable(
  schema: ValidatedSchema,
  model: ValidatedModel,
): SnapshotTable {
  const columns: SnapshotColumn[] = [];
  const fieldUniques = new Set<string>();

  for (const field of model.fields.values()) {
    if (field.isRelation || field.typeKind === "model" || field.isList) {
      continue;
    }
    columns.push(toSnapshotColumn(field, schema));
    if (field.isUnique) {
      fieldUniques.add(field.name);
    }
  }

  const foreignKeys: SnapshotForeignKey[] = [];
  for (const relation of schema.relations) {
    if (relation.model !== model.name) {
      continue;
    }

    foreignKeys.push({
      name: foreignKeyName(
        model.name,
        relation.fields,
        relation.referencedModel,
      ),
      columns: [...relation.fields],
      referencedTable: relation.referencedModel,
      referencedColumns: [...relation.references],
    });
  }

  const indexes = readBlockIndexes(model.node);
  const uniqueConstraints = readBlockUniques(model.node, fieldUniques);

  return {
    name: model.name,
    columns,
    primaryKey: [...model.idFields],
    indexes,
    uniqueConstraints,
    foreignKeys,
  };
}

function joinTableToSnapshot(
  schema: ValidatedSchema,
  joinTable: ReturnType<typeof discoverJoinTables>[number],
): SnapshotTable {
  const modelA = schema.models.get(joinTable.modelA);
  const modelB = schema.models.get(joinTable.modelB);
  if (modelA === undefined || modelB === undefined) {
    throw new MigrationError(
      `Join table '${joinTable.tableName}' references unknown models.`,
    );
  }

  const idFieldA = modelA.idFields[0];
  const idFieldB = modelB.idFields[0];
  if (idFieldA === undefined || idFieldB === undefined) {
    throw new MigrationError(
      `Join table '${joinTable.tableName}' requires both models to declare an id field.`,
    );
  }

  const columnA = modelA.fields.get(idFieldA);
  const columnB = modelB.fields.get(idFieldB);
  if (columnA === undefined || columnB === undefined) {
    throw new MigrationError(
      `Join table '${joinTable.tableName}' references unknown id fields.`,
    );
  }

  return {
    name: joinTable.tableName,
    isJoinTable: true,
    columns: [
      toSnapshotColumn(columnA, schema),
      toSnapshotColumn(columnB, schema),
    ].map((column, index) => {
      const { default: _default, ...rest } = column;
      return {
        ...rest,
        name: index === 0 ? joinTable.columnA : joinTable.columnB,
        nullable: false,
        isUnique: false,
      };
    }),
    primaryKey: [joinTable.columnA, joinTable.columnB],
    indexes: [],
    uniqueConstraints: [],
    foreignKeys: [
      {
        name: foreignKeyName(joinTable.tableName, [joinTable.columnA], joinTable.modelA),
        columns: [joinTable.columnA],
        referencedTable: joinTable.modelA,
        referencedColumns: [...modelA.idFields],
      },
      {
        name: foreignKeyName(joinTable.tableName, [joinTable.columnB], joinTable.modelB),
        columns: [joinTable.columnB],
        referencedTable: joinTable.modelB,
        referencedColumns: [...modelB.idFields],
      },
    ],
  };
}

function enumsToSnapshot(schema: ValidatedSchema): SnapshotEnum[] {
  return [...schema.enums.values()]
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((enumDef) => ({
      name: enumDef.name,
      values: [...enumDef.values].sort((left, right) => left.localeCompare(right)),
    }));
}

/** Build a serializable schema snapshot from a validated schema. */
export function createSnapshot(schema: ValidatedSchema): SchemaSnapshot {
  const tables: SnapshotTable[] = [];

  for (const model of [...schema.models.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    tables.push(modelToTable(schema, model));
  }

  for (const joinTable of discoverJoinTables(schema)) {
    tables.push(joinTableToSnapshot(schema, joinTable));
  }

  tables.sort((left, right) => left.name.localeCompare(right.name));

  return {
    version: 1,
    provider: readProvider(schema),
    enums: enumsToSnapshot(schema),
    tables,
  };
}

/** Parse a snapshot from JSON (e.g. migrations/snapshot.json). */
export function parseSnapshot(json: string): SchemaSnapshot {
  const parsed = JSON.parse(json) as SchemaSnapshot;
  if (parsed.version !== 1) {
    throw new MigrationError(`Unsupported snapshot version '${String(parsed.version)}'.`);
  }
  return parsed;
}

/** Serialize a snapshot to stable JSON. */
export function serializeSnapshot(snapshot: SchemaSnapshot): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** Empty snapshot for bootstrapping the first migration. */
export function emptySnapshot(provider: MigrationProvider = "postgresql"): SchemaSnapshot {
  return {
    version: 1,
    provider,
    enums: [],
    tables: [],
  };
}
