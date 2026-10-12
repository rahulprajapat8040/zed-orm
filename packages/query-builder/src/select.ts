import { quoteIdentifier } from "./dialect.js";
import { QueryError } from "./errors.js";
import { getScalarFields, type ModelMeta, type SqlDialect } from "./meta.js";
import type { SelectInput } from "./types.js";

/** Build the SELECT column list for a model query. */
export function compileSelect(
  dialect: SqlDialect,
  meta: ModelMeta,
  select?: SelectInput,
): string {
  if (select === undefined) {
    const columns = getScalarFields(meta).map((field) =>
      quoteIdentifier(dialect, field.columnName),
    );
    if (columns.length === 0) {
      throw new QueryError(
        `Model '${meta.modelName}' has no scalar fields to select.`,
      );
    }
    return columns.join(", ");
  }

  const selected: string[] = [];
  for (const [fieldName, enabled] of Object.entries(select)) {
    if (!enabled) {
      continue;
    }
    const field = meta.fields.get(fieldName);
    if (field === undefined) {
      throw new QueryError(
        `Unknown select field '${fieldName}' on model '${meta.modelName}'.`,
      );
    }
    if (field.isRelation) {
      throw new QueryError(
        `Cannot select relation field '${meta.modelName}.${fieldName}' in Milestone 5.`,
      );
    }
    selected.push(quoteIdentifier(dialect, field.columnName));
  }

  if (selected.length === 0) {
    throw new QueryError("Select clause must include at least one field.");
  }

  return selected.join(", ");
}
