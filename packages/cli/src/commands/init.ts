import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_MIGRATIONS_DIR } from "@zed-orm/migration";

const DEFAULT_SCHEMA = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "zed-client"
  output   = "generated/zed"
}

model User {
  id    String @id @default(uuid())
  email String @unique
}
`;

export interface InitCommandOptions {
  readonly schemaPath: string;
  readonly migrationsDir: string;
  readonly outputDir: string;
}

function parseInitArgs(argv: readonly string[]): InitCommandOptions {
  let schemaPath = "schema.zed";
  let migrationsDir: string = DEFAULT_MIGRATIONS_DIR;
  let outputDir = "generated/zed";

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

  return { schemaPath, migrationsDir, outputDir };
}

/** Run `zed init`. */
export async function runInit(argv: readonly string[]): Promise<number> {
  const options = parseInitArgs(argv);
  const schemaPath = resolve(options.schemaPath);
  const migrationsDir = resolve(options.migrationsDir);
  const outputDir = resolve(options.outputDir);

  await mkdir(migrationsDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });
  await writeFile(schemaPath, DEFAULT_SCHEMA, { encoding: "utf8", flag: "wx" });

  console.log(`zed init: created ${schemaPath}`);
  console.log(`zed init: created ${migrationsDir}/`);
  console.log(`zed init: created ${outputDir}/`);
  return 0;
}
