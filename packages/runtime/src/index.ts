/**
 * @zed-orm/runtime
 *
 * Connection lifecycle, query execution, and transactions.
 */

export const PACKAGE_NAME = "@zed-orm/runtime" as const;

export { ModelDelegate, ModelReadDelegate } from "./model-delegate.js";
export type { ModelDelegateTypes } from "./model-delegate-types.js";
export { attachIncludes } from "./relation-loader.js";
export { SoftDeleteError } from "./soft-delete-engine.js";
export {
  type DelegateMap,
  type TransactionCallback,
  type TransactionClient,
  withTransaction,
} from "./transaction-scope.js";

/** Driver-agnostic query result shape. */
export interface QueryResult<T = unknown> {
  readonly rows: readonly T[];
  readonly rowCount: number;
}

/** Minimal query execution surface shared by drivers and transaction contexts. */
export interface QueryExecutor {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

/** Transaction-scoped query surface with nested transactions via savepoints. */
export interface TransactionContext extends QueryExecutor {
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
}

/**
 * Database driver contract. Concrete drivers live in @zed-orm/driver-*.
 */
export interface DatabaseDriver extends QueryExecutor {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(callback: (tx: TransactionContext) => Promise<T>): Promise<T>;
}
