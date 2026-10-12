import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { generateClient } from "@zed-orm/generator";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";

export interface GenerateCommandOptions {
  readonly schemaPath: string;
  readonly outputDir: string;
}

function parseGenerateArgs(argv: readonly string[]): GenerateCommandOptions {
  let schemaPath = "schema.zed";
  let outputDir = "generated/zed";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema" || arg === "-s") {
      schemaPath = argv[index + 1] ?? schemaPath;
      index += 1;
      continue;
    }
    if (arg === "--output" || arg === "-o") {
      outputDir = argv[index + 1] ?? outputDir;
      index += 1;
    }
  }

  return { schemaPath, outputDir };
}

/** Run `zed generate`. */
export async function runGenerate(argv: readonly string[]): Promise<number> {
  const options = parseGenerateArgs(argv);
  const schemaPath = resolve(options.schemaPath);
  const outputDir = resolve(options.outputDir);

  const source = await readFile(schemaPath, "utf8");
  const ast = parseSchema(source, schemaPath);
  const schema = validateSchema(ast);
  const result = generateClient(schema);

  await mkdir(outputDir, { recursive: true });

  for (const file of result.files) {
    const target = join(outputDir, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }

  console.log(
    `zed generate: wrote ${result.files.length} files to ${outputDir}`,
  );
  return 0;
}
