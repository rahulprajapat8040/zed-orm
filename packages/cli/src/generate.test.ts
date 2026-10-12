import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-cli-"));
    await writeFile(join(workDir, "schema.zed"), schemaSource, "utf8");
  });

  afterEach(async () => {
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
});
