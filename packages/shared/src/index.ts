/**
 * @zed-orm/shared
 *
 * Cross-cutting utilities and structured error base types.
 * Milestone 0: package boundary stub only.
 */

/** Base error for all Zed ORM structured errors. */
export class ZedError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ZedError";
    this.code = code;
  }
}

/** Well-known error code constants (expand as features land). */
export const ZedErrorCode = {
  PARSE: "ZED_PARSE_ERROR",
  SCHEMA: "ZED_SCHEMA_ERROR",
  RELATION: "ZED_RELATION_ERROR",
  QUERY: "ZED_QUERY_ERROR",
  MIGRATION: "ZED_MIGRATION_ERROR",
  DRIVER: "ZED_DRIVER_ERROR",
  TRANSACTION: "ZED_TRANSACTION_ERROR",
  SOFT_DELETE: "ZED_SOFT_DELETE_ERROR",
  GENERATION: "ZED_GENERATION_ERROR",
  UNIQUE_CONSTRAINT: "ZED_UNIQUE_CONSTRAINT_ERROR",
  NOT_NULL_VIOLATION: "ZED_NOT_NULL_VIOLATION_ERROR",
  FOREIGN_KEY_VIOLATION: "ZED_FOREIGN_KEY_VIOLATION_ERROR",
  RECORD_NOT_FOUND: "ZED_RECORD_NOT_FOUND_ERROR",
} as const;

export type ZedErrorCodeName = (typeof ZedErrorCode)[keyof typeof ZedErrorCode];

/** Unique constraint violation (e.g. PostgreSQL 23505). */
export class UniqueConstraintError extends ZedError {
  constructor(message: string, options?: ErrorOptions) {
    super(ZedErrorCode.UNIQUE_CONSTRAINT, message, options);
    this.name = "UniqueConstraintError";
  }
}

/** Not-null constraint violation (e.g. PostgreSQL 23502). */
export class NotNullViolationError extends ZedError {
  constructor(message: string, options?: ErrorOptions) {
    super(ZedErrorCode.NOT_NULL_VIOLATION, message, options);
    this.name = "NotNullViolationError";
  }
}

/** Foreign key constraint violation (e.g. PostgreSQL 23503). */
export class ForeignKeyViolationError extends ZedError {
  constructor(message: string, options?: ErrorOptions) {
    super(ZedErrorCode.FOREIGN_KEY_VIOLATION, message, options);
    this.name = "ForeignKeyViolationError";
  }
}

/** Requested record does not exist or is not visible (e.g. soft-deleted). */
export class RecordNotFoundError extends ZedError {
  constructor(message: string, options?: ErrorOptions) {
    super(ZedErrorCode.RECORD_NOT_FOUND, message, options);
    this.name = "RecordNotFoundError";
  }
}

/** Package identity for diagnostics and tooling. */
export const PACKAGE_NAME = "@zed-orm/shared" as const;
