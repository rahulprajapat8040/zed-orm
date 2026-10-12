import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, ZedError, ZedErrorCode } from "./index.js";

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
});
