import { readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureRuntimeDependencies, getCliPackageVersion } from "./ensure-dependencies.js";

describe("ensureRuntimeDependencies", () => {
  let workDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "zed-deps-"));
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({ name: "consumer", version: "1.0.0", private: true }),
      "utf8",
    );
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("adds missing runtime packages without overwriting existing entries", async () => {
    await writeFile(
      join(workDir, "package.json"),
      JSON.stringify({
        name: "consumer",
        version: "1.0.0",
        private: true,
        dependencies: {
          "@zed-orm/runtime": "0.0.9",
        },
      }),
      "utf8",
    );

    const changed = await ensureRuntimeDependencies(workDir, "postgresql");
    expect(changed).toBe(true);

    const pkg = JSON.parse(await readFile(join(workDir, "package.json"), "utf8")) as {
      dependencies: Record<string, string>;
    };

    expect(pkg.dependencies["@zed-orm/runtime"]).toBe("0.0.9");
    expect(pkg.dependencies["@zed-orm/query-builder"]).toBe(getCliPackageVersion());
    expect(pkg.dependencies["@zed-orm/driver-postgres"]).toBe(getCliPackageVersion());
  });
});
