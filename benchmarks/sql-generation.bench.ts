import { bench, describe } from "vitest";
import type { ModelMeta } from "@zed-orm/query-builder";
import {
  buildCreate,
  buildFindMany,
  buildUpdate,
} from "@zed-orm/query-builder";

const userMeta: ModelMeta = {
  modelName: "User",
  tableName: "User",
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
  ]),
  relations: new Map(),
};

describe("SQL generation", () => {
  bench("buildFindMany", () => {
    buildFindMany(userMeta, {
      where: { age: { gte: 18 } },
      orderBy: { email: "asc" },
      take: 10,
      skip: 5,
    });
  });

  bench("buildCreate", () => {
    buildCreate(userMeta, {
      data: { id: "u1", email: "a@x.com", age: 30 },
    });
  });

  bench("buildUpdate", () => {
    buildUpdate(userMeta, {
      where: { id: "u1" },
      data: { email: "new@x.com" },
    });
  });
});
