import { describe, expect, it, vi } from "vitest";
import type { ModelMeta } from "@zed-orm/query-builder";
import type { DatabaseDriver, QueryResult, TransactionContext } from "./index.js";
import { ModelDelegate } from "./model-delegate.js";
import { withTransaction } from "./transaction-scope.js";

const userMeta: ModelMeta = {
  modelName: "User",
  tableName: "User",
  fields: [
    { name: "id", columnName: "id", type: "String", isId: true, isUnique: true },
    { name: "email", columnName: "email", type: "String", isId: false, isUnique: true },
  ],
  relations: [],
};

const modelMetas = { User: userMeta };

function createMockDriver(): DatabaseDriver & {
  readonly queries: string[];
} {
  const queries: string[] = [];

  const driver: DatabaseDriver = {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    query: vi.fn(async (sql) => {
      queries.push(sql);
      return { rows: [], rowCount: 0 } satisfies QueryResult;
    }),
    transaction: vi.fn(async (callback) => {
      const tx: TransactionContext = {
        query: vi.fn(async (sql) => {
          queries.push(sql);
          return { rows: [], rowCount: 0 } satisfies QueryResult;
        }),
        transaction: vi.fn(async (nestedCallback) => {
          queries.push("SAVEPOINT zed_sp_1");
          try {
            const value = await nestedCallback(tx);
            queries.push("RELEASE SAVEPOINT zed_sp_1");
            return value;
          } catch (error) {
            queries.push("ROLLBACK TO SAVEPOINT zed_sp_1");
            throw error;
          }
        }),
      };
      return callback(tx);
    }),
  };

  return Object.assign(driver, { queries });
}

describe("withTransaction", () => {
  it("runs callback with transaction-scoped delegates", async () => {
    const driver = createMockDriver();
    const { $transaction } = withTransaction(driver, (executor) => ({
      user: new ModelDelegate(executor, userMeta, modelMetas),
    }));

    await $transaction(async (tx) => {
      await tx.user.findMany();
    });

    expect(driver.transaction).toHaveBeenCalledOnce();
    expect(driver.queries.some((sql) => sql.includes("FROM"))).toBe(true);
  });

  it("supports nested $transaction via savepoints", async () => {
    const driver = createMockDriver();
    const { $transaction } = withTransaction(driver, (executor) => ({
      user: new ModelDelegate(executor, userMeta, modelMetas),
    }));

    await $transaction(async (tx) => {
      await tx.$transaction(async () => undefined);
    });

    expect(driver.queries).toContain("SAVEPOINT zed_sp_1");
    expect(driver.queries).toContain("RELEASE SAVEPOINT zed_sp_1");
  });

  it("propagates callback errors", async () => {
    const driver = createMockDriver();
    const { $transaction } = withTransaction(driver, (executor) => ({
      user: new ModelDelegate(executor, userMeta, modelMetas),
    }));

    await expect(
      $transaction(async () => {
        throw new Error("tx failed");
      }),
    ).rejects.toThrow("tx failed");
  });
});
