/**
 * Well-known scalar type names in the Zed schema language.
 *
 * These are not validated here (semantic validation is Milestone 3);
 * the constant exists so parser/generator/docs share one vocabulary.
 */
export const ScalarTypeName = {
  String: "String",
  Int: "Int",
  BigInt: "BigInt",
  Float: "Float",
  Decimal: "Decimal",
  Boolean: "Boolean",
  DateTime: "DateTime",
  Json: "Json",
  Bytes: "Bytes",
} as const;

export type ScalarTypeNameValue =
  (typeof ScalarTypeName)[keyof typeof ScalarTypeName];

export const SCALAR_TYPE_NAMES: readonly ScalarTypeNameValue[] =
  Object.values(ScalarTypeName);

/**
 * Well-known field attribute names (without leading `@`).
 */
export const FieldAttributeName = {
  Id: "id",
  Unique: "unique",
  Default: "default",
  UpdatedAt: "updatedAt",
  Relation: "relation",
  Map: "map",
  Ignore: "ignore",
} as const;

/**
 * Well-known block attribute names (without leading `@@`).
 * Soft-delete syntax may evolve; `softDelete` is reserved here for Milestone 10+.
 */
export const BlockAttributeName = {
  Id: "id",
  Unique: "unique",
  Index: "index",
  Map: "map",
  Ignore: "ignore",
  SoftDelete: "softDelete",
} as const;
