import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type DatabaseProvider = "postgresql" | "mysql";

function getModuleDir(): string {
  // CJS bundle (bin.cjs) provides __dirname; ESM uses import.meta.url.
  if (typeof __dirname !== "undefined") {
    return __dirname;
  }
  return dirname(fileURLToPath(import.meta.url));
}

function readCliVersion(): string {
  const moduleDir = getModuleDir();
  const packageJsonPath = join(moduleDir, "..", "package.json");
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version: string;
  };
  return pkg.version;
}

const CLI_VERSION: string = readCliVersion();

const RUNTIME_PACKAGES = ["@zed-orm/runtime", "@zed-orm/query-builder"] as const;

function driverPackage(provider: DatabaseProvider): string {
  return provider === "mysql"
    ? "@zed-orm/driver-mysql"
    : "@zed-orm/driver-postgres";
}

function findPackageJsonDir(startDir: string): string | null {
  const dir = resolve(startDir);
  if (existsSync(join(dir, "package.json"))) {
    return dir;
  }
  return null;
}

interface PackageJson {
  name?: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Ensure generated-client runtime packages are declared in the consumer project.
 * Does not overwrite existing dependency entries.
 */
export async function ensureRuntimeDependencies(
  startDir: string,
  provider: DatabaseProvider,
): Promise<boolean> {
  const projectDir = findPackageJsonDir(startDir);
  if (projectDir === null) {
    return false;
  }

  const packageJsonPath = join(projectDir, "package.json");
  const raw = await readFile(packageJsonPath, "utf8");
  const pkg = JSON.parse(raw) as PackageJson;
  const dependencies = { ...(pkg.dependencies ?? {}) };
  const required = [...RUNTIME_PACKAGES, driverPackage(provider)];
  let changed = false;

  for (const name of required) {
    if (dependencies[name] === undefined) {
      dependencies[name] = CLI_VERSION;
      changed = true;
    }
  }

  if (!changed) {
    return false;
  }

  pkg.dependencies = dependencies;
  await writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
  console.log(
    `zed: added missing runtime dependencies to ${packageJsonPath} (${required.join(", ")})`,
  );
  return true;
}

/** CLI package version used when adding runtime dependencies. */
export function getCliPackageVersion(): string {
  return CLI_VERSION;
}
