import { describe, expect, it } from "vitest";
import type { ModelMeta } from "./meta.js";
import { applyAutomaticTimestamps } from "./data.js";
import { buildCreate, buildUpdate } from "./write.js";

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
      "updatedAt",
      {
        name: "updatedAt",
        columnName: "updatedAt",
        scalarKind: "DateTime",
        isRelation: false,
        isId: false,
        isUnique: false,
        isList: false,
        isUpdatedAt: true,
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

describe("applyAutomaticTimestamps", () => {
  const user = createUserMeta();

  it("adds updatedAt on create when omitted", () => {
    const data = applyAutomaticTimestamps(user, { id: "u1", email: "a@x.com" }, "create");
    expect(data.updatedAt).toBeInstanceOf(Date);
  });

  it("preserves explicit updatedAt on create", () => {
    const explicit = new Date("2020-01-01T00:00:00.000Z");
    const data = applyAutomaticTimestamps(
      user,
      { id: "u1", email: "a@x.com", updatedAt: explicit },
      "create",
    );
    expect(data.updatedAt).toBe(explicit);
  });

  it("always refreshes updatedAt on update", () => {
    const explicit = new Date("2020-01-01T00:00:00.000Z");
    const data = applyAutomaticTimestamps(user, { email: "b@x.com", updatedAt: explicit }, "update");
    expect(data.updatedAt).toBeInstanceOf(Date);
    expect(data.updatedAt).not.toBe(explicit);
  });
});

describe("@updatedAt SQL generation", () => {
  const user = createUserMeta();

  it("includes updatedAt in create SQL when omitted from input", () => {
    const stmt = buildCreate(user, {
      data: { id: "u1", email: "a@x.com" },
    });

    expect(stmt.sql).toContain('"updatedAt"');
    expect(stmt.params).toHaveLength(3);
    expect(stmt.params[2]).toBeInstanceOf(Date);
  });

  it("includes updatedAt in update SQL even when omitted from input", () => {
    const stmt = buildUpdate(user, {
      where: { id: "u1" },
      data: { email: "b@x.com" },
    });

    expect(stmt.sql).toContain('"updatedAt"');
    expect(stmt.params.some((value) => value instanceof Date)).toBe(true);
  });
});
