import { quoteIdentifier } from "./dialect.js";
import { QueryError } from "./errors.js";
import type { ModelMeta, SqlDialect } from "./meta.js";
import { assertUniqueWhere } from "./unique-where.js";
import { compileOrderBy } from "./order-by.js";
import { ParamCollector } from "./params.js";
import { compileSelect } from "./select.js";
import type {
  FindFirstArgs,
  FindManyArgs,
  FindUniqueArgs,
  SqlStatement,
  WhereInput,
} from "./types.js";
import { mergeReadWhere } from "./soft-delete.js";
import { compileWhere } from "./where.js";

function buildSelectQuery(
  dialect: SqlDialect,
  meta: ModelMeta,
  args: {
    where?: WhereInput;
    select?: FindManyArgs["select"];
    orderBy?: FindManyArgs["orderBy"];
    take?: number;
    skip?: number;
    withDeleted?: boolean;
    onlyDeleted?: boolean;
  },
): SqlStatement {
  const params = new ParamCollector(dialect);
  const table = quoteIdentifier(dialect, meta.tableName);
  const columns = compileSelect(dialect, meta, args.select);
  const where = mergeReadWhere(meta, args.where, {
    ...(args.withDeleted === true ? { withDeleted: true } : {}),
    ...(args.onlyDeleted === true ? { onlyDeleted: true } : {}),
  });

  const clauses = [`SELECT ${columns} FROM ${table}`];

  if (where !== undefined) {
    clauses.push(`WHERE ${compileWhere(dialect, meta, where, params)}`);
  }

  const orderBy = compileOrderBy(dialect, meta, args.orderBy);
  if (orderBy !== undefined) {
    clauses.push(`ORDER BY ${orderBy}`);
  }

  if (args.take !== undefined) {
    if (!Number.isInteger(args.take) || args.take < 0) {
      throw new QueryError("`take` must be a non-negative integer.");
    }
    clauses.push(`LIMIT ${params.add(args.take)}`);
  }

  if (args.skip !== undefined) {
    if (!Number.isInteger(args.skip) || args.skip < 0) {
      throw new QueryError("`skip` must be a non-negative integer.");
    }
    clauses.push(`OFFSET ${params.add(args.skip)}`);
  }

  return {
    sql: clauses.join(" "),
    params: params.params,
  };
}

/** Build SQL for `findMany`. */
export function buildFindMany(
  meta: ModelMeta,
  args: FindManyArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  return buildSelectQuery(dialect, meta, args);
}

/** Build SQL for `findFirst` (LIMIT 1). */
export function buildFindFirst(
  meta: ModelMeta,
  args: FindFirstArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  return buildSelectQuery(dialect, meta, {
    ...args,
    take: 1,
  });
}

/** Build SQL for `findUnique` (unique where + LIMIT 1). */
export function buildFindUnique(
  meta: ModelMeta,
  args: FindUniqueArgs,
  dialect: SqlDialect = "postgresql",
): SqlStatement {
  assertUniqueWhere(meta, args.where);
  return buildSelectQuery(dialect, meta, {
    ...args,
    take: 1,
  });
}
