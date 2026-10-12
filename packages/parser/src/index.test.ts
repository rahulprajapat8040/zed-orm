import { describe, expect, it } from "vitest";
import { isListType, isNamedType, isOptionalType } from "@zed-orm/ast";
import {
  ParseError,
  PACKAGE_NAME,
  TokenKind,
  parseSchema,
  tokenize,
} from "./index.js";

describe("@zed-orm/parser", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/parser");
  });
});

describe("tokenize", () => {
  it("tokenizes punctuation, identifiers, and keywords", () => {
    const tokens = tokenize("model User { id String @id }", "schema.zed");
    const kinds = tokens.map((t) => t.kind);

    expect(kinds).toEqual([
      TokenKind.Model,
      TokenKind.Identifier,
      TokenKind.LeftBrace,
      TokenKind.Identifier,
      TokenKind.Identifier,
      TokenKind.At,
      TokenKind.Identifier,
      TokenKind.RightBrace,
      TokenKind.Eof,
    ]);
    expect(tokens[0]?.loc.fileName).toBe("schema.zed");
  });

  it("tokenizes @@ as a single token", () => {
    const tokens = tokenize("@@index([email])");
    expect(tokens[0]?.kind).toBe(TokenKind.AtAt);
    expect(tokens[0]?.lexeme).toBe("@@");
  });

  it("skips line and block comments", () => {
    const tokens = tokenize(`
      // comment
      model /* inner */ User {}
    `);
    expect(tokens.map((t) => t.kind)).toEqual([
      TokenKind.Model,
      TokenKind.Identifier,
      TokenKind.LeftBrace,
      TokenKind.RightBrace,
      TokenKind.Eof,
    ]);
  });

  it("parses string escapes", () => {
    const tokens = tokenize('"a\\"b"');
    expect(tokens[0]?.kind).toBe(TokenKind.String);
    expect(tokens[0]?.lexeme).toBe('a"b');
  });

  it("throws on unexpected characters", () => {
    expect(() => tokenize("model User { # }")).toThrow(ParseError);
  });
});

describe("parseSchema", () => {
  it("parses models, fields, optionals, lists, and attributes", () => {
    const schema = parseSchema(
      `
      model User {
        id        String   @id @default(uuid())
        email     String   @unique
        name      String?
        posts     Post[]
        deletedAt DateTime?

        @@softDelete
      }

      model Post {
        id       String @id @default(uuid())
        title    String
        authorId String
        author   User   @relation(fields: [authorId], references: [id])
      }
      `,
      "schema.zed",
    );

    expect(schema.models).toHaveLength(2);
    expect(schema.models[0]?.name.name).toBe("User");
    expect(schema.models[0]?.fields).toHaveLength(5);
    expect(schema.models[0]?.attributes[0]?.name.name).toBe("softDelete");

    const nameField = schema.models[0]?.fields[2];
    expect(nameField?.name.name).toBe("name");
    expect(isOptionalType(nameField?.fieldType)).toBe(true);

    const postsField = schema.models[0]?.fields[3];
    expect(isListType(postsField?.fieldType)).toBe(true);

    const author = schema.models[1]?.fields[3];
    expect(author?.attributes[0]?.name.name).toBe("relation");
    expect(author?.attributes[0]?.args).toHaveLength(2);
    expect(author?.attributes[0]?.args[0]?.name?.name).toBe("fields");
  });

  it("parses enums, datasources, and generators", () => {
    const schema = parseSchema(`
      datasource db {
        provider = "postgresql"
        url      = "postgresql://localhost/zed"
      }

      generator client {
        provider = "zed-client"
      }

      enum Role {
        USER
        ADMIN
      }
    `);

    expect(schema.datasources).toHaveLength(1);
    expect(schema.datasources[0]?.name.name).toBe("db");
    expect(schema.datasources[0]?.config[0]?.key.name).toBe("provider");

    expect(schema.generators).toHaveLength(1);
    expect(schema.enums[0]?.name.name).toBe("Role");
    expect(schema.enums[0]?.values.map((v) => v.name.name)).toEqual([
      "USER",
      "ADMIN",
    ]);
  });

  it("parses list-optional types as Optional(List(Named))", () => {
    const schema = parseSchema(`
      model Tag {
        labels String[]?
      }
    `);
    const type = schema.models[0]?.fields[0]?.fieldType;
    expect(isOptionalType(type)).toBe(true);
    if (isOptionalType(type)) {
      expect(isListType(type.innerType)).toBe(true);
      if (isListType(type.innerType)) {
        expect(isNamedType(type.innerType.elementType)).toBe(true);
      }
    }
  });

  it("includes file name and position in parse errors", () => {
    try {
      parseSchema("model User {", "schema.zed");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ParseError);
      const parseError = error as ParseError;
      expect(parseError.code).toBe("ZED_PARSE_ERROR");
      expect(parseError.fileName).toBe("schema.zed");
      expect(parseError.message).toContain("schema.zed:");
      expect(parseError.line).toBeGreaterThanOrEqual(1);
      expect(parseError.column).toBeGreaterThanOrEqual(1);
    }
  });

  it("rejects invalid top-level tokens", () => {
    expect(() => parseSchema("foo Bar {}", "schema.zed")).toThrow(ParseError);
  });

  it("rejects missing attribute closing paren", () => {
    expect(() =>
      parseSchema(`
        model User {
          id String @default(uuid(
        }
      `),
    ).toThrow(ParseError);
  });
});
