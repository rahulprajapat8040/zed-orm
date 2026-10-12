import { describe, expect, it, vi } from "vitest";
import type { ModelMeta, RelationMeta } from "@zed-orm/query-builder";
import type { QueryExecutor, QueryResult } from "./index.js";
import {
  applyRelationalSoftDelete,
  SoftDeleteError,
} from "./soft-delete-engine.js";

function createMeta(
  modelName: string,
  options?: {
    softDelete?: boolean;
    relations?: ReadonlyMap<string, RelationMeta>;
    extraFields?: ReadonlyMap<string, ModelMeta["fields"] extends ReadonlyMap<string, infer T> ? T : never>;
  },
): ModelMeta {
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
    ...(options?.extraFields ? [...options.extraFields.entries()] : []),
  ]);

  return {
    modelName,
    tableName: modelName,
    fields,
    idFields: ["id"],
    relations: options?.relations ?? new Map(),
    ...(options?.softDelete ? { softDelete: true, deletedAtField: "deletedAt" } : {}),
  };
}

function mockExecutor(
  handler: (sql: string, params?: unknown[]) => QueryResult,
): QueryExecutor {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => handler(sql, params)),
  };
}

describe("soft-delete-engine", () => {
  it("throws SoftDeleteError when Restrict dependents exist", async () => {
    const postRelations = new Map<string, RelationMeta>([
      [
        "author",
        {
          fieldName: "author",
          relatedModel: "User",
          kind: "manyToOne",
          localFkFields: ["authorId"],
          foreignKeyFields: ["id"],
          onSoftDelete: "Restrict",
        },
      ],
    ]);

    const modelMetas = {
      User: createMeta("User", { softDelete: true }),
      Post: createMeta("Post", {
        softDelete: true,
        relations: postRelations,
        extraFields: new Map([
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
        ]),
      }),
    };

    const executor = mockExecutor((sql) => {
      if (sql.includes('FROM "Post"') && sql.includes("LIMIT")) {
        return { rows: [{ id: "p1" }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    await expect(
      applyRelationalSoftDelete(
        executor,
        modelMetas.User,
        ["u1"],
        modelMetas,
        "postgresql",
        new Date("2026-01-01T00:00:00.000Z"),
      ),
    ).rejects.toThrow(SoftDeleteError);
  });
});
