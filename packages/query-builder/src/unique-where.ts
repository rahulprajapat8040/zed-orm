import { QueryError } from "./errors.js";
import { getUniqueFields, type ModelMeta } from "./meta.js";
import type { WhereInput } from "./types.js";

/** Ensure `where` targets a unique row (@id or @unique). */
export function assertUniqueWhere(meta: ModelMeta, where: WhereInput): void {
  const uniqueFields = new Set(
    getUniqueFields(meta).map((field) => field.name),
  );
  const provided = Object.keys(where).filter(
    (key) => key !== "AND" && key !== "OR" && where[key] !== undefined,
  );

  if (provided.length === 0 && !where.AND && !where.OR) {
    throw new QueryError(
      `Operation on '${meta.modelName}' requires a unique identifier in where.`,
    );
  }

  const hasCompositeId =
    meta.idFields.length > 1 &&
    meta.idFields.every((field) => provided.includes(field));

  const hasSingleUnique = provided.some((field) => uniqueFields.has(field));

  if (!hasCompositeId && !hasSingleUnique && !where.AND && !where.OR) {
    throw new QueryError(
      `Operation on '${meta.modelName}' requires an @id or @unique field in where.`,
    );
  }
}
