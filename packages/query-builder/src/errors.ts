import { ZedError, ZedErrorCode } from "@zed-orm/shared";

export interface QueryErrorOptions {
  readonly cause?: unknown;
}

/**
 * Query compilation or validation error (`ZED_QUERY_ERROR`).
 */
export class QueryError extends ZedError {
  constructor(message: string, options: QueryErrorOptions = {}) {
    super(ZedErrorCode.QUERY, message, {
      cause: options.cause,
    });
    this.name = "QueryError";
  }
}
