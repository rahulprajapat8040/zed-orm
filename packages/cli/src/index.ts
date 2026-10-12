/**
 * @zed-orm/cli
 *
 * Command-line interface for Zed ORM.
 */

import { runGenerate } from "./commands/generate.js";
import { runInit } from "./commands/init.js";
import { runMigrate } from "./commands/migrate.js";
import { runValidate } from "./commands/validate.js";
import { loadEnvFromDirectory } from "./load-env.js";

export const PACKAGE_NAME = "@zed-orm/cli" as const;

/** CLI entry — supports init, validate, generate, and migrate. */
export async function runCli(
  argv: readonly string[] = process.argv.slice(2),
): Promise<number> {
  loadEnvFromDirectory(process.cwd());

  const command = argv[0];

  if (command === undefined) {
    console.error("zed: missing command. Try: zed help");
    return 1;
  }

  switch (command) {
    case "init":
      return runInit(argv.slice(1));
    case "validate":
      return runValidate(argv.slice(1));
    case "generate":
    case "gen":
      return runGenerate(argv.slice(1));
    case "migrate":
      return runMigrate(argv.slice(1));
    case "help":
    case "--help":
    case "-h":
      printHelp();
      return 0;
    default:
      console.error(`zed: unknown command '${command}'. Try: zed help`);
      return 1;
  }
}

function printHelp(): void {
  console.log(`zed — Zed ORM CLI

Usage:
  zed init [options]         Initialize a new Zed project
  zed validate [options]     Validate schema.zed
  zed generate [options]     Generate the TypeScript client
  zed migrate <subcommand>   Manage database migrations

Options:
  -s, --schema <path>        Schema file (default: schema.zed)
  -o, --output <dir>         Output directory (default: generated/zed)
  -m, --migrations <dir>     Migrations directory (default: migrations)
  -h, --help                 Show help

Migrate subcommands:
  zed migrate dev            Create and apply a migration from schema changes
  zed migrate deploy         Apply pending migrations
  zed migrate status         Show applied and pending migrations
  zed migrate reset          Drop schema objects and reapply all migrations
`);
}
