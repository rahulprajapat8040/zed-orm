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
} as const;

export type ZedErrorCodeName = (typeof ZedErrorCode)[keyof typeof ZedErrorCode];

/** Package identity for diagnostics and tooling. */
export const PACKAGE_NAME = "@zed-orm/shared" as const;
