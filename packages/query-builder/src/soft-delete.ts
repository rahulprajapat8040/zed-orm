import { quoteIdentifier } from "./dialect.js";
import { QueryError } from "./errors.js";
import type { ModelMeta, SqlDialect } from "./meta.js";
import type { ParamCollector } from "./params.js";
import type { SoftDeleteReadOptions, WhereInput } from "./types.js";
import { compileWhere } from "./where.js";

export const DEFAULT_DELETED_AT_FIELD = "deletedAt";

/** Relational soft-delete propagation policy on `@relation`. */
export type SoftDeletePolicy = "Cascade" | "Restrict" | "Nullify" | "Ignore";

const SOFT_DELETE_POLICIES = new Set<SoftDeletePolicy>([
  "Cascade",
  "Restrict",
  "Nullify",
  "Ignore",
]);

/** Parse a relation `onSoftDelete` attribute value. */
export function parseSoftDeletePolicy(value: string): SoftDeletePolicy {
  if (!SOFT_DELETE_POLICIES.has(value as SoftDeletePolicy)) {
    throw new QueryError(
      `Invalid onSoftDelete policy '${value}'. Expected Cascade, Restrict, Nullify, or Ignore.`,
    );
  }
  return value as SoftDeletePolicy;
}

export function getDeletedAtField(meta: ModelMeta): string {
  return meta.deletedAtField ?? DEFAULT_DELETED_AT_FIELD;
}

export function isSoftDeleteModel(meta: ModelMeta): boolean {
  return meta.softDelete === true;
}

function deletedAtColumn(dialect: SqlDialect, meta: ModelMeta): string {
  const fieldName = getDeletedAtField(meta);
  const field = meta.fields.get(fieldName);
  if (field === undefined) {
    throw new QueryError(
      `Soft-delete model '${meta.modelName}' is missing field '${fieldName}'.`,
    );
  }
  return quoteIdentifier(dialect, field.columnName);
}

/** SQL fragment: row is not soft-deleted. */
export function compileActiveRowFilter(
  dialect: SqlDialect,
  meta: ModelMeta,
): string {
  const column = deletedAtColumn(dialect, meta);
  return `${column} IS NULL`;
}

/** SQL fragment: row is soft-deleted. */
export function compileDeletedRowFilter(
  dialect: SqlDialect,
  meta: ModelMeta,
): string {
  const column = deletedAtColumn(dialect, meta);
  return `${column} IS NOT NULL`;
}

function assertReadMode(options?: SoftDeleteReadOptions): void {
  if (options?.withDeleted === true && options.onlyDeleted === true) {
    throw new QueryError(
      "`withDeleted` and `onlyDeleted` cannot be used together.",
    );
  }
}

/** Merge user where with default soft-delete read filtering. */
export function mergeReadWhere(
  meta: ModelMeta,
  where?: WhereInput,
  options?: SoftDeleteReadOptions,
): WhereInput | undefined {
  if (!isSoftDeleteModel(meta)) {
    return where;
  }

  assertReadMode(options);

  if (options?.withDeleted === true) {
    return where;
  }

  const deletedAtField = getDeletedAtField(meta);
  const softFilter: WhereInput = options?.onlyDeleted === true
    ? { [deletedAtField]: { not: null } }
    : { [deletedAtField]: null };

  if (where === undefined) {
    return softFilter;
  }

  return {
    AND: [softFilter, where],
  } as WhereInput;
}

/** Merge user where with active-row filter for mutations targeting live rows. */
export function mergeActiveWhere(
  meta: ModelMeta,
  where?: WhereInput,
): WhereInput | undefined {
  if (!isSoftDeleteModel(meta)) {
    return where;
  }

  const deletedAtField = getDeletedAtField(meta);
  const activeFilter: WhereInput = { [deletedAtField]: null };

  if (where === undefined) {
    return activeFilter;
  }

  return {
    AND: [activeFilter, where],
  } as WhereInput;
}

/** Merge user where with deleted-row filter for restore operations. */
export function mergeDeletedWhere(
  meta: ModelMeta,
  where?: WhereInput,
): WhereInput | undefined {
  if (!isSoftDeleteModel(meta)) {
    throw new QueryError(
      `restore is only supported on soft-delete models ('${meta.modelName}').`,
    );
  }

  const deletedAtField = getDeletedAtField(meta);
  const deletedFilter: WhereInput = { [deletedAtField]: { not: null } };

  if (where === undefined) {
    return deletedFilter;
  }

  return {
    AND: [deletedFilter, where],
  } as WhereInput;
}

export function compileMergedWhere(
  dialect: SqlDialect,
  meta: ModelMeta,
  where: WhereInput | undefined,
  params: ParamCollector,
): string | undefined {
  if (where === undefined) {
    return undefined;
  }
  return compileWhere(dialect, meta, where, params);
}
