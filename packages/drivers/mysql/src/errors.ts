import { ZedError, ZedErrorCode } from "@zed-orm/shared";

export interface DriverErrorOptions {
  readonly cause?: unknown;
}

/**
 * Database driver error (`ZED_DRIVER_ERROR`).
 *
 * Wraps underlying `mysql2` failures with a stable Zed error code.
 */
export class DriverError extends ZedError {
  constructor(message: string, options: DriverErrorOptions = {}) {
    super(ZedErrorCode.DRIVER, message, {
      cause: options.cause,
    });
    this.name = "DriverError";
  }
}
