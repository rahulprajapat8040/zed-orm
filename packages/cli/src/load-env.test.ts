import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadEnvFromDirectory } from "./load-env.js";

describe("loadEnvFromDirectory", () => {
  let workDir: string;
  const previousDatabaseUrl = process.env["DATABASE_URL"];

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-env-"));
    delete process.env["DATABASE_URL"];
  });

  afterEach(async () => {
    if (previousDatabaseUrl === undefined) {
      delete process.env["DATABASE_URL"];
    } else {
      process.env["DATABASE_URL"] = previousDatabaseUrl;
    }
    await rm(workDir, { recursive: true, force: true });
  });

  it("loads DATABASE_URL from .env when not set in shell", async () => {
    await writeFile(
      join(workDir, ".env"),
      'DATABASE_URL="postgresql://localhost:5432/app"\n',
      "utf8",
    );

    loadEnvFromDirectory(workDir);

    expect(process.env["DATABASE_URL"]).toBe("postgresql://localhost:5432/app");
  });

  it("does not override an existing shell DATABASE_URL", async () => {
    process.env["DATABASE_URL"] = "postgresql://shell:5432/app";
    await writeFile(
      join(workDir, ".env"),
      "DATABASE_URL=postgresql://dotenv:5432/app\n",
      "utf8",
    );

    loadEnvFromDirectory(workDir);

    expect(process.env["DATABASE_URL"]).toBe("postgresql://shell:5432/app");
  });

  it("does not throw when .env is missing", () => {
    expect(() => loadEnvFromDirectory(workDir)).not.toThrow();
  });
});
