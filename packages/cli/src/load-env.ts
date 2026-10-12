import { config } from "dotenv";
import { join, resolve } from "node:path";

/**
 * Load `.env` from the working directory without overriding existing variables.
 */
export function loadEnvFromDirectory(startDir: string): void {
  config({
    path: join(resolve(startDir), ".env"),
    quiet: true,
  });
}
