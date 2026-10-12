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
  type FindFirstArgs,
  type FindManyArgs,
  type FindUniqueArgs,
  type ModelMeta,
  type RestoreArgs,
  type RestoreManyArgs,
  type SqlDialect,
  type UpdateArgs,
  type UpdateManyArgs,
} from "@zed-orm/query-builder";
import { RecordNotFoundError } from "@zed-orm/shared";
import { attachIncludes } from "./relation-loader.js";
import type { QueryExecutor } from "./index.js";
import type {
  DefaultModelDelegateTypes,
  ModelDelegateTypes,
} from "./model-delegate-types.js";
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
export class ModelDelegate<
  T extends Row = Row,
  TTypes extends ModelDelegateTypes = DefaultModelDelegateTypes,
> {
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

  async findMany(args: TTypes["findMany"] = {} as TTypes["findMany"]): Promise<T[]> {
    const { include, ...queryArgs } = args;
    const statement = buildFindMany(this.meta, queryArgs as FindManyArgs, this.dialect);
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

  async findFirst(args: TTypes["findFirst"] = {} as TTypes["findFirst"]): Promise<T | null> {
    const { include, ...queryArgs } = args;
    const statement = buildFindFirst(this.meta, queryArgs as FindFirstArgs, this.dialect);
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

  async findUnique(args: TTypes["findUnique"]): Promise<T | null> {
    const { include, ...queryArgs } = args;
    const statement = buildFindUnique(this.meta, queryArgs as FindUniqueArgs, this.dialect);
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

  async create(args: TTypes["create"]): Promise<T> {
    const statement = buildCreate(this.meta, args as CreateArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new RecordNotFoundError(
        `create on '${this.meta.modelName}' returned no row.`,
      );
    }
    return row;
  }

  async createMany(args: TTypes["createMany"]): Promise<{ count: number }> {
    const statement = buildCreateMany(this.meta, args as CreateManyArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    return { count: result.rowCount };
  }

  async update(args: TTypes["update"]): Promise<T> {
    const statement = buildUpdate(this.meta, args as UpdateArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new RecordNotFoundError(
        `update on '${this.meta.modelName}' returned no row.`,
      );
    }
    return row;
  }

  async updateMany(args: TTypes["updateMany"]): Promise<{ count: number }> {
    const statement = buildUpdateMany(this.meta, args as UpdateManyArgs, this.dialect);
    const result = await this.driver.query(statement.sql, [...statement.params]);
    return { count: result.rowCount };
  }

  async delete(args: TTypes["delete"]): Promise<T> {
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

        const statement = buildDelete(this.meta, args as DeleteArgs, this.dialect);
        const result = await executor.query<T>(
          statement.sql,
          [...statement.params],
        );
        const row = result.rows[0];
        if (row === undefined) {
          throw new RecordNotFoundError(
            `No active record found for delete on '${this.meta.modelName}'.`,
          );
        }
        return row;
      });
    }

    const statement = buildDelete(this.meta, args as DeleteArgs, this.dialect);
    const result = await this.driver.query<T>(
      statement.sql,
      [...statement.params],
    );
    const row = result.rows[0];
    if (row === undefined) {
      throw new RecordNotFoundError(
        `No active record found for delete on '${this.meta.modelName}'.`,
      );
    }
    return row;
  }

  async deleteMany(
    args: TTypes["deleteMany"] = {} as TTypes["deleteMany"],
  ): Promise<{ count: number }> {
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

        const statement = buildDeleteMany(this.meta, args as DeleteManyArgs, this.dialect);
        const result = await executor.query(statement.sql, [
          ...statement.params,
        ]);
        return { count: result.rowCount };
      });
    }

    const statement = buildDeleteMany(this.meta, args as DeleteManyArgs, this.dialect);
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
      throw new RecordNotFoundError(
        `No deleted record found for restore on '${this.meta.modelName}'.`,
      );
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
