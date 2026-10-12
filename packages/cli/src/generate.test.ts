import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGenerate } from "./commands/generate.js";

const schemaSource = `
model User {
  id    String @id
  email String @unique
}
`;

describe("zed generate", () => {
  let workDir: string;

  const previousCwd = process.cwd();

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-cli-"));
    await writeFile(join(workDir, "schema.zed"), schemaSource, "utf8");
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({ name: "zed-cli-test", version: "1.0.0", private: true }),
      "utf8",
    );
    process.chdir(workDir);
  });

  afterEach(async () => {
    process.chdir(previousCwd);
    await rm(workDir, { recursive: true, force: true });
  });

  it("writes generated client files", async () => {
    const outputDir = join(workDir, "generated");
    const code = await runGenerate([
      "--schema",
      join(workDir, "schema.zed"),
      "--output",
      outputDir,
    ]);

    expect(code).toBe(0);

    const index = await readFile(join(outputDir, "index.ts"), "utf8");
    const types = await readFile(join(outputDir, "types.ts"), "utf8");

    expect(index).toContain('export * from "./client.js"');
    expect(types).toContain("export type User = {");
  });

  it("uses the output path configured in the schema", async () => {
    const schemaPath = join(workDir, "zed", "zed.schema");
    const outputDir = join(workDir, "src", "generated", "zed");
    await mkdir(join(workDir, "zed"), { recursive: true });
    await writeFile(
      schemaPath,
      `generator client {
  provider = "zed-client"
  output   = "src/generated/zed"
}

${schemaSource}`,
      "utf8",
    );

    const code = await runGenerate(["--schema", schemaPath]);

    expect(code).toBe(0);
    expect(await readFile(join(outputDir, "index.ts"), "utf8")).toContain(
      'export * from "./client.js"',
    );
  });

  it("uses the standard schema location when no arguments are supplied", async () => {
    const schemaPath = join(workDir, "zed", "zed.schema");
    const outputDir = join(workDir, "src", "generated", "zed");
    await mkdir(join(workDir, "zed"), { recursive: true });
    await writeFile(
      schemaPath,
      `generator client {
  provider = "zed-client"
  output   = "src/generated/zed"
}

${schemaSource}`,
      "utf8",
    );

    const code = await runGenerate([]);

    expect(code).toBe(0);
    await expect(
      readFile(join(outputDir, "index.ts"), "utf8"),
    ).resolves.toContain('export * from "./client.js"');
  });

  it("allows --output to override the schema output path", async () => {
    const schemaPath = join(workDir, "schema.zed");
    await writeFile(
      schemaPath,
      `generator client {
  provider = "zed-client"
  output   = "schema-output"
}

${schemaSource}`,
      "utf8",
    );
    const outputDir = join(workDir, "override");

    const code = await runGenerate([
      "--schema",
      join(workDir, "schema.zed"),
      "--output",
      outputDir,
    ]);

    expect(code).toBe(0);
    await expect(
      readFile(join(outputDir, "index.ts"), "utf8"),
    ).resolves.toContain('export * from "./client.js"');
    await expect(
      readFile(join(workDir, "schema-output", "index.ts"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});
