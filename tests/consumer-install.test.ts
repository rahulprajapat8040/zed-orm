import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const PACK_ORDER = [
  "packages/shared",
  "packages/ast",
  "packages/query-builder",
  "packages/runtime",
  "packages/parser",
  "packages/schema",
  "packages/generator",
  "packages/migration",
  "packages/drivers/postgres",
  "packages/cli",
] as const;

const PACK_NAME_MAP: Record<string, string> = {
  "shared": "@zed-orm/shared",
  "ast": "@zed-orm/ast",
  "query-builder": "@zed-orm/query-builder",
  "runtime": "@zed-orm/runtime",
  "parser": "@zed-orm/parser",
  "schema": "@zed-orm/schema",
  "generator": "@zed-orm/generator",
  "migration": "@zed-orm/migration",
  "postgres": "@zed-orm/driver-postgres",
  "cli": "@zed-orm/cli",
};

const runConsumerTest = process.env["RUN_CONSUMER_TEST"] === "1";

describe.skipIf(!runConsumerTest)("consumer installation", () => {
  let workDir: string;
  let consumerDir: string;

  beforeAll(() => {
    workDir = mkdtempSync(join(tmpdir(), "zed-consumer-"));
    const packDir = join(workDir, "packs");
    mkdirSync(packDir);

    for (const pkgPath of PACK_ORDER) {
      execSync(`pnpm pack --pack-destination ${JSON.stringify(packDir)}`, {
        cwd: join(repoRoot, pkgPath),
        stdio: "pipe",
      });
    }

    const deps: Record<string, string> = {};
    for (const file of readdirSync(packDir)) {
      const match = /^zed-orm-(.+)-(\d.+\.tgz)$/.exec(file);
      if (match === null) {
        continue;
      }
      const scoped = PACK_NAME_MAP[match[1]!];
      if (scoped !== undefined) {
        deps[scoped] = `file:${join(packDir, file)}`;
      }
    }

    consumerDir = join(workDir, "consumer");
    mkdirSync(consumerDir);
    writeFileSync(
      join(consumerDir, "package.json"),
      JSON.stringify(
        {
          name: "zed-consumer-test",
          version: "1.0.0",
          private: true,
          type: "module",
          dependencies: {
            ...deps,
            typescript: "^5.8.2",
          },
        },
        null,
        2,
      ),
    );

    writeFileSync(
      join(consumerDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
          },
          include: ["src/**/*.ts", "generated/**/*.ts"],
        },
        null,
        2,
      ),
    );

    execSync("npm install", {
      cwd: consumerDir,
      stdio: "pipe",
    });
  }, 120_000);

  afterAll(() => {
    if (existsSync(workDir)) {
      rmSync(workDir, { recursive: true, force: true });
    }
  });

  it("installs CLI, generates client, and compiles TypeScript", () => {
    const zedBin = join(consumerDir, "node_modules", "@zed-orm", "cli", "dist", "bin.cjs");
    execSync(`node ${JSON.stringify(zedBin)} init`, { cwd: consumerDir, stdio: "pipe" });
    execSync(`node ${JSON.stringify(zedBin)} generate`, { cwd: consumerDir, stdio: "pipe" });

    mkdirSync(join(consumerDir, "src"), { recursive: true });
    writeFileSync(
      join(consumerDir, "src", "main.ts"),
      `import { createClient } from "../generated/zed/index.js";

const db = createClient({ databaseUrl: "postgresql://localhost:5432/test" });

async function main(): Promise<void> {
  await db.user.findMany();
  await db.user.create({ data: { email: "test@example.com" } });
}

void main();
`,
    );

    execSync("npx tsc -p tsconfig.json", { cwd: consumerDir, stdio: "pipe" });

    const pkg = JSON.parse(
      readFileSync(join(consumerDir, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };

    expect(pkg.dependencies["@zed-orm/runtime"]).toBeDefined();
    expect(pkg.dependencies["@zed-orm/query-builder"]).toBeDefined();
    expect(pkg.dependencies["@zed-orm/driver-postgres"]).toBeDefined();
    expect(existsSync(join(consumerDir, "generated", "zed", "client.ts"))).toBe(
      true,
    );
  }, 60_000);
});
