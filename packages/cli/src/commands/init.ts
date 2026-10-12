import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ensureRuntimeDependencies } from "../ensure-dependencies.js";

function createDefaultSchema(outputDir: string): string {
  return `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "zed-client"
  output   = ${outputDir}
}

model User {
  id    String @id @default(uuid())
  email String @unique
}
`;
}

export interface InitCommandOptions {
  readonly schemaPath: string;
  readonly migrationsDir: string;
  readonly outputDir: string;
}

function parseInitArgs(argv: readonly string[]): InitCommandOptions {
  let schemaPath = "zed/zed.schema";
  let migrationsDir: string | undefined;
  let outputDir = "src/generated/zed";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema" || arg === "-s") {
      schemaPath = argv[index + 1] ?? schemaPath;
      index += 1;
      continue;
    }
    if (arg === "--migrations" || arg === "-m") {
      migrationsDir = argv[index + 1] ?? migrationsDir;
      index += 1;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      outputDir = argv[index + 1] ?? outputDir;
      index += 1;
    }
  }

  return {
    schemaPath,
    migrationsDir: migrationsDir ?? join(dirname(schemaPath), "migrations"),
    outputDir,
  };
}

/** Run `zed init`. */
export async function runInit(argv: readonly string[]): Promise<number> {
  const options = parseInitArgs(argv);
  const schemaPath = resolve(options.schemaPath);
  const migrationsDir = resolve(options.migrationsDir);
  const outputDir = resolve(options.outputDir);

  await mkdir(dirname(schemaPath), { recursive: true });
  await mkdir(migrationsDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    schemaPath,
    createDefaultSchema(
      JSON.stringify(options.outputDir.replaceAll("\\", "/")),
    ),
    {
      encoding: "utf8",
      flag: "wx",
    },
  );

  await ensureRuntimeDependencies(process.cwd(), "postgresql");

  console.log(`zed init: created ${schemaPath}`);
  console.log(`zed init: created ${migrationsDir}/`);
  console.log(`zed init: created ${outputDir}/`);
  return 0;
}
