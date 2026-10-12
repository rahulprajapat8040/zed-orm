import { describe, expect, it } from "vitest";
import {
  ForeignKeyViolationError,
  NotNullViolationError,
  PACKAGE_NAME,
  RecordNotFoundError,
  UniqueConstraintError,
  ZedError,
  ZedErrorCode,
} from "./index.js";

describe("@zed-orm/shared", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/shared");
  });

  it("creates structured errors with codes", () => {
    const error = new ZedError(ZedErrorCode.PARSE, "Invalid token");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ZedError);
    expect(error.code).toBe("ZED_PARSE_ERROR");
    expect(error.message).toBe("Invalid token");
    expect(error.name).toBe("ZedError");
  });

  it("exposes database and not-found error types", () => {
    expect(new UniqueConstraintError("dup").code).toBe(
      "ZED_UNIQUE_CONSTRAINT_ERROR",
    );
    expect(new NotNullViolationError("null").code).toBe(
      "ZED_NOT_NULL_VIOLATION_ERROR",
    );
    expect(new ForeignKeyViolationError("fk").code).toBe(
      "ZED_FOREIGN_KEY_VIOLATION_ERROR",
    );
    expect(new RecordNotFoundError("missing").code).toBe(
      "ZED_RECORD_NOT_FOUND_ERROR",
    );
  });
});
