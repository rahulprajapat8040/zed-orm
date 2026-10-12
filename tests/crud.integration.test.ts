import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import type { ModelMeta } from "@zed-orm/query-builder";
import { ModelDelegate } from "@zed-orm/runtime";
import { modelMetas as fixtureMetas } from "../packages/generator/test/fixtures/simple/meta.js";

const databaseUrl = process.env["DATABASE_URL"];

function withTableName(meta: ModelMeta, tableName: string): ModelMeta {
  return { ...meta, tableName };
}

describe.skipIf(databaseUrl === undefined)("CRUD integration", () => {
  const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
  const suffix = Date.now().toString();
  const userTable = `zed_crud_user_${suffix}`;
  const postTable = `zed_crud_post_${suffix}`;

  const modelMetas = {
    User: withTableName(fixtureMetas["User"], userTable),
    Post: withTableName(fixtureMetas["Post"], postTable),
  };

  const user = new ModelDelegate(driver, modelMetas.User, modelMetas);

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

  it("performs create / read / update / delete round-trips", async () => {
    const created = await user.create({
      data: { id: "u1", email: "alice@example.com", role: "USER" },
    });
    expect(created.email).toBe("alice@example.com");

    const found = await user.findUnique({
      where: { id: "u1" },
    });
    expect(found?.role).toBe("USER");

    const updated = await user.update({
      where: { id: "u1" },
      data: { role: "ADMIN" },
    });
    expect(updated.role).toBe("ADMIN");

    const many = await user.updateMany({
      where: { email: "alice@example.com" },
      data: { role: "USER" },
    });
    expect(many.count).toBe(1);

    const deleted = await user.delete({
      where: { id: "u1" },
    });
    expect(deleted.id).toBe("u1");

    const remaining = await user.findMany();
    expect(remaining).toHaveLength(0);
  });

  it("supports createMany and deleteMany", async () => {
    const created = await user.createMany({
      data: [
        { id: "u1", email: "a@x.com", role: "USER" },
        { id: "u2", email: "b@x.com", role: "ADMIN" },
      ],
    });
    expect(created.count).toBe(2);

    const removed = await user.deleteMany({
      where: { role: "USER" },
    });
    expect(removed.count).toBe(1);

    await user.deleteMany();
  });
});
