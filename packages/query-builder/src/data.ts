import { QueryError } from "./errors.js";
import type { FieldMeta, ModelMeta } from "./meta.js";
import type { DataInput } from "./types.js";

/** Resolve a writable data field (scalar only). */
export function resolveDataField(
  meta: ModelMeta,
  fieldName: string,
): FieldMeta {
  const field = meta.fields.get(fieldName);
  if (field === undefined) {
    throw new QueryError(
      `Unknown data field '${fieldName}' on model '${meta.modelName}'.`,
    );
  }
  if (field.isRelation) {
    throw new QueryError(
      `Cannot write relation field '${meta.modelName}.${fieldName}'.`,
    );
  }
  return field;
}

/** Apply automatic `@updatedAt` timestamps before write compilation. */
export function applyAutomaticTimestamps(
  meta: ModelMeta,
  data: DataInput,
  operation: "create" | "update",
): DataInput {
  const result: Record<string, DataInput[keyof DataInput]> = { ...data };

  for (const field of meta.fields.values()) {
    if (field.isUpdatedAt !== true) {
      continue;
    }
    if (operation === "update" || result[field.name] === undefined) {
      result[field.name] = new Date();
    }
  }

  return result;
}

/** Validate and return data entries in stable field-name order. */
export function normalizeDataInput(
  meta: ModelMeta,
  data: DataInput,
  operation: string,
): readonly (readonly [string, unknown])[] {
  const entries = Object.entries(data).filter(
    ([, value]) => value !== undefined,
  );

  if (entries.length === 0) {
    throw new QueryError(`${operation} requires at least one field in data.`);
  }

  const sorted = entries.sort(([left], [right]) => left.localeCompare(right));
  for (const [fieldName] of sorted) {
    resolveDataField(meta, fieldName);
  }

  return sorted;
}
