import { quoteIdentifier } from "./dialect.js";
import { QueryError } from "./errors.js";
import type { ModelMeta, SqlDialect } from "./meta.js";
import type { OrderByInput, OrderDirection } from "./types.js";

function compileOrderEntry(
  dialect: SqlDialect,
  meta: ModelMeta,
  fieldName: string,
  direction: OrderDirection,
): string {
  const field = meta.fields.get(fieldName);
  if (field === undefined) {
    throw new QueryError(
      `Unknown orderBy field '${fieldName}' on model '${meta.modelName}'.`,
    );
  }
  if (field.isRelation) {
    throw new QueryError(
      `Cannot order by relation field '${meta.modelName}.${fieldName}' in Milestone 5.`,
    );
  }
  const normalized = direction.toUpperCase() === "DESC" ? "DESC" : "ASC";
  return `${quoteIdentifier(dialect, field.columnName)} ${normalized}`;
}

/** Build an ORDER BY clause (without the `ORDER BY` keyword), or `undefined`. */
export function compileOrderBy(
  dialect: SqlDialect,
  meta: ModelMeta,
  orderBy?: OrderByInput,
): string | undefined {
  if (orderBy === undefined) {
    return undefined;
  }

  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const parts: string[] = [];

  for (const entry of entries) {
    for (const [fieldName, direction] of Object.entries(entry) as Array<
      [string, OrderDirection]
    >) {
      parts.push(compileOrderEntry(dialect, meta, fieldName, direction));
    }
  }

  if (parts.length === 0) {
    return undefined;
  }

  return parts.join(", ");
}
