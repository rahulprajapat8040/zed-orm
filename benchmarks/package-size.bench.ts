import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { bench, describe } from "vitest";

const root = join(import.meta.dirname, "..");
const packagesDir = join(root, "packages");

function directorySize(dir: string): number {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(fullPath);
      continue;
    }
    total += statSync(fullPath).size;
  }
  return total;
}

function listPackageDirs(): string[] {
  const dirs: string[] = [];
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name === "drivers") {
      for (const driver of readdirSync(join(packagesDir, "drivers"), {
        withFileTypes: true,
      })) {
        if (driver.isDirectory()) {
          dirs.push(join(packagesDir, "drivers", driver.name));
        }
      }
      continue;
    }
    dirs.push(join(packagesDir, entry.name));
  }
  return dirs;
}

describe("package dist size", () => {
  for (const packageDir of listPackageDirs()) {
    const distDir = join(packageDir, "dist");
    if (!existsSync(distDir)) {
      continue;
    }

    const name = packageDir.split("/").slice(-2).join("/");
    bench(`${name} dist bytes`, () => {
      directorySize(distDir);
    });
  }
});
