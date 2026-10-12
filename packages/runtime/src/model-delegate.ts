import {
  buildCreate,
  buildCreateMany,
  buildDelete,
  buildDeleteMany,
  buildFindFirst,
  buildFindMany,
  buildFindUnique,
  buildRestore,
  buildRestoreMany,
  buildUpdate,
  buildUpdateMany,
  isSoftDeleteModel,
  type CreateArgs,
  type CreateManyArgs,
  type DeleteArgs,
  type DeleteManyArgs,
  type FindFirstArgsWithInclude,
  type FindManyArgsWithInclude,
  type FindUniqueArgsWithInclude,
  type ModelMeta,
  type RestoreArgs,
  type RestoreManyArgs,
  type SqlDialect,
  type UpdateArgs,
  type UpdateManyArgs,
} from "@zed-orm/query-builder";
import { attachIncludes } from "./relation-loader.js";
import type { QueryExecutor } from "./index.js";
import {
  applyRelationalSoftDelete,
  needsRelationalSoftDelete,
  resolveDeleteParentIds,
} from "./soft-delete-engine.js";

type Row = Record<string, unknown>;

type TransactionRunner = <T>(
  callback: (executor: QueryExecutor) => Promise<T>,
) => Promise<T>;

/** CRUD delegate for a single model table. */
export class ModelDelegate<T extends Row = Row> {
  constructor(
    private readonly driver: QueryExecutor,
    private readonly meta: ModelMeta,
    private readonly modelMetas: Readonly<Record<string, ModelMeta>>,
    private readonly dialect: SqlDialect = "postgresql",
    private readonly runInTransaction?: TransactionRunner,
  ) {}

  private async withDeleteTransaction<TResult>(
    callback: (executor: QueryExecutor) => Promise<TResult>,
  ): Promise<TResult> {
    if (this.runInTransaction !== undefined) {
      return this.runInTransaction(callback);
    }
    return callback(this.driver);
  }

  async findMany(args: FindManyArgsWithInclude = {}): Promise<T[]> {
    const { include, ...queryArgs } = args;
    const statement = buildFindMany(this.meta, queryArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const rows = [...result.rows];

    if (include !== undefined) {
      await attachIncludes(
        this.driver,
        this.modelMetas,
        this.meta,
        rows,
        include,
        this.dialect,
      );
    }

    return rows;
  }

  async findFirst(args: FindFirstArgsWithInclude = {}): Promise<T | null> {
    const { include, ...queryArgs } = args;
    const statement = buildFindFirst(this.meta, queryArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0] ?? null;

    if (row !== null && include !== undefined) {
      await attachIncludes(
        this.driver,
        this.modelMetas,
        this.meta,
        [row],
        include,
        this.dialect,
      );
    }

    return row;
  }

  async findUnique(args: FindUniqueArgsWithInclude): Promise<T | null> {
    const { include, ...queryArgs } = args;
    const statement = buildFindUnique(this.meta, queryArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0] ?? null;

    if (row !== null && include !== undefined) {
      await attachIncludes(
        this.driver,
        this.modelMetas,
        this.meta,
        [row],
        include,
        this.dialect,
      );
    }

    return row;
  }

  async create(args: CreateArgs): Promise<T> {
    const statement = buildCreate(this.meta, args, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(`create on '${this.meta.modelName}' returned no row.`);
    }
    return row;
  }

  async createMany(args: CreateManyArgs): Promise<{ count: number }> {
    const statement = buildCreateMany(this.meta, args, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    return { count: result.rowCount };
  }

  async update(args: UpdateArgs): Promise<T> {
    const statement = buildUpdate(this.meta, args, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(`update on '${this.meta.modelName}' returned no row.`);
    }
    return row;
  }

  async updateMany(args: UpdateManyArgs): Promise<{ count: number }> {
    const statement = buildUpdateMany(this.meta, args, this.dialect);
    const result = await this.driver.query(statement.sql, [...statement.params]);
    return { count: result.rowCount };
  }

  async delete(args: DeleteArgs): Promise<T> {
    if (
      isSoftDeleteModel(this.meta) &&
      needsRelationalSoftDelete(this.meta, this.modelMetas)
    ) {
      return this.withDeleteTransaction(async (executor) => {
        const idRows = await resolveDeleteParentIds(
          executor,
          this.meta,
          args.where,
          this.dialect,
        );
        const parentIds = idRows.map(
          (row) => row[this.meta.idFields[0]!],
        );
        const deletedAt = args.deletedAt ?? new Date();
        await applyRelationalSoftDelete(
          executor,
          this.meta,
          parentIds,
          this.modelMetas,
          this.dialect,
          deletedAt,
        );

        const statement = buildDelete(this.meta, args, this.dialect);
        const result = await executor.query<T>(
          statement.sql,
          [...statement.params],
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new Error(
            `delete on '${this.meta.modelName}' returned no row.`,
          );
        }
        return row;
      });
    }

    const statement = buildDelete(this.meta, args, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(`delete on '${this.meta.modelName}' returned no row.`);
    }
    return row;
  }

  async deleteMany(args: DeleteManyArgs = {}): Promise<{ count: number }> {
    if (
      isSoftDeleteModel(this.meta) &&
      needsRelationalSoftDelete(this.meta, this.modelMetas)
    ) {
      return this.withDeleteTransaction(async (executor) => {
        const idRows = await resolveDeleteParentIds(
          executor,
          this.meta,
          args.where,
          this.dialect,
        );
        const parentIds = idRows.map(
          (row) => row[this.meta.idFields[0]!],
        );
        const deletedAt = args.deletedAt ?? new Date();
        await applyRelationalSoftDelete(
          executor,
          this.meta,
          parentIds,
          this.modelMetas,
          this.dialect,
          deletedAt,
        );

        const statement = buildDeleteMany(this.meta, args, this.dialect);
        const result = await executor.query(statement.sql, [
          ...statement.params,
        ]);
        return { count: result.rowCount };
      });
    }

    const statement = buildDeleteMany(this.meta, args, this.dialect);
    const result = await this.driver.query(statement.sql, [...statement.params]);
    return { count: result.rowCount };
  }

  async restore(args: RestoreArgs): Promise<T> {
    const statement = buildRestore(this.meta, args, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new Error(`restore on '${this.meta.modelName}' returned no row.`);
    }
    return row;
  }

  async restoreMany(args: RestoreManyArgs = {}): Promise<{ count: number }> {
    const statement = buildRestoreMany(this.meta, args, this.dialect);
    const result = await this.driver.query(statement.sql, [...statement.params]);
    return { count: result.rowCount };
  }
}

/** @deprecated Use {@link ModelDelegate}. */
export const ModelReadDelegate = ModelDelegate;
