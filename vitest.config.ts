import path from "node:path";
import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

/** Resolve workspace packages to source during tests (no build required for unit smoke). */
function pkg(name: string, relativeSrc: string): [string, string] {
  return [name, path.join(root, relativeSrc)];
}

export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
      },
    },
  },
  resolve: {
    alias: Object.fromEntries([
      pkg("@zed-orm/shared", "packages/shared/src/index.ts"),
      pkg("@zed-orm/ast", "packages/ast/src/index.ts"),
      pkg("@zed-orm/parser", "packages/parser/src/index.ts"),
      pkg("@zed-orm/schema", "packages/schema/src/index.ts"),
      pkg("@zed-orm/query-builder", "packages/query-builder/src/index.ts"),
      pkg("@zed-orm/runtime", "packages/runtime/src/index.ts"),
      pkg("@zed-orm/client", "packages/client/src/index.ts"),
      pkg("@zed-orm/generator", "packages/generator/src/index.ts"),
      pkg("@zed-orm/migration", "packages/migration/src/index.ts"),
      pkg("@zed-orm/cli", "packages/cli/src/index.ts"),
      pkg("@zed-orm/driver-postgres", "packages/drivers/postgres/src/index.ts"),
      pkg("@zed-orm/driver-mysql", "packages/drivers/mysql/src/index.ts"),
      pkg("@zed-orm/nestjs", "packages/nestjs/src/index.ts"),
    ]),
  },
  test: {
    globals: false,
    environment: "node",
    include: [
      "packages/**/src/**/*.{test,spec}.ts",
      "packages/**/__tests__/**/*.{test,spec}.ts",
      "tests/**/*.{test,spec}.ts",
    ],
    exclude: ["**/node_modules/**", "**/dist/**", "examples/**"],
    passWithNoTests: true,
    benchmark: {
      include: ["benchmarks/**/*.bench.ts"],
    },
  },
});
