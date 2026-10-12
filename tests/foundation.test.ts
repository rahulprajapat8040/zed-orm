import { describe, expect, it } from "vitest";

/**
 * Cross-package smoke tests for Milestone 0 foundation.
 * Ensures workspace packages resolve and export their public stubs.
 */
describe("foundation package boundaries", () => {
  it("resolves @zed-orm/shared", async () => {
    const mod = await import("@zed-orm/shared");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/shared");
    expect(mod.ZedErrorCode.PARSE).toBe("ZED_PARSE_ERROR");
  });

  it("resolves @zed-orm/ast", async () => {
    const mod = await import("@zed-orm/ast");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/ast");
  });

  it("resolves @zed-orm/client", async () => {
    const mod = await import("@zed-orm/client");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/client");
    const client = new mod.ZedClient({
      databaseUrl: "postgresql://localhost/zed",
    });
    expect(client.options.databaseUrl).toContain("postgresql");
  });

  it("resolves @zed-orm/runtime driver contract exports", async () => {
    const mod = await import("@zed-orm/runtime");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/runtime");
  });

  it("resolves @zed-orm/driver-postgres", async () => {
    const mod = await import("@zed-orm/driver-postgres");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/driver-postgres");
    expect(typeof mod.createPostgresDriver).toBe("function");
  });

  it("resolves @zed-orm/query-builder", async () => {
    const mod = await import("@zed-orm/query-builder");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/query-builder");
    expect(typeof mod.buildFindMany).toBe("function");
  });

  it("resolves @zed-orm/generator", async () => {
    const mod = await import("@zed-orm/generator");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/generator");
    expect(typeof mod.generateClient).toBe("function");
  });

  it("resolves @zed-orm/nestjs", async () => {
    const mod = await import("@zed-orm/nestjs");
    expect(mod.PACKAGE_NAME).toBe("@zed-orm/nestjs");
    expect(typeof mod.ZedModule.forRoot).toBe("function");
    expect(typeof mod.InjectZed).toBe("function");
    expect(mod.ZED_CLIENT).toBeDefined();
  });
});
