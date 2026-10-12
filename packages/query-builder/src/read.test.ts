import { describe, expect, it } from "vitest";
import type { ModelMeta } from "./meta.js";
import {
  buildFindFirst,
  buildFindMany,
  buildFindUnique,
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

describe("@zed-orm/query-builder", () => {
  const user = createUserMeta();

  it("buildFindMany selects scalar fields by default", () => {
    const stmt = buildFindMany(user, {});
    expect(stmt.sql).toBe('SELECT "id", "email", "age" FROM "User"');
    expect(stmt.params).toEqual([]);
  });

  it("buildFindMany supports where, orderBy, take, and skip", () => {
    const stmt = buildFindMany(user, {
      where: { email: "alice@example.com" },
      orderBy: { age: "desc" },
      take: 10,
      skip: 5,
    });

    expect(stmt.sql).toBe(
      'SELECT "id", "email", "age" FROM "User" WHERE "email" = $1 ORDER BY "age" DESC LIMIT $2 OFFSET $3',
    );
    expect(stmt.params).toEqual(["alice@example.com", 10, 5]);
  });

  it("buildFindMany supports filter operators and select", () => {
    const stmt = buildFindMany(user, {
      where: {
        age: { gte: 18, lte: 65 },
        email: { in: ["a@x.com", "b@x.com"] },
      },
      select: { id: true, email: true },
    });

    expect(stmt.sql).toBe(
      'SELECT "id", "email" FROM "User" WHERE (("age" <= $1 AND "age" >= $2)) AND ("email" IN ($3, $4))',
    );
    expect(stmt.params).toEqual([65, 18, "a@x.com", "b@x.com"]);
  });

  it("buildFindFirst applies LIMIT 1", () => {
    const stmt = buildFindFirst(user, {
      where: { age: { gt: 21 } },
      orderBy: [{ email: "asc" }],
    });

    expect(stmt.sql).toBe(
      'SELECT "id", "email", "age" FROM "User" WHERE "age" > $1 ORDER BY "email" ASC LIMIT $2',
    );
    expect(stmt.params).toEqual([21, 1]);
  });

  it("buildFindUnique requires a unique field", () => {
    expect(() =>
      buildFindUnique(user, { where: { age: 30 } }),
    ).toThrow(QueryError);
  });

  it("buildFindUnique accepts id or unique fields", () => {
    const byId = buildFindUnique(user, { where: { id: "u1" } });
    expect(byId.sql).toBe(
      'SELECT "id", "email", "age" FROM "User" WHERE "id" = $1 LIMIT $2',
    );
    expect(byId.params).toEqual(["u1", 1]);

    const byEmail = buildFindUnique(user, {
      where: { email: "alice@example.com" },
    });
    expect(byEmail.sql).toBe(
      'SELECT "id", "email", "age" FROM "User" WHERE "email" = $1 LIMIT $2',
    );
  });

  it("rejects relation filters and selects", () => {
    expect(() =>
      buildFindMany(user, { where: { posts: "x" } }),
    ).toThrow(/relation field/);
    expect(() =>
      buildFindMany(user, { select: { posts: true } }),
    ).toThrow(/relation field/);
  });
});
