import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPostgresDriver } from "@zed-orm/driver-postgres";
import type { ModelMeta, RelationMeta } from "@zed-orm/query-builder";
import { ModelDelegate, SoftDeleteError } from "@zed-orm/runtime";

const databaseUrl = process.env["DATABASE_URL"];

function withTableName(meta: ModelMeta, tableName: string): ModelMeta {
  return { ...meta, tableName };
}

function createUserMeta(tableName: string): ModelMeta {
  const fields = new Map([
    [
      "id",
      {
        name: "id",
        columnName: "id",
        scalarKind: "String",
        isRelation: false,
        isId: true,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "email",
      {
        name: "email",
        columnName: "email",
        scalarKind: "String",
        isRelation: false,
        isId: false,
        isUnique: true,
        isList: false,
      },
    ],
    [
      "deletedAt",
      {
        name: "deletedAt",
        columnName: "deletedAt",
        scalarKind: "DateTime",
        isRelation: false,
        isId: false,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "posts",
      {
        name: "posts",
        columnName: "posts",
        isRelation: true,
        isId: false,
        isUnique: false,
        isList: true,
      },
    ],
  ]);

  const relations = new Map<string, RelationMeta>([
    [
      "posts",
      {
        fieldName: "posts",
        relatedModel: "Post",
        kind: "oneToMany",
        localFkFields: ["authorId"],
        foreignKeyFields: ["id"],
        onSoftDelete: "Cascade",
        reverseFieldName: "author",
      },
    ],
  ]);

  return {
    modelName: "User",
    tableName,
    fields,
    idFields: ["id"],
    relations,
    softDelete: true,
    deletedAtField: "deletedAt",
  };
}

function createPostMeta(tableName: string, onSoftDelete: "Cascade" | "Restrict"): ModelMeta {
  const fields = new Map([
    [
      "id",
      {
        name: "id",
        columnName: "id",
        scalarKind: "String",
        isRelation: false,
        isId: true,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "title",
      {
        name: "title",
        columnName: "title",
        scalarKind: "String",
        isRelation: false,
        isId: false,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "authorId",
      {
        name: "authorId",
        columnName: "authorId",
        scalarKind: "String",
        isRelation: false,
        isId: false,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "deletedAt",
      {
        name: "deletedAt",
        columnName: "deletedAt",
        scalarKind: "DateTime",
        isRelation: false,
        isId: false,
        isUnique: false,
        isList: false,
      },
    ],
    [
      "author",
      {
        name: "author",
        columnName: "author",
        isRelation: true,
        isId: false,
        isUnique: false,
        isList: false,
      },
    ],
  ]);

  const relations = new Map<string, RelationMeta>([
    [
      "author",
      {
        fieldName: "author",
        relatedModel: "User",
        kind: "manyToOne",
        localFkFields: ["authorId"],
        foreignKeyFields: ["id"],
        onSoftDelete,
        reverseFieldName: "posts",
      },
    ],
  ]);

  return {
    modelName: "Post",
    tableName,
    fields,
    idFields: ["id"],
    relations,
    softDelete: true,
    deletedAtField: "deletedAt",
  };
}

describe.skipIf(databaseUrl === undefined)("soft delete integration", () => {
  const driver = createPostgresDriver({ databaseUrl: databaseUrl! });
  const suffix = Date.now().toString();
  const userTable = `zed_soft_user_${suffix}`;
  const postTable = `zed_soft_post_${suffix}`;

  const modelMetas = {
    User: createUserMeta(userTable),
    Post: createPostMeta(postTable, "Cascade"),
  };

  const runInTransaction = <T>(
    callback: (executor: typeof driver) => Promise<T>,
  ): Promise<T> => driver.transaction((tx) => callback(tx));

  const user = new ModelDelegate(
    driver,
    modelMetas.User,
    modelMetas,
    "postgresql",
    runInTransaction,
  );
  const post = new ModelDelegate(driver, modelMetas.Post, modelMetas);

  beforeAll(async () => {
    await driver.connect();
    await driver.query(`
      CREATE TABLE "${userTable}" (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        "deletedAt" TIMESTAMPTZ
      )
    `);
    await driver.query(`
      CREATE TABLE "${postTable}" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "${userTable}" (id),
        "deletedAt" TIMESTAMPTZ
      )
    `);
  });

  afterAll(async () => {
    await driver.query(`DROP TABLE IF EXISTS "${postTable}"`);
    await driver.query(`DROP TABLE IF EXISTS "${userTable}"`);
    await driver.disconnect();
  });

  it("soft-deletes rows and hides them from default reads", async () => {
    const deletedAt = new Date("2026-01-15T00:00:00.000Z");

    await user.create({
      data: { id: "u1", email: "alice@example.com" },
    });

    const deleted = await user.delete({
      where: { id: "u1" },
      deletedAt,
    });
    expect(deleted.deletedAt).toEqual(deletedAt);

    const active = await user.findMany();
    expect(active).toHaveLength(0);

    const withDeleted = await user.findMany({ withDeleted: true });
    expect(withDeleted).toHaveLength(1);

    const onlyDeleted = await user.findMany({ onlyDeleted: true });
    expect(onlyDeleted).toHaveLength(1);
    expect(onlyDeleted[0]?.id).toBe("u1");
  });

  it("restores soft-deleted rows without restoring dependents", async () => {
    await user.create({
      data: { id: "u2", email: "bob@example.com" },
    });
    await post.create({
      data: { id: "p1", title: "Hello", authorId: "u2" },
    });

    await user.delete({ where: { id: "u2" } });

    const restored = await user.restore({ where: { id: "u2" } });
    expect(restored.deletedAt).toBeNull();

    const posts = await post.findMany({ where: { authorId: "u2" } });
    expect(posts).toHaveLength(0);
  });

  it("cascades soft-delete to dependents", async () => {
    await user.create({
      data: { id: "u3", email: "cascade@example.com" },
    });
    await post.createMany({
      data: [
        { id: "p2", title: "A", authorId: "u3" },
        { id: "p3", title: "B", authorId: "u3" },
      ],
    });

    await user.delete({ where: { id: "u3" } });

    const deletedPosts = await post.findMany({
      where: { authorId: "u3" },
      withDeleted: true,
    });
    expect(deletedPosts).toHaveLength(2);
    expect(deletedPosts.every((row) => row.deletedAt !== null)).toBe(true);
  });

  it("blocks delete when onSoftDelete is Restrict", async () => {
    const restrictPostTable = `zed_soft_post_restrict_${suffix}`;
    const restrictMetas = {
      User: modelMetas.User,
      Post: withTableName(
        createPostMeta(restrictPostTable, "Restrict"),
        restrictPostTable,
      ),
    };
    const restrictUser = new ModelDelegate(
      driver,
      restrictMetas.User,
      restrictMetas,
      "postgresql",
      runInTransaction,
    );
    const restrictPost = new ModelDelegate(
      driver,
      restrictMetas.Post,
      restrictMetas,
    );

    await driver.query(`
      CREATE TABLE "${restrictPostTable}" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        "authorId" TEXT NOT NULL REFERENCES "${userTable}" (id),
        "deletedAt" TIMESTAMPTZ
      )
    `);

    await restrictUser.create({
      data: { id: "u4", email: "restrict@example.com" },
    });
    await restrictPost.create({
      data: { id: "p4", title: "Blocked", authorId: "u4" },
    });

    await expect(
      restrictUser.delete({ where: { id: "u4" } }),
    ).rejects.toThrow(SoftDeleteError);

    await driver.query(`DROP TABLE IF EXISTS "${restrictPostTable}"`);
  });
});
