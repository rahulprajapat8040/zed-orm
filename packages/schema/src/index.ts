/**
 * @zed-orm/schema
 *
 * Semantic validation and schema graph construction.
 * Distinct from syntax parsing (`@zed-orm/parser`).
 */

export { SchemaError, type SchemaErrorOptions } from "./errors.js";
export type {
  FieldTypeKind,
  SoftDeletePolicy,
  ValidatedField,
  ValidatedModel,
  ValidatedEnum,
  ValidatedRelation,
  ValidatedSchema,
} from "./types.js";
export { validateSchema } from "./validate.js";

export const PACKAGE_NAME = "@zed-orm/schema" as const;
