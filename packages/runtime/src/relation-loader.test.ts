import { describe, expect, it, vi } from "vitest";
import type { ModelMeta } from "@zed-orm/query-builder";
import { attachIncludes } from "./relation-loader.js";
import type { DatabaseDriver, QueryResult } from "./index.js";

function createMetas(): Record<string, ModelMeta> {
  const userFields = new Map([
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

  const postFields = new Map([
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

  return {
    User: {
      modelName: "User",
      tableName: "User",
      fields: userFields,
      idFields: ["id"],
      relations: new Map([
        [
          "posts",
          {
            fieldName: "posts",
            relatedModel: "Post",
            kind: "oneToMany",
            localFkFields: ["authorId"],
            foreignKeyFields: ["id"],
            reverseFieldName: "author",
          },
        ],
      ]),
    },
    Post: {
      modelName: "Post",
      tableName: "Post",
      fields: postFields,
      idFields: ["id"],
      relations: new Map([
        [
          "author",
          {
            fieldName: "author",
            relatedModel: "User",
            kind: "manyToOne",
            localFkFields: ["authorId"],
            foreignKeyFields: ["id"],
            reverseFieldName: "posts",
          },
        ],
      ]),
    },
  };
}

function createDriver(
  handler: (sql: string, params?: unknown[]) => QueryResult<Record<string, unknown>>,
): DatabaseDriver {
  return {
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
    transaction: vi.fn(),
    query: vi.fn(async (sql, params) => handler(sql, params)),
  };
}

describe("attachIncludes", () => {
  it("batch-loads one-to-many relations", async () => {
    const metas = createMetas();
    const users = [{ id: "u1", email: "a@x.com" }];

    const driver = createDriver((sql) => {
      expect(sql).toContain('FROM "Post"');
      expect(sql).toContain('"authorId" IN');
      return {
        rowCount: 1,
        rows: [{ id: "p1", title: "Hello", authorId: "u1" }],
      };
    });

    await attachIncludes(driver, metas, metas.User, users, { posts: true });

    expect(users[0]?.posts).toEqual([
      { id: "p1", title: "Hello", authorId: "u1" },
    ]);
    expect(driver.query).toHaveBeenCalledTimes(1);
  });

  it("batch-loads many-to-one relations", async () => {
    const metas = createMetas();
    const posts = [{ id: "p1", title: "Hello", authorId: "u1" }];

    const driver = createDriver((sql) => {
      expect(sql).toContain('FROM "User"');
      expect(sql).toContain('"id" IN');
      return {
        rowCount: 1,
        rows: [{ id: "u1", email: "a@x.com" }],
      };
    });

    await attachIncludes(driver, metas, metas.Post, posts, { author: true });

    expect(posts[0]?.author).toEqual({ id: "u1", email: "a@x.com" });
    expect(driver.query).toHaveBeenCalledTimes(1);
  });
});
