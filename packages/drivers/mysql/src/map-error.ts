import {
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueConstraintError,
  ZedError,
} from "@zed-orm/shared";
import { DriverError } from "./errors.js";

interface MysqlErrorLike {
  readonly code?: string;
  readonly errno?: number;
}

function isMysqlErrorLike(cause: unknown): cause is MysqlErrorLike {
  return typeof cause === "object" && cause !== null;
}

/** Map a MySQL driver failure to a structured Zed error when possible. */
export function mapMysqlError(
  cause: unknown,
  fallbackMessage: string,
): ZedError {
  if (isMysqlErrorLike(cause)) {
    const code = cause.code ?? String(cause.errno ?? "");
    switch (code) {
      case "ER_DUP_ENTRY":
      case "1062":
        return new UniqueConstraintError("Unique constraint violation.", {
          cause,
        });
      case "ER_BAD_NULL_ERROR":
      case "1048":
        return new NotNullViolationError("Not-null constraint violation.", {
          cause,
        });
      case "ER_NO_REFERENCED_ROW_2":
      case "ER_ROW_IS_REFERENCED_2":
      case "1452":
      case "1451":
        return new ForeignKeyViolationError("Foreign key constraint violation.", {
          cause,
        });
      default:
        break;
    }
  }

  return new DriverError(fallbackMessage, { cause });
}
