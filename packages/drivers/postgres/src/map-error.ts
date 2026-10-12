import {
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueConstraintError,
  ZedError,
} from "@zed-orm/shared";
import { DriverError } from "./errors.js";

interface PgErrorLike {
  readonly code?: string;
}

function isPgErrorLike(cause: unknown): cause is PgErrorLike {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "code" in cause &&
    typeof (cause as PgErrorLike).code === "string"
  );
}

/** Map a PostgreSQL driver failure to a structured Zed error when possible. */
export function mapPostgresError(
  cause: unknown,
  fallbackMessage: string,
): ZedError {
  if (isPgErrorLike(cause)) {
    switch (cause.code) {
      case "23505":
        return new UniqueConstraintError("Unique constraint violation.", {
          cause,
        });
      case "23502":
        return new NotNullViolationError("Not-null constraint violation.", {
          cause,
        });
      case "23503":
        return new ForeignKeyViolationError("Foreign key constraint violation.", {
          cause,
        });
      default:
        break;
    }
  }

  return new DriverError(fallbackMessage, { cause });
}
