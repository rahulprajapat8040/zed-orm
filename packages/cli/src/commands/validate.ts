import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseSchema } from "@zed-orm/parser";
import { SchemaError, validateSchema } from "@zed-orm/schema";

export interface ValidateCommandOptions {
  readonly schemaPath: string;
}

function parseValidateArgs(argv: readonly string[]): ValidateCommandOptions {
  let schemaPath = "schema.zed";

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--schema" || arg === "-s") {
      schemaPath = argv[index + 1] ?? schemaPath;
      index += 1;
    }
  }

  return { schemaPath };
}

/** Run `zed validate`. */
export async function runValidate(argv: readonly string[]): Promise<number> {
  const options = parseValidateArgs(argv);
  const schemaPath = resolve(options.schemaPath);

  try {
    const source = await readFile(schemaPath, "utf8");
    const ast = parseSchema(source, schemaPath);
    const schema = validateSchema(ast);
    console.log(
      `zed validate: schema is valid (${schema.models.size} models, ${schema.enums.size} enums)`,
    );
    return 0;
  } catch (error) {
    if (error instanceof SchemaError) {
      console.error(`zed validate: ${error.message}`);
      return 1;
    }
    throw error;
  }
}
