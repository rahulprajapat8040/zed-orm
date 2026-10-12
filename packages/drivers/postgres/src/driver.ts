import pg from "pg";
import type {
  DatabaseDriver,
  QueryResult,
  TransactionContext,
} from "@zed-orm/runtime";
import { ZedError } from "@zed-orm/shared";
import { DriverError } from "./errors.js";
import { mapPostgresError } from "./map-error.js";
import type { PostgresDriverOptions } from "./types.js";

type QueryExecutor = pg.Pool | pg.PoolClient;

function mapQueryResult<T>(result: pg.QueryResult): QueryResult<T> {
  return {
    rows: result.rows as T[],
    rowCount: result.rowCount ?? 0,
  };
}

async function runQuery<T>(
  executor: QueryExecutor,
  sql: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    const result = await executor.query(sql, params);
    return mapQueryResult<T>(result);
  } catch (cause) {
    throw mapPostgresError(cause, "PostgreSQL query failed.");
  }
}

class PostgresTransactionContext implements TransactionContext {
  private savepointCounter = 0;

  constructor(private readonly client: pg.PoolClient) {}

  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return runQuery<T>(this.client, sql, params);
  }

  async transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const savepoint = `zed_sp_${++this.savepointCounter}`;
    try {
      await this.client.query(`SAVEPOINT ${savepoint}`);
      const value = await callback(this);
      await this.client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return value;
    } catch (error) {
      try {
        await this.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } catch (rollbackCause) {
        throw new DriverError(
          "Nested transaction failed and savepoint rollback also failed.",
          { cause: rollbackCause },
        );
      }

      if (error instanceof ZedError) {
        throw error;
      }

      throw mapPostgresError(error, "Nested transaction failed.");
    }
  }
}

/**
 * PostgreSQL implementation of the Zed {@link DatabaseDriver} contract.
 */
export class PostgresDriver implements DatabaseDriver {
  private pool: pg.Pool | null = null;

  constructor(private readonly options: PostgresDriverOptions) {}

  async connect(): Promise<void> {
    if (this.pool !== null) {
      return;
    }

    try {
      const pool = new pg.Pool({
        connectionString: this.options.databaseUrl,
        max: this.options.max ?? 10,
        ...(this.options.connectionTimeoutMillis !== undefined
          ? { connectionTimeoutMillis: this.options.connectionTimeoutMillis }
          : {}),
        ...(this.options.idleTimeoutMillis !== undefined
          ? { idleTimeoutMillis: this.options.idleTimeoutMillis }
          : {}),
      });

      await runQuery(pool, "SELECT 1");
      this.pool = pool;
    } catch (cause) {
      this.pool = null;
      if (cause instanceof DriverError) {
        throw new DriverError("Failed to connect to PostgreSQL.", {
          cause: cause.cause,
        });
      }
      throw new DriverError("Failed to connect to PostgreSQL.", { cause });
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool === null) {
      return;
    }

    const pool = this.pool;
    this.pool = null;

    try {
      await pool.end();
    } catch (cause) {
      throw new DriverError("Failed to disconnect from PostgreSQL.", {
        cause,
      });
    }
  }

  private getPool(): pg.Pool {
    if (this.pool === null) {
      throw new DriverError(
        "Driver is not connected. Call connect() before querying.",
      );
    }
    return this.pool;
  }

  async query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return runQuery<T>(this.getPool(), sql, params);
  }

  async transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const pool = this.getPool();
    let client: pg.PoolClient | undefined;

    try {
      client = await pool.connect();
    } catch (cause) {
      throw new DriverError("Failed to acquire a PostgreSQL client.", {
        cause,
      });
    }

    try {
      await client.query("BEGIN");
      const value = await callback(new PostgresTransactionContext(client));
      await client.query("COMMIT");
      return value;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackCause) {
        throw new DriverError(
          "Transaction failed and rollback also failed.",
          { cause: rollbackCause },
        );
      }

      if (error instanceof ZedError) {
        throw error;
      }

      throw mapPostgresError(error, "Transaction failed.");
    } finally {
      client.release();
    }
  }
}

/** Create a PostgreSQL driver instance (call {@link PostgresDriver.connect} before use). */
export function createPostgresDriver(
  options: PostgresDriverOptions,
): PostgresDriver {
  return new PostgresDriver(options);
}
