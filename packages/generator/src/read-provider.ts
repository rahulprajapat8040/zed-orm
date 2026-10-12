import { isStringLiteral } from "@zed-orm/ast";
import type { ValidatedSchema } from "@zed-orm/schema";
import type { SqlDialect } from "@zed-orm/query-builder";

/** Read the datasource provider from a validated schema. */
export function readDatasourceProvider(
  schema: ValidatedSchema,
): SqlDialect {
  const datasource = schema.datasources[0];
  if (datasource === undefined) {
    return "postgresql";
  }

  for (const entry of datasource.config) {
    if (entry.key.name !== "provider") {
      continue;
    }
    if (
      isStringLiteral(entry.value) &&
      (entry.value.value === "postgresql" || entry.value.value === "mysql")
    ) {
      return entry.value.value;
    }
  }

  return "postgresql";
}
