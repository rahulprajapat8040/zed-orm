import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runInit } from "./commands/init.js";
import { runValidate } from "./commands/validate.js";

describe("zed validate", () => {
  let workDir: string;
  const previousCwd = process.cwd();

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-cli-validate-"));
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({ name: "zed-cli-validate", version: "1.0.0", private: true }),
      "utf8",
    );
    process.chdir(workDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(workDir, { recursive: true, force: true });
  });

  it("accepts a valid schema", async () => {
    await runInit([
      "--schema",
      join(workDir, "schema.zed"),
      "--migrations",
      join(workDir, "migrations"),
      "--output",
      join(workDir, "generated"),
    ]);
    const code = await runValidate(["--schema", join(workDir, "schema.zed")]);
    expect(code).toBe(0);
  });

  it("rejects an invalid schema", async () => {
    const schemaPath = join(workDir, "schema.zed");
    await writeFile(
      schemaPath,
      `
model User {
  email String
}
`,
      "utf8",
    );

    const code = await runValidate(["--schema", schemaPath]);
    expect(code).toBe(1);
  });
});

describe("zed init", () => {
  let workDir: string;
  const previousCwd = process.cwd();

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-cli-init-"));
    process.chdir(workDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(workDir, { recursive: true, force: true });
  });

  it("creates schema and migration directories", async () => {
    const schemaPath = join(workDir, "schema.zed");
    const code = await runInit([
      "--schema",
      schemaPath,
      "--migrations",
      join(workDir, "migrations"),
      "--output",
      join(workDir, "generated"),
    ]);

    expect(code).toBe(0);
    const schema = await readFile(schemaPath, "utf8");
    expect(schema).toContain("model User");
    expect(schema).toContain('provider = "postgresql"');
  });
});
