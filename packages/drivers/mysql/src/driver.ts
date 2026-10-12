import mysql from "mysql2/promise";
import type {
  DatabaseDriver,
  QueryResult,
  TransactionContext,
} from "@zed-orm/runtime";
import { DriverError } from "./errors.js";
import type { MysqlDriverOptions } from "./types.js";

type QueryExecutor = mysql.Pool | mysql.PoolConnection;

async function runQuery<T>(
  executor: QueryExecutor,
  sql: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    const [result] = await executor.query(sql, params);
    if (Array.isArray(result)) {
      return {
        rows: result as T[],
        rowCount: result.length,
      };
    }

    const header = result as mysql.ResultSetHeader;
    return {
      rows: [],
      rowCount: header.affectedRows,
    };
  } catch (cause) {
    throw new DriverError("MySQL query failed.", { cause });
  }
}

class MysqlTransactionContext implements TransactionContext {
  private savepointCounter = 0;

  constructor(private readonly connection: mysql.PoolConnection) {}

  query<T = unknown>(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    return runQuery<T>(this.connection, sql, params);
  }

  async transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const savepoint = `zed_sp_${++this.savepointCounter}`;
    try {
      await this.connection.query(`SAVEPOINT ${savepoint}`);
      const value = await callback(this);
      await this.connection.query(`RELEASE SAVEPOINT ${savepoint}`);
      return value;
    } catch (error) {
      try {
        await this.connection.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      } catch (rollbackCause) {
        throw new DriverError(
          "Nested transaction failed and savepoint rollback also failed.",
          { cause: rollbackCause },
        );
      }

      if (error instanceof DriverError) {
        throw error;
      }

      throw new DriverError("Nested transaction failed.", { cause: error });
    }
  }
}

/**
 * MySQL implementation of the Zed {@link DatabaseDriver} contract.
 */
export class MysqlDriver implements DatabaseDriver {
  private pool: mysql.Pool | null = null;

  constructor(private readonly options: MysqlDriverOptions) {}

  async connect(): Promise<void> {
    if (this.pool !== null) {
      return;
    }

    try {
      const pool = mysql.createPool({
        uri: this.options.databaseUrl,
        connectionLimit: this.options.connectionLimit ?? 10,
        ...(this.options.connectTimeout !== undefined
          ? { connectTimeout: this.options.connectTimeout }
          : {}),
      });

      await runQuery<{ one: number }>(pool, "SELECT 1");
      this.pool = pool;
    } catch (cause) {
      this.pool = null;
      if (cause instanceof DriverError) {
        throw new DriverError("Failed to connect to MySQL.", {
          cause: cause.cause,
        });
      }
      throw new DriverError("Failed to connect to MySQL.", { cause });
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
      throw new DriverError("Failed to disconnect from MySQL.", { cause });
    }
  }

  private getPool(): mysql.Pool {
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
    let connection: mysql.PoolConnection | undefined;

    try {
      connection = await pool.getConnection();
    } catch (cause) {
      throw new DriverError("Failed to acquire a MySQL connection.", { cause });
    }

    try {
      await connection.beginTransaction();
      const value = await callback(new MysqlTransactionContext(connection));
      await connection.commit();
      return value;
    } catch (error) {
      try {
        await connection.rollback();
      } catch (rollbackCause) {
        throw new DriverError(
          "Transaction failed and rollback also failed.",
          { cause: rollbackCause },
        );
      }

      if (error instanceof DriverError) {
        throw error;
      }

      throw new DriverError("Transaction failed.", { cause: error });
    } finally {
      connection.release();
    }
  }
}

/** Create a MySQL driver instance (call {@link MysqlDriver.connect} before use). */
export function createMysqlDriver(options: MysqlDriverOptions): MysqlDriver {
  return new MysqlDriver(options);
}
