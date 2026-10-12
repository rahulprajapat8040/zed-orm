import { quoteIdentifier } from "./dialect.js";
import { applyAutomaticTimestamps, normalizeDataInput } from "./data.js";
import { QueryError } from "./errors.js";
import type { ModelMeta, SqlDialect } from "./meta.js";
import { ParamCollector } from "./params.js";
import { compileSelect } from "./select.js";
import {
  getDeletedAtField,
  isSoftDeleteModel,
  mergeActiveWhere,
  mergeDeletedWhere,
} from "./soft-delete.js";
import { assertUniqueWhere } from "./unique-where.js";
import { compileWhere } from "./where.js";
import type {
  CreateArgs,
  CreateManyArgs,
  DeleteArgs,
  DeleteManyArgs,
  RestoreArgs,
  RestoreManyArgs,
  SqlStatement,
  UpdateArgs,
  UpdateManyArgs,
} from "./types.js";

function compileReturning(
  dialect: SqlDialect,
  meta: ModelMeta,
  select?: CreateArgs["select"],
): string {
  return `RETURNING ${compileSelect(dialect, meta, select)}`;
}

/** Build SQL for `create` (INSERT … RETURNING). */
export function buildCreate(
  meta: ModelMeta,
  args: CreateArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  const params = new ParamCollector(dialect);
  const data = applyAutomaticTimestamps(meta, args.data, "create");
  const entries = normalizeDataInput(meta, data, "create");
  const table = quoteIdentifier(dialect, meta.tableName);

  const columns = entries.map(([fieldName, _value]) =>
    quoteIdentifier(dialect, meta.fields.get(fieldName)!.columnName),
  );
  const values = entries.map(([, value]) => params.add(value));

  const sql = [
    `INSERT INTO ${table} (${columns.join(", ")})`,
    `VALUES (${values.join(", ")})`,
    compileReturning(dialect, meta, args.select),
  ].join(" ");

  return { sql, params: params.params };
}

/** Build SQL for `createMany` (multi-row INSERT … RETURNING). */
export function buildCreateMany(
  meta: ModelMeta,
  args: CreateManyArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  if (args.data.length === 0) {
    throw new QueryError("createMany requires at least one record in data.");
  }

  const firstData = applyAutomaticTimestamps(meta, args.data[0]!, "create");
  const firstKeys = normalizeDataInput(meta, firstData, "createMany").map(
    ([fieldName]) => fieldName,
  );

  for (let index = 1; index < args.data.length; index++) {
    const recordData = applyAutomaticTimestamps(meta, args.data[index]!, "create");
    const keys = normalizeDataInput(
      meta,
      recordData,
      "createMany",
    ).map(([fieldName]) => fieldName);
    if (keys.join("\0") !== firstKeys.join("\0")) {
      throw new QueryError(
        "createMany requires identical field sets for each record.",
      );
    }
  }

  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const columns = firstKeys.map((fieldName) =>
    quoteIdentifier(dialect, meta.fields.get(fieldName)!.columnName),
  );

  const valueGroups = args.data.map((record) => {
    const recordData = applyAutomaticTimestamps(meta, record, "create");
    const entries = normalizeDataInput(meta, recordData, "createMany");
    return `(${entries.map(([, value]) => params.add(value)).join(", ")})`;
  });

  const sql = [
    `INSERT INTO ${table} (${columns.join(", ")})`,
    `VALUES ${valueGroups.join(", ")}`,
    compileReturning(dialect, meta, args.select),
  ].join(" ");

  return { sql, params: params.params };
}

function buildUpdateStatement(
  dialect: SqlDialect,
  meta: ModelMeta,
  args: { readonly where?: UpdateManyArgs["where"]; readonly data: UpdateManyArgs["data"] },
  withReturning: boolean,
  returningSelect?: CreateArgs["select"],
): SqlStatement {
  const params = new ParamCollector(dialect);
  const data = applyAutomaticTimestamps(meta, args.data, "update");
  const entries = normalizeDataInput(meta, data, "update");
  const table = quoteIdentifier(dialect, meta.tableName);

  const setClause = entries
    .map(([fieldName, value]) => {
      const column = quoteIdentifier(
        dialect,
        meta.fields.get(fieldName)!.columnName,
      );
      return `${column} = ${params.add(value)}`;
    })
    .join(", ");

  const clauses = [`UPDATE ${table} SET ${setClause}`];

  if (args.where !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, args.where, params)}`);
  }

  if (withReturning) {
    clauses.push(compileReturning(dialect, meta, returningSelect));
  }

  return { sql: clauses.join(" "), params: params.params };
}

/** Build SQL for `update` (unique where + RETURNING). */
export function buildUpdate(
  meta: ModelMeta,
  args: UpdateArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  assertUniqueWhere(meta, args.where);
  return buildUpdateStatement(dialect, meta, args, true, args.select);
}

/** Build SQL for `updateMany` (optional where, no RETURNING). */
export function buildUpdateMany(
  meta: ModelMeta,
  args: UpdateManyArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  return buildUpdateStatement(dialect, meta, args, false);
}

function buildSoftDeleteStatement(
  dialect: SqlDialect,
  meta: ModelMeta,
  where?: DeleteManyArgs["where"],
  withReturning = false,
  returningSelect?: DeleteArgs["select"],
  deletedAt: Date = new Date(),
): SqlStatement {
  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const deletedAtField = getDeletedAtField(meta);
  const column = quoteIdentifier(
    dialect,
    meta.fields.get(deletedAtField)!.columnName,
  );
  const mergedWhere = mergeActiveWhere(meta, where);
  const clauses = [
    `UPDATE ${table} SET ${column} = ${params.add(deletedAt)}`,
  ];

  if (mergedWhere !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, mergedWhere, params)}`);
  }

  if (withReturning) {
    clauses.push(compileReturning(dialect, meta, returningSelect));
  }

  return { sql: clauses.join(" "), params: params.params };
}

function buildHardDeleteStatement(
  dialect: SqlDialect,
  meta: ModelMeta,
  where?: DeleteManyArgs["where"],
  withReturning = false,
  returningSelect?: DeleteArgs["select"],
): SqlStatement {
  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const clauses = [`DELETE FROM ${table}`];

  if (where !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, where, params)}`);
  }

  if (withReturning) {
    clauses.push(compileReturning(dialect, meta, returningSelect));
  }

  return { sql: clauses.join(" "), params: params.params };
}

function buildDeleteStatement(
  dialect: SqlDialect,
  meta: ModelMeta,
  where?: DeleteManyArgs["where"],
  withReturning = false,
  returningSelect?: DeleteArgs["select"],
  deletedAt?: Date,
): SqlStatement {
  if (isSoftDeleteModel(meta)) {
    return buildSoftDeleteStatement(
      dialect,
      meta,
      where,
      withReturning,
      returningSelect,
      deletedAt ?? new Date(),
    );
  }

  return buildHardDeleteStatement(
    dialect,
    meta,
    where,
    withReturning,
    returningSelect,
  );
}

function buildRestoreStatement(
  dialect: SqlDialect,
  meta: ModelMeta,
  where?: RestoreManyArgs["where"],
  withReturning = false,
  returningSelect?: RestoreArgs["select"],
): SqlStatement {
  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const deletedAtField = getDeletedAtField(meta);
  const column = quoteIdentifier(
    dialect,
    meta.fields.get(deletedAtField)!.columnName,
  );
  const mergedWhere = mergeDeletedWhere(meta, where);
  const clauses = [`UPDATE ${table} SET ${column} = NULL`];

  if (mergedWhere !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, mergedWhere, params)}`);
  }

  if (withReturning) {
    clauses.push(compileReturning(dialect, meta, returningSelect));
  }

  return { sql: clauses.join(" "), params: params.params };
}

/** Build SQL for `delete` (unique where + RETURNING). */
export function buildDelete(
  meta: ModelMeta,
  args: DeleteArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  assertUniqueWhere(meta, args.where);
  return buildDeleteStatement(
    dialect,
    meta,
    args.where,
    true,
    args.select,
    args.deletedAt,
  );
}

/** Build SQL for `deleteMany` (optional where, no RETURNING). */
export function buildDeleteMany(
  meta: ModelMeta,
  args: DeleteManyArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  return buildDeleteStatement(
    dialect,
    meta,
    args.where,
    false,
    undefined,
    args.deletedAt,
  );
}

/** Build SQL for `restore` (unique where + RETURNING). */
export function buildRestore(
  meta: ModelMeta,
  args: RestoreArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  assertUniqueWhere(meta, args.where);
  return buildRestoreStatement(dialect, meta, args.where, true, args.select);
}

/** Build SQL for `restoreMany` (optional where, no RETURNING). */
export function buildRestoreMany(
  meta: ModelMeta,
  args: RestoreManyArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  return buildRestoreStatement(dialect, meta, args.where, false);
}

/** Build SQL to select primary keys matching a where clause (active rows only). */
export function buildSelectIds(
  meta: ModelMeta,
  where?: DeleteManyArgs["where"],
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  if (meta.idFields.length === 0) {
    throw new QueryError(
      `Cannot select ids for model '${meta.modelName}' without id fields.`,
    );
  }

  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const idColumns = meta.idFields.map((fieldName) =>
    quoteIdentifier(dialect, meta.fields.get(fieldName)!.columnName),
  );
  const mergedWhere = mergeActiveWhere(meta, where);
  const clauses = [`SELECT ${idColumns.join(", ")} FROM ${table}`];

  if (mergedWhere !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, mergedWhere, params)}`);
  }

  return { sql: clauses.join(" "), params: params.params };
}
