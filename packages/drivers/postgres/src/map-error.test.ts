import { describe, expect, it } from "vitest";
import {
  ForeignKeyViolationError,
  NotNullViolationError,
  UniqueConstraintError,
} from "@zed-orm/shared";
import { DriverError } from "./errors.js";
import { mapPostgresError } from "./map-error.js";

describe("mapPostgresError", () => {
  it("maps unique violation code 23505", () => {
    const error = mapPostgresError({ code: "23505" }, "fallback");
    expect(error).toBeInstanceOf(UniqueConstraintError);
    expect(error.code).toBe("ZED_UNIQUE_CONSTRAINT_ERROR");
  });

  it("maps not-null violation code 23502", () => {
    const error = mapPostgresError({ code: "23502" }, "fallback");
    expect(error).toBeInstanceOf(NotNullViolationError);
    expect(error.code).toBe("ZED_NOT_NULL_VIOLATION_ERROR");
  });

  it("maps foreign key violation code 23503", () => {
    const error = mapPostgresError({ code: "23503" }, "fallback");
    expect(error).toBeInstanceOf(ForeignKeyViolationError);
    expect(error.code).toBe("ZED_FOREIGN_KEY_VIOLATION_ERROR");
  });

  it("falls back to DriverError for unknown codes", () => {
    const error = mapPostgresError({ code: "99999" }, "PostgreSQL query failed.");
    expect(error).toBeInstanceOf(DriverError);
    expect(error.code).toBe("ZED_DRIVER_ERROR");
  });
});
