import { quoteIdentifier } from "./dialect.js";
import { QueryError } from "./errors.js";
import type { FieldMeta, ModelMeta, SqlDialect } from "./meta.js";
import type { ParamCollector } from "./params.js";
import type { FieldFilter, FieldWhereInput, WhereInput } from "./types.js";

function resolveField(
  meta: ModelMeta,
  fieldName: string,
): FieldMeta {
  const field = meta.fields.get(fieldName);
  if (field === undefined) {
    throw new QueryError(
      `Unknown where field '${fieldName}' on model '${meta.modelName}'.`,
    );
  }
  if (field.isRelation) {
    throw new QueryError(
      `Cannot filter on relation field '${meta.modelName}.${fieldName}' in Milestone 5.`,
    );
  }
  return field;
}

function compileScalarFilter(
  dialect: SqlDialect,
  column: string,
  filter: FieldFilter,
  params: ParamCollector,
): string {
  const quoted = quoteIdentifier(dialect, column);
  const parts: string[] = [];

  if (filter.equals !== undefined) {
    if (filter.equals === null) {
      parts.push(`${quoted} IS NULL`);
    } else {
      parts.push(`${quoted} = ${params.add(filter.equals)}`);
    }
  }
  if (filter.not !== undefined) {
    if (typeof filter.not === "object" && filter.not !== null && "equals" in filter.not) {
      if (filter.not.equals === null) {
        parts.push(`${quoted} IS NOT NULL`);
      } else {
        parts.push(`${quoted} <> ${params.add(filter.not.equals)}`);
      }
    } else if (filter.not === null) {
      parts.push(`${quoted} IS NOT NULL`);
    } else {
      parts.push(`${quoted} <> ${params.add(filter.not)}`);
    }
  }
  if (filter.in !== undefined) {
    if (filter.in.length === 0) {
      throw new QueryError("`in` filter must contain at least one value.");
    }
    const placeholders = filter.in.map((value) => params.add(value));
    parts.push(`${quoted} IN (${placeholders.join(", ")})`);
  }
  if (filter.notIn !== undefined) {
    if (filter.notIn.length === 0) {
      throw new QueryError("`notIn` filter must contain at least one value.");
    }
    const placeholders = filter.notIn.map((value) => params.add(value));
    parts.push(`${quoted} NOT IN (${placeholders.join(", ")})`);
  }
  if (filter.lt !== undefined) {
    parts.push(`${quoted} < ${params.add(filter.lt)}`);
  }
  if (filter.lte !== undefined) {
    parts.push(`${quoted} <= ${params.add(filter.lte)}`);
  }
  if (filter.gt !== undefined) {
    parts.push(`${quoted} > ${params.add(filter.gt)}`);
  }
  if (filter.gte !== undefined) {
    parts.push(`${quoted} >= ${params.add(filter.gte)}`);
  }

  if (parts.length === 0) {
    throw new QueryError("Field filter must specify at least one operator.");
  }

  if (parts.length === 1) {
    return parts[0]!;
  }

  return `(${parts.join(" AND ")})`;
}

function compileFieldFilter(
  dialect: SqlDialect,
  field: FieldMeta,
  input: FieldWhereInput,
  params: ParamCollector,
): string {
  if (input === null) {
    const quoted = quoteIdentifier(dialect, field.columnName);
    return `${quoted} IS NULL`;
  }

  if (
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean" ||
    typeof input === "bigint" ||
    input instanceof Date
  ) {
    const quoted = quoteIdentifier(dialect, field.columnName);
    return `${quoted} = ${params.add(input)}`;
  }

  return compileScalarFilter(dialect, field.columnName, input, params);
}

function compileWhereNode(
  dialect: SqlDialect,
  meta: ModelMeta,
  where: WhereInput,
  params: ParamCollector,
): string {
  const fieldClauses: string[] = [];

  for (const key of Object.keys(where)) {
    if (key === "AND" || key === "OR") {
      continue;
    }
    const value = where[key];
    if (value === undefined) {
      continue;
    }
    const field = resolveField(meta, key);
    fieldClauses.push(compileFieldFilter(dialect, field, value, params));
  }

  const andClauses = (where.AND ?? []).map((child) =>
    compileWhereNode(dialect, meta, child, params),
  );
  const orClauses = (where.OR ?? []).map((child) =>
    compileWhereNode(dialect, meta, child, params),
  );

  const clauses = [...fieldClauses, ...andClauses];

  if (orClauses.length > 0) {
    if (orClauses.length === 1) {
      clauses.push(orClauses[0]!);
    } else {
      clauses.push(`(${orClauses.join(" OR ")})`);
    }
  }

  if (clauses.length === 0) {
    throw new QueryError("Where clause must contain at least one condition.");
  }

  if (clauses.length === 1) {
    return clauses[0]!;
  }

  return clauses.map((clause) => `(${clause})`).join(" AND ");
}

/** Compile a where clause into a SQL fragment (without the `WHERE` keyword). */
export function compileWhere(
  dialect: SqlDialect,
  meta: ModelMeta,
  where: WhereInput,
  params: ParamCollector,
): string {
  return compileWhereNode(dialect, meta, where, params);
}
