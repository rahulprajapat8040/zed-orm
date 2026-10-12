import { describe, expect, it } from "vitest";
import { parseSchema } from "@zed-orm/parser";
import {
  BLOCK_ATTRIBUTE_DEFINITIONS,
  DEFAULT_FUNCTION_DEFINITIONS,
  FIELD_ATTRIBUTE_DEFINITIONS,
  PACKAGE_NAME,
  SchemaError,
  validateSchema,
} from "./index.js";

describe("@zed-orm/schema", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/schema");
  });

  it("exports schema attribute and default-function definitions", () => {
    expect(FIELD_ATTRIBUTE_DEFINITIONS.map(({ name }) => name)).toContain(
      "relation",
    );
    expect(BLOCK_ATTRIBUTE_DEFINITIONS.map(({ name }) => name)).toContain(
      "softDelete",
    );
    expect(DEFAULT_FUNCTION_DEFINITIONS.map(({ name }) => name)).toContain(
      "uuid",
    );
  });
});

describe("validateSchema", () => {
  it("validates a User/Post schema and resolves relations", () => {
    const ast = parseSchema(
      `
      model User {
        id        String    @id @default(uuid())
        email     String    @unique
        deletedAt DateTime?
        posts     Post[]

        @@softDelete
      }

      model Post {
        id       String @id
        title    String
        authorId String
        author   User   @relation(fields: [authorId], references: [id])
      }
      `,
      "schema.zed",
    );

    const schema = validateSchema(ast);

    expect(schema.models.size).toBe(2);
    expect(schema.models.get("User")?.softDelete).toBe(true);
    expect(schema.models.get("User")?.fields.get("posts")?.isList).toBe(true);
    expect(schema.models.get("User")?.fields.get("posts")?.typeKind).toBe(
      "model",
    );
    expect(schema.relations).toHaveLength(1);
    expect(schema.relations[0]?.model).toBe("Post");
    expect(schema.relations[0]?.referencedModel).toBe("User");
    expect(schema.relations[0]?.fields).toEqual(["authorId"]);
    expect(schema.relations[0]?.references).toEqual(["id"]);
  });

  it("validates enums and enum field types", () => {
    const ast = parseSchema(`
      enum Role {
        USER
        ADMIN
      }

      model User {
        id   String @id
        role Role
      }
    `);

    const schema = validateSchema(ast);
    expect(schema.enums.get("Role")?.values.has("ADMIN")).toBe(true);
    expect(schema.models.get("User")?.fields.get("role")?.typeKind).toBe(
      "enum",
    );
  });

  it("rejects duplicate models", () => {
    const ast = parseSchema(`
      model User { id String @id }
      model User { id String @id }
    `);
    expect(() => validateSchema(ast)).toThrow(SchemaError);
  });

  it("rejects unknown field types", () => {
    const ast = parseSchema(
      `
      model User {
        id String @id
        age Strng
      }
      `,
      "schema.zed",
    );

    try {
      validateSchema(ast);
      expect.unreachable("should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(SchemaError);
      const schemaError = error as SchemaError;
      expect(schemaError.code).toBe("ZED_SCHEMA_ERROR");
      expect(schemaError.message).toContain("Unknown type 'Strng'");
      expect(schemaError.message).toContain("schema.zed:");
    }
  });

  it("rejects models without an id", () => {
    const ast = parseSchema(`
      model User {
        email String
      }
    `);
    expect(() => validateSchema(ast)).toThrow(/must have an @id/);
  });

  it("rejects relation fields/references mismatches", () => {
    const ast = parseSchema(`
      model User {
        id String @id
        posts Post[]
      }

      model Post {
        id String @id
        authorId String
        author User @relation(fields: [authorId], references: [id, email])
      }
    `);
    expect(() => validateSchema(ast)).toThrow(SchemaError);
  });

  it("rejects list relations that declare fields/references", () => {
    const ast = parseSchema(`
      model User {
        id String @id
        posts Post[] @relation(fields: [id], references: [id])
      }

      model Post {
        id String @id
      }
    `);
    expect(() => validateSchema(ast)).toThrow(
      /cannot declare fields\/references/,
    );
  });

  it("rejects @updatedAt on non-DateTime fields", () => {
    const ast = parseSchema(`
      model User {
        id String @id
        name String @updatedAt
      }
    `);
    expect(() => validateSchema(ast)).toThrow(/DateTime/);
  });

  it("requires deletedAt on @@softDelete models", () => {
    const ast = parseSchema(`
      model User {
        id String @id

        @@softDelete
      }
    `);
    expect(() => validateSchema(ast)).toThrow(/missing required field 'deletedAt DateTime\?'/);
  });

  it("parses onSoftDelete relation policies", () => {
    const ast = parseSchema(`
      model User {
        id        String    @id
        deletedAt DateTime?
        posts     Post[]

        @@softDelete
      }

      model Post {
        id       String @id
        authorId String?
        author   User   @relation(fields: [authorId], references: [id], onSoftDelete: Cascade)
      }
    `);

    const schema = validateSchema(ast);
    expect(schema.relations[0]?.onSoftDelete).toBe("Cascade");
  });

  it("rejects Nullify on required foreign keys", () => {
    const ast = parseSchema(`
      model User {
        id        String    @id
        deletedAt DateTime?
        posts     Post[]

        @@softDelete
      }

      model Post {
        id       String @id
        authorId String
        author   User   @relation(fields: [authorId], references: [id], onSoftDelete: Nullify)
      }
    `);

    expect(() => validateSchema(ast)).toThrow(/Nullify requires optional foreign-key/);
  });

  it("accepts @@id composite keys", () => {
    const ast = parseSchema(`
      model Membership {
        userId String
        orgId  String

        @@id([userId, orgId])
      }
    `);
    const schema = validateSchema(ast);
    expect(schema.models.get("Membership")?.idFields).toEqual([
      "userId",
      "orgId",
    ]);
  });
});
