import { bench, describe, vi } from "vitest";
import type { ModelMeta, RelationMeta } from "@zed-orm/query-builder";
import type { QueryExecutor } from "@zed-orm/runtime";
import { applyRelationalSoftDelete } from "@zed-orm/runtime";

function createMeta(
  modelName: string,
  relations: ReadonlyMap<string, RelationMeta> = new Map(),
): ModelMeta {
  return {
    modelName,
    tableName: modelName,
    softDelete: true,
    deletedAtField: "deletedAt",
    idFields: ["id"],
    fields: new Map([
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
    ]),
    relations,
  };
}

const postRelations = new Map<string, RelationMeta>([
  [
    "author",
    {
      fieldName: "author",
      relatedModel: "User",
      kind: "manyToOne",
      localFkFields: ["authorId"],
      foreignKeyFields: ["id"],
      onSoftDelete: "Cascade",
    },
  ],
]);

const modelMetas = {
  User: createMeta("User"),
  Post: createMeta("Post", postRelations),
};

const executor: QueryExecutor = {
  query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
};

describe("soft-delete propagation", () => {
  bench("applyRelationalSoftDelete (cascade planning)", async () => {
    await applyRelationalSoftDelete(
      executor,
      modelMetas,
      "User",
      ["u1", "u2", "u3"],
      "postgresql",
    );
  });
});
