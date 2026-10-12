import { describe, expect, it } from "vitest";
import type { ModelMeta } from "./meta.js";
import {
  buildCreate,
  buildCreateMany,
  buildDelete,
  buildDeleteMany,
  buildUpdate,
  buildUpdateMany,
  QueryError,
} from "./index.js";

function createUserMeta(): ModelMeta {
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
      "age",
      {
        name: "age",
        columnName: "age",
        scalarKind: "Int",
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

  return {
    modelName: "User",
    tableName: "User",
    fields,
    idFields: ["id"],
    relations: new Map(),
  };
}

describe("@zed-orm/query-builder write", () => {
  const user = createUserMeta();

  it("buildCreate inserts scalar fields with RETURNING", () => {
    const stmt = buildCreate(user, {
      data: { id: "u1", email: "a@x.com", age: 30 },
    });

    expect(stmt.sql).toBe(
      'INSERT INTO "User" ("age", "email", "id") VALUES ($1, $2, $3) RETURNING "id", "email", "age"',
    );
    expect(stmt.params).toEqual([30, "a@x.com", "u1"]);
  });

  it("buildCreate supports select", () => {
    const stmt = buildCreate(user, {
      data: { id: "u1", email: "a@x.com" },
      select: { id: true },
    });

    expect(stmt.sql).toBe(
      'INSERT INTO "User" ("email", "id") VALUES ($1, $2) RETURNING "id"',
    );
  });

  it("buildCreate rejects relation fields", () => {
    expect(() =>
      buildCreate(user, { data: { id: "u1", posts: null } }),
    ).toThrow(/relation field/);
  });

  it("buildCreateMany inserts multiple rows", () => {
    const stmt = buildCreateMany(user, {
      data: [
        { id: "u1", email: "a@x.com" },
        { id: "u2", email: "b@x.com" },
      ],
    });

    expect(stmt.sql).toBe(
      'INSERT INTO "User" ("email", "id") VALUES ($1, $2), ($3, $4) RETURNING "id", "email", "age"',
    );
    expect(stmt.params).toEqual(["a@x.com", "u1", "b@x.com", "u2"]);
  });

  it("buildUpdate requires unique where and returns rows", () => {
    const stmt = buildUpdate(user, {
      where: { id: "u1" },
      data: { email: "new@x.com" },
    });

    expect(stmt.sql).toBe(
      'UPDATE "User" SET "email" = $1 WHERE "id" = $2 RETURNING "id", "email", "age"',
    );
    expect(stmt.params).toEqual(["new@x.com", "u1"]);
  });

  it("buildUpdateMany supports optional where", () => {
    const stmt = buildUpdateMany(user, {
      where: { age: { gte: 18 } },
      data: { age: 21 },
    });

    expect(stmt.sql).toBe(
      'UPDATE "User" SET "age" = $1 WHERE "age" >= $2',
    );
    expect(stmt.params).toEqual([21, 18]);
  });

  it("buildDelete requires unique where", () => {
    expect(() => buildDelete(user, { where: { age: 30 } })).toThrow(QueryError);

    const stmt = buildDelete(user, { where: { id: "u1" } });
    expect(stmt.sql).toBe(
      'DELETE FROM "User" WHERE "id" = $1 RETURNING "id", "email", "age"',
    );
    expect(stmt.params).toEqual(["u1"]);
  });

  it("buildDeleteMany supports optional where", () => {
    const stmt = buildDeleteMany(user, {
      where: { age: { lt: 18 } },
    });

    expect(stmt.sql).toBe('DELETE FROM "User" WHERE "age" < $1');
    expect(stmt.params).toEqual([18]);
  });

  it("buildCreate uses MySQL placeholders and quoting", () => {
    const stmt = buildCreate(
      user,
      { data: { id: "u1", email: "a@x.com", age: 30 } },
      "mysql",
    );

    expect(stmt.sql).toBe(
      "INSERT INTO `User` (`age`, `email`, `id`) VALUES (?, ?, ?) RETURNING `id`, `email`, `age`",
    );
    expect(stmt.params).toEqual([30, "a@x.com", "u1"]);
  });
});
