import { describe, expect, it } from "vitest";
import {
  AstNodeKind,
  BlockAttributeName,
  FieldAttributeName,
  PACKAGE_NAME,
  SCALAR_TYPE_NAMES,
  ScalarTypeName,
  UNKNOWN_SPAN,
  createArrayExpression,
  createAttributeArg,
  createBlockAttribute,
  createField,
  createFieldAttribute,
  createFunctionCall,
  createIdentifier,
  createListType,
  createModel,
  createNamedType,
  createOptionalType,
  createSchema,
  getNamedType,
  isField,
  isListFieldType,
  isModel,
  isOptionalFieldType,
  isSchemaAST,
  positionToSpan,
  spanToLocation,
} from "./index.js";

const loc = UNKNOWN_SPAN;

describe("@zed-orm/ast", () => {
  it("exports package identity", () => {
    expect(PACKAGE_NAME).toBe("@zed-orm/ast");
  });

  it("exposes stable node kind discriminants", () => {
    expect(AstNodeKind.Schema).toBe("Schema");
    expect(AstNodeKind.Model).toBe("Model");
    expect(AstNodeKind.FieldAttribute).toBe("FieldAttribute");
  });

  it("lists initial scalar types", () => {
    expect(SCALAR_TYPE_NAMES).toContain(ScalarTypeName.String);
    expect(SCALAR_TYPE_NAMES).toContain(ScalarTypeName.DateTime);
    expect(SCALAR_TYPE_NAMES).toHaveLength(9);
  });
});

describe("source locations", () => {
  it("converts spans to compact locations", () => {
    const span = {
      fileName: "schema.zed",
      start: { line: 2, column: 3, offset: 10 },
      end: { line: 2, column: 8, offset: 15 },
    };

    expect(spanToLocation(span)).toEqual({
      fileName: "schema.zed",
      line: 2,
      column: 3,
      offset: 10,
      length: 5,
    });
  });

  it("creates zero-width spans from positions", () => {
    const span = positionToSpan(
      { line: 4, column: 1, offset: 20 },
      "schema.zed",
    );
    expect(span.start).toEqual(span.end);
    expect(span.fileName).toBe("schema.zed");
  });
});

describe("type helpers", () => {
  it("detects optional and list wrappers", () => {
    const stringType = createNamedType(createIdentifier("String", loc), loc);
    const optionalString = createOptionalType(stringType, loc);
    const posts = createListType(
      createNamedType(createIdentifier("Post", loc), loc),
      loc,
    );
    const optionalPosts = createOptionalType(posts, loc);

    expect(isOptionalFieldType(stringType)).toBe(false);
    expect(isOptionalFieldType(optionalString)).toBe(true);
    expect(isListFieldType(posts)).toBe(true);
    expect(isListFieldType(optionalPosts)).toBe(true);
    expect(getNamedType(optionalPosts)?.name.name).toBe("Post");
  });
});

describe("schema factories", () => {
  it("builds a User/Post schema AST without SQL", () => {
    const idAttr = createFieldAttribute(
      createIdentifier(FieldAttributeName.Id, loc),
      [],
      loc,
    );
    const defaultUuid = createFieldAttribute(
      createIdentifier(FieldAttributeName.Default, loc),
      [
        createAttributeArg(
          createFunctionCall(createIdentifier("uuid", loc), [], loc),
          loc,
        ),
      ],
      loc,
    );
    const uniqueAttr = createFieldAttribute(
      createIdentifier(FieldAttributeName.Unique, loc),
      [],
      loc,
    );

    const user = createModel(
      createIdentifier("User", loc),
      [
        createField(
          createIdentifier("id", loc),
          createNamedType(createIdentifier("String", loc), loc),
          [idAttr, defaultUuid],
          loc,
        ),
        createField(
          createIdentifier("email", loc),
          createNamedType(createIdentifier("String", loc), loc),
          [uniqueAttr],
          loc,
        ),
        createField(
          createIdentifier("name", loc),
          createOptionalType(
            createNamedType(createIdentifier("String", loc), loc),
            loc,
          ),
          [],
          loc,
        ),
        createField(
          createIdentifier("posts", loc),
          createListType(
            createNamedType(createIdentifier("Post", loc), loc),
            loc,
          ),
          [],
          loc,
        ),
        createField(
          createIdentifier("deletedAt", loc),
          createOptionalType(
            createNamedType(createIdentifier("DateTime", loc), loc),
            loc,
          ),
          [],
          loc,
        ),
      ],
      [
        createBlockAttribute(
          createIdentifier(BlockAttributeName.SoftDelete, loc),
          [],
          loc,
        ),
      ],
      loc,
    );

    const relationAttr = createFieldAttribute(
      createIdentifier(FieldAttributeName.Relation, loc),
      [
        createAttributeArg(
          createArrayExpression([createIdentifier("authorId", loc)], loc),
          loc,
          createIdentifier("fields", loc),
        ),
        createAttributeArg(
          createArrayExpression([createIdentifier("id", loc)], loc),
          loc,
          createIdentifier("references", loc),
        ),
      ],
      loc,
    );

    const post = createModel(
      createIdentifier("Post", loc),
      [
        createField(
          createIdentifier("id", loc),
          createNamedType(createIdentifier("String", loc), loc),
          [idAttr],
          loc,
        ),
        createField(
          createIdentifier("title", loc),
          createNamedType(createIdentifier("String", loc), loc),
          [],
          loc,
        ),
        createField(
          createIdentifier("authorId", loc),
          createNamedType(createIdentifier("String", loc), loc),
          [],
          loc,
        ),
        createField(
          createIdentifier("author", loc),
          createNamedType(createIdentifier("User", loc), loc),
          [relationAttr],
          loc,
        ),
      ],
      [],
      loc,
    );

    const schema = createSchema({ models: [user, post] }, loc);

    expect(isSchemaAST(schema)).toBe(true);
    expect(schema.models).toHaveLength(2);
    expect(isModel(schema.models[0])).toBe(true);
    expect(schema.models[0]?.name.name).toBe("User");
    expect(schema.models[0]?.attributes[0]?.name.name).toBe("softDelete");
    expect(isField(schema.models[1]?.fields[3])).toBe(true);
    expect(schema.models[1]?.fields[3]?.attributes[0]?.name.name).toBe(
      "relation",
    );
    expect(schema.enums).toEqual([]);
    expect(schema.datasources).toEqual([]);
  });
});
