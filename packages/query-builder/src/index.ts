/**
 * @zed-orm/query-builder
 *
 * Query representation and parameterized SQL generation.
 */

export const PACKAGE_NAME = "@zed-orm/query-builder" as const;

export { QueryError, type QueryErrorOptions } from "./errors.js";
export {
  getScalarFields,
  getUniqueFields,
  type FieldMeta,
  type ModelMeta,
  type RelationKind,
  type RelationMeta,
  type ScalarKind,
  type SqlDialect,
} from "./meta.js";
export {
  buildFindFirst,
  buildFindMany,
  buildFindUnique,
} from "./read.js";
export {
  buildCreate,
  buildCreateMany,
  buildDelete,
  buildDeleteMany,
  buildRestore,
  buildRestoreMany,
  buildSelectIds,
  buildUpdate,
  buildUpdateMany,
} from "./write.js";
export {
  DEFAULT_DELETED_AT_FIELD,
  compileActiveRowFilter,
  compileDeletedRowFilter,
  getDeletedAtField,
  isSoftDeleteModel,
  mergeActiveWhere,
  mergeDeletedWhere,
  mergeReadWhere,
  parseSoftDeletePolicy,
  type SoftDeletePolicy,
} from "./soft-delete.js";
export type {
  CreateArgs,
  CreateManyArgs,
  DataInput,
  DeleteArgs,
  DeleteManyArgs,
  RestoreArgs,
  RestoreManyArgs,
  SoftDeleteReadOptions,
  FieldFilter,
  FieldWhereInput,
  FindFirstArgs,
  FindFirstArgsWithInclude,
  FindManyArgs,
  FindManyArgsWithInclude,
  FindUniqueArgs,
  FindUniqueArgsWithInclude,
  IncludeInput,
  OrderByInput,
  OrderDirection,
  RelationLoadArgs,
  ScalarValue,
  SelectInput,
  SqlStatement,
  UpdateArgs,
  UpdateManyArgs,
  WhereInput,
} from "./types.js";
