import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runCli } from "./index.js";

describe("runCli", () => {
  let workDir: string;
  const previousCwd = process.cwd();
  const previousDatabaseUrl = process.env["DATABASE_URL"];

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-cli-run-"));
    process.chdir(workDir);
    delete process.env["DATABASE_URL"];
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    if (previousDatabaseUrl === undefined) {
      delete process.env["DATABASE_URL"];
    } else {
      process.env["DATABASE_URL"] = previousDatabaseUrl;
    }
    await rm(workDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it("loads environment variables from .env before running commands", async () => {
    await writeFile(
      join(workDir, ".env"),
      "DATABASE_URL=postgresql://localhost:5432/app\n",
      "utf8",
    );

    const code = await runCli(["help"]);

    expect(code).toBe(0);
    expect(process.env["DATABASE_URL"]).toBe("postgresql://localhost:5432/app");
  });

  it("continues when .env is missing", async () => {
    const code = await runCli(["help"]);
    expect(code).toBe(0);
  });

  it("makes DATABASE_URL available to migrate before argument parsing", async () => {
    await writeFile(
      join(workDir, ".env"),
      "DATABASE_URL=postgresql://localhost:5432/app\n",
      "utf8",
    );
    await writeFile(
      join(workDir, "schema.zed"),
      `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id String @id
}
`,
      "utf8",
    );

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(runCli(["migrate", "status"])).rejects.toThrow();

    expect(errorSpy).not.toHaveBeenCalledWith("zed migrate: DATABASE_URL is required.");
  });
});
