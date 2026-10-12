import { ZedError, ZedErrorCode } from "@zed-orm/shared";

export interface MigrationErrorOptions {
  readonly cause?: unknown;
}

/** Migration engine error (`ZED_MIGRATION_ERROR`). */
export class MigrationError extends ZedError {
  constructor(message: string, options: MigrationErrorOptions = {}) {
    super(ZedErrorCode.MIGRATION, message, { cause: options.cause });
    this.name = "MigrationError";
  }
}
