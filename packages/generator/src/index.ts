/**
 * @zed-orm/generator
 *
 * Deterministic TypeScript client and type generation.
 */

export const PACKAGE_NAME = "@zed-orm/generator" as const;

export { modelToMeta, schemaToModelMetas } from "./schema-to-meta.js";
export {
  generateClient,
  type GeneratedFile,
  type GenerateClientOptions,
  type GenerateClientResult,
} from "./generate.js";
