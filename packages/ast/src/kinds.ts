/**
 * Discriminant string literals for every AST node kind.
 *
 * Using string unions (not numeric enums) keeps serialized ASTs readable
 * and stable across versions.
 */

export const AstNodeKind = {
  Schema: "Schema",
  Identifier: "Identifier",
  Model: "Model",
  Field: "Field",
  Enum: "Enum",
  EnumValue: "EnumValue",
  Datasource: "Datasource",
  Generator: "Generator",
  NamedType: "NamedType",
  ListType: "ListType",
  OptionalType: "OptionalType",
  FieldAttribute: "FieldAttribute",
  BlockAttribute: "BlockAttribute",
  AttributeArg: "AttributeArg",
  StringLiteral: "StringLiteral",
  NumericLiteral: "NumericLiteral",
  BooleanLiteral: "BooleanLiteral",
  NullLiteral: "NullLiteral",
  ArrayExpression: "ArrayExpression",
  FunctionCall: "FunctionCall",
  PathExpression: "PathExpression",
  KeyValue: "KeyValue",
  ConfigEntry: "ConfigEntry",
} as const;

export type AstNodeKindName = (typeof AstNodeKind)[keyof typeof AstNodeKind];
