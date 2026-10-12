import type { ModelDelegate } from "./model-delegate.js";
import type { DatabaseDriver, QueryExecutor, TransactionContext } from "./index.js";

/** Client shape produced by binding model delegates to a query executor. */
export type DelegateMap = Readonly<Record<string, ModelDelegate>>;

/** Transaction callback receiving a client with model delegates and nested `$transaction`. */
export type TransactionCallback<TDelegates extends DelegateMap, TResult> = (
  tx: TransactionClient<TDelegates>,
) => Promise<TResult>;

/**
 * Transaction-scoped client: model delegates plus nested `$transaction` (savepoints).
 */
export type TransactionClient<TDelegates extends DelegateMap> = TDelegates & {
  $transaction<TResult>(
    callback: TransactionCallback<TDelegates, TResult>,
  ): Promise<TResult>;
};

function createTransactionClient<TDelegates extends DelegateMap>(
  tx: TransactionContext,
  createDelegates: (executor: QueryExecutor) => TDelegates,
): TransactionClient<TDelegates> {
  const delegates = createDelegates(tx);

  const client = {
    ...delegates,
    $transaction<TResult>(
      callback: TransactionCallback<TDelegates, TResult>,
    ): Promise<TResult> {
      return tx.transaction(async (nestedTx) =>
        callback(createTransactionClient(nestedTx, createDelegates)),
      );
    },
  };

  return client;
}

/**
 * Bind `$transaction` to a driver and delegate factory.
 * The factory is called with the active query executor (driver or transaction context).
 */
export function withTransaction<TDelegates extends DelegateMap>(
  driver: DatabaseDriver,
  createDelegates: (executor: QueryExecutor) => TDelegates,
): {
  $transaction<TResult>(
    callback: TransactionCallback<TDelegates, TResult>,
  ): Promise<TResult>;
} {
  return {
    $transaction<TResult>(
      callback: TransactionCallback<TDelegates, TResult>,
    ): Promise<TResult> {
      return driver.transaction(async (tx) =>
        callback(createTransactionClient(tx, createDelegates)),
      );
    },
  };
}
