import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import type { ModelMeta } from "@zed-orm/query-builder";
import {
  ModelDelegate,
  type QueryExecutor,
  withTransaction,
} from "@zed-orm/runtime";
import { modelMetas as fixtureMetas } from "../packages/generator/test/fixtures/simple/meta.js";

const databaseUrl = process.env["DATABASE_URL"];

function withTableName(meta: ModelMeta, tableName: string): ModelMeta {
  return { ...meta, tableName };
}

describe.skipIf(databaseUrl === undefined)("Transactions integration", () => {
  const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
  const suffix = Date.now().toString();
  const userTable = `zed_tx_user_${suffix}`;
  const postTable = `zed_tx_post_${suffix}`;

  const modelMetas = {
    User: withTableName(fixtureMetas["User"], userTable),
    Post: withTableName(fixtureMetas["Post"], postTable),
  };

  const createDelegates = (executor: QueryExecutor) => ({
    user: new ModelDelegate(executor, modelMetas.User, modelMetas),
    post: new ModelDelegate(executor, modelMetas.Post, modelMetas),
  });

  const { $transaction } = withTransaction(driver, createDelegates);
  const user = createDelegates(driver).user;

  beforeAll(async () => {
    await driver.connect();
    await driver.query(`
      CREATE TABLE "${userTable}" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        role TEXT NOT NULL
      )
    `);
    await driver.query(`
      CREATE TABLE "${postTable}" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "${userTable}" (id)
      )
    `);
  });

  afterAll(async () => {
    await driver.query(`DROP TABLE IF EXISTS "${postTable}"`);
    await driver.query(`DROP TABLE IF EXISTS "${userTable}"`);
    await driver.disconnect();
  });

  it("commits successful transactions", async () => {
    await $transaction(async (tx) => {
      await tx.user.create({
        data: { id: "u-tx-1", email: "tx@example.com", role: "USER" },
      });
    });

    const found = await user.findUnique({ where: { id: "u-tx-1" } });
    expect(found?.email).toBe("tx@example.com");

    await user.delete({ where: { id: "u-tx-1" } });
  });

  it("rolls back failed transactions", async () => {
    await expect(
      $transaction(async (tx) => {
        await tx.user.create({
          data: { id: "u-tx-2", email: "rollback@example.com", role: "USER" },
        });
        throw new Error("force rollback");
      }),
    ).rejects.toThrow("force rollback");

    const found = await user.findUnique({ where: { id: "u-tx-2" } });
    expect(found).toBeNull();
  });

  it("runs CRUD and includes inside a transaction", async () => {
    await $transaction(async (tx) => {
      await tx.user.create({
        data: { id: "u-tx-3", email: "crud@example.com", role: "USER" },
      });
      await tx.post.create({
        data: {
          id: "p-tx-1",
          title: "In transaction",
          authorId: "u-tx-3",
        },
      });

      const withPosts = await tx.user.findUnique({
        where: { id: "u-tx-3" },
        include: { posts: true },
      });
      expect(withPosts?.posts).toHaveLength(1);
    });

    await user.deleteMany();
  });

  it("rolls back nested transactions without affecting the outer commit", async () => {
    await $transaction(async (tx) => {
      await tx.user.create({
        data: { id: "u-tx-4", email: "outer@example.com", role: "USER" },
      });

      await expect(
        tx.$transaction(async (nested) => {
          await nested.user.create({
            data: { id: "u-tx-5", email: "inner@example.com", role: "USER" },
          });
          throw new Error("nested rollback");
        }),
      ).rejects.toThrow("nested rollback");
    });

    expect(await user.findUnique({ where: { id: "u-tx-4" } })).not.toBeNull();
    expect(await user.findUnique({ where: { id: "u-tx-5" } })).toBeNull();

    await user.deleteMany();
  });

  it("commits nested transactions", async () => {
    await $transaction(async (tx) => {
      await tx.user.create({
        data: { id: "u-tx-6", email: "nested-ok@example.com", role: "USER" },
      });

      await tx.$transaction(async (nested) => {
        await nested.user.update({
          where: { id: "u-tx-6" },
          data: { role: "ADMIN" },
        });
      });
    });

    const found = await user.findUnique({ where: { id: "u-tx-6" } });
    expect(found?.role).toBe("ADMIN");

    await user.delete({ where: { id: "u-tx-6" } });
  });
});
