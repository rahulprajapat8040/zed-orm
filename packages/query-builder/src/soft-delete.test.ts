import { describe, expect, it } from "vitest";
import type { ModelMeta } from "./meta.js";
import {
  buildDelete,
  buildDeleteMany,
  buildFindMany,
  buildRestore,
  buildRestoreMany,
  QueryError,
} from "./index.js";

function createSoftUserMeta(): ModelMeta {
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
  ]);

  return {
    modelName: "User",
    tableName: "User",
    fields,
    idFields: ["id"],
    relations: new Map(),
    softDelete: true,
    deletedAtField: "deletedAt",
  };
}

describe("@zed-orm/query-builder soft delete", () => {
  const user = createSoftUserMeta();
  const deletedAt = new Date("2026-01-01T00:00:00.000Z");

  it("filters active rows by default on reads", () => {
    const stmt = buildFindMany(user, {});
    expect(stmt.sql).toBe(
      'SELECT "id", "email", "deletedAt" FROM "User" WHERE "deletedAt" IS NULL',
    );
  });

  it("supports withDeleted and onlyDeleted read modes", () => {
    const withDeleted = buildFindMany(user, { withDeleted: true });
    expect(withDeleted.sql).toBe(
      'SELECT "id", "email", "deletedAt" FROM "User"',
    );

    const onlyDeleted = buildFindMany(user, { onlyDeleted: true });
    expect(onlyDeleted.sql).toBe(
      'SELECT "id", "email", "deletedAt" FROM "User" WHERE "deletedAt" IS NOT NULL',
    );
  });

  it("rejects withDeleted and onlyDeleted together", () => {
    expect(() =>
      buildFindMany(user, { withDeleted: true, onlyDeleted: true }),
    ).toThrow(QueryError);
  });

  it("soft-deletes rows instead of hard deleting", () => {
    const stmt = buildDelete(user, {
      where: { id: "u1" },
      deletedAt,
    });

    expect(stmt.sql).toBe(
      'UPDATE "User" SET "deletedAt" = $1 WHERE ("deletedAt" IS NULL) AND ("id" = $2) RETURNING "id", "email", "deletedAt"',
    );
    expect(stmt.params).toEqual([deletedAt, "u1"]);
  });

  it("soft-deletes many rows with active-row guard", () => {
    const stmt = buildDeleteMany(user, {
      where: { email: "a@x.com" },
      deletedAt,
    });

    expect(stmt.sql).toBe(
      'UPDATE "User" SET "deletedAt" = $1 WHERE ("deletedAt" IS NULL) AND ("email" = $2)',
    );
    expect(stmt.params).toEqual([deletedAt, "a@x.com"]);
  });

  it("restores soft-deleted rows", () => {
    const stmt = buildRestore(user, { where: { id: "u1" } });
    expect(stmt.sql).toBe(
      'UPDATE "User" SET "deletedAt" = NULL WHERE ("deletedAt" IS NOT NULL) AND ("id" = $1) RETURNING "id", "email", "deletedAt"',
    );
    expect(stmt.params).toEqual(["u1"]);
  });

  it("restoreMany clears deletedAt for matching rows", () => {
    const stmt = buildRestoreMany(user, {});
    expect(stmt.sql).toBe(
      'UPDATE "User" SET "deletedAt" = NULL WHERE "deletedAt" IS NOT NULL',
    );
  });
});
