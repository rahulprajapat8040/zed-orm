import { describe, expect, it } from "vitest";
import {
  DriverError,
  PACKAGE_NAME,
  PostgresDriver,
  createPostgresDriver,
} from "./index.js";

describe("@zed-orm/driver-postgres", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/driver-postgres");
  });

  it("creates structured driver errors", () => {
    const error = new DriverError("Connection refused");
    expect(error).toBeInstanceOf(DriverError);
    expect(error.code).toBe("ZED_DRIVER_ERROR");
    expect(error.name).toBe("DriverError");
    expect(error.message).toBe("Connection refused");
  });

  it("createPostgresDriver returns a PostgresDriver instance", () => {
    const driver = createPostgresDriver({
      databaseUrl: "postgresql://localhost:5432/zed_test",
    });
    expect(driver).toBeInstanceOf(PostgresDriver);
  });

  it("rejects queries before connect", async () => {
    const driver = createPostgresDriver({
      databaseUrl: "postgresql://localhost:5432/zed_test",
    });

    await expect(driver.query("SELECT 1")).rejects.toThrow(DriverError);
    await expect(driver.query("SELECT 1")).rejects.toThrow(/not connected/);
  });

  it("rejects transactions before connect", async () => {
    const driver = createPostgresDriver({
      databaseUrl: "postgresql://localhost:5432/zed_test",
    });

    await expect(
      driver.transaction(async (tx) => tx.query("SELECT 1")),
    ).rejects.toThrow(DriverError);
  });

  it("disconnect is a no-op when not connected", async () => {
    const driver = createPostgresDriver({
      databaseUrl: "postgresql://localhost:5432/zed_test",
    });

    await expect(driver.disconnect()).resolves.toBeUndefined();
  });
});
