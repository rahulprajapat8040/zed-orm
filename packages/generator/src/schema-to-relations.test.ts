import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import { validateSchema } from "@zed-orm/schema";
import { modelToRelations } from "./schema-to-relations.js";

describe("modelToRelations", () => {
  it("resolves many-to-one and one-to-many pairs", () => {
    const schema = validateSchema(
      parseSchema(
        `
        model User {
          id    String @id
          posts Post[]
        }

        model Post {
          id       String @id
          authorId String
          author   User   @relation(fields: [authorId], references: [id])
        }
        `,
        "schema.zed",
      ),
    );

    const userRelations = modelToRelations(schema, schema.models.get("User")!);
    const postRelations = modelToRelations(schema, schema.models.get("Post")!);

    expect(userRelations.get("posts")).toMatchObject({
      kind: "oneToMany",
      relatedModel: "Post",
      localFkFields: ["authorId"],
      foreignKeyFields: ["id"],
    });

    expect(postRelations.get("author")).toMatchObject({
      kind: "manyToOne",
      relatedModel: "User",
      localFkFields: ["authorId"],
      foreignKeyFields: ["id"],
    });
  });

  it("resolves many-to-many list pairs", () => {
    const schema = validateSchema(
      parseSchema(
        `
        model Post {
          id   String @id
          tags Tag[]
        }

        model Tag {
          id    String @id
          posts Post[]
        }
        `,
        "schema.zed",
      ),
    );

    const postRelations = modelToRelations(schema, schema.models.get("Post")!);

    expect(postRelations.get("tags")).toMatchObject({
      kind: "manyToMany",
      relatedModel: "Tag",
      joinTable: {
        tableName: "_PostToTag",
        localColumn: "A",
        foreignColumn: "B",
      },
    });
  });
});
