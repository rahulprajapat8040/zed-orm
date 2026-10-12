import { describe, expect, it, vi } from "vitest";
import type { ModelMeta } from "@zed-orm/query-builder";
import { RecordNotFoundError } from "@zed-orm/shared";
import type { QueryExecutor } from "./index.js";
import { ModelDelegate } from "./model-delegate.js";

function createSoftDeleteUserMeta(): ModelMeta {
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

describe("ModelDelegate delete errors", () => {
  it("throws RecordNotFoundError when deleting an already soft-deleted row", async () => {
    const meta = createSoftDeleteUserMeta();
    const driver: QueryExecutor = {
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
    };
    const delegate = new ModelDelegate(driver, meta, { User: meta });

    await expect(
      delegate.delete({ where: { email: "missing@example.com" } }),
    ).rejects.toBeInstanceOf(RecordNotFoundError);
  });
});
