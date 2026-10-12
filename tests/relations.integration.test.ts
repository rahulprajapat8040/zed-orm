import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import type { ModelMeta } from "@zed-orm/query-builder";
import { ModelDelegate } from "@zed-orm/runtime";
import { modelMetas as fixtureMetas } from "../packages/generator/test/fixtures/simple/meta.js";

const databaseUrl = process.env["DATABASE_URL"];

function withTableName(meta: ModelMeta, tableName: string): ModelMeta {
  return { ...meta, tableName };
}

describe.skipIf(databaseUrl === undefined)("relations integration", () => {
  const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
  const suffix = Date.now().toString();
  const userTable = `zed_rel_user_${suffix}`;
  const postTable = `zed_rel_post_${suffix}`;

  const modelMetas = {
    User: withTableName(fixtureMetas["User"], userTable),
    Post: withTableName(fixtureMetas["Post"], postTable),
  };

  const user = new ModelDelegate(driver, modelMetas.User, modelMetas);
  const post = new ModelDelegate(driver, modelMetas.Post, modelMetas);

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

    await user.create({
      data: { id: "u1", email: "alice@example.com", role: "USER" },
    });
    await post.createMany({
      data: [
        { id: "p1", title: "First", authorId: "u1" },
        { id: "p2", title: "Second", authorId: "u1" },
      ],
    });
  });

  afterAll(async () => {
    await driver.query(`DROP TABLE IF EXISTS "${postTable}"`);
    await driver.query(`DROP TABLE IF EXISTS "${userTable}"`);
    await driver.disconnect();
  });

  it("loads one-to-many with a single batched query", async () => {
    const querySpy = vi.spyOn(driver, "query");

    const users = await user.findMany({
      where: { id: "u1" },
      include: { posts: true },
    });

    expect(users[0]?.posts).toHaveLength(2);
    expect(querySpy).toHaveBeenCalledTimes(2);

    querySpy.mockRestore();
  });

  it("loads many-to-one with a single batched query", async () => {
    const querySpy = vi.spyOn(driver, "query");

    const posts = await post.findMany({
      include: { author: true },
    });

    expect(posts).toHaveLength(2);
    expect(posts[0]?.author?.email).toBe("alice@example.com");
    expect(querySpy).toHaveBeenCalledTimes(2);

    querySpy.mockRestore();
  });
});
