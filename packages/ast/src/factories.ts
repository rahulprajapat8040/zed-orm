import type { SourceSpan } from "./location.js";
import type {
  ArrayExpressionNode,
  AttributeArgNode,
  BlockAttributeNode,
  BooleanLiteralNode,
  ConfigEntryNode,
  DatasourceNode,
  EnumNode,
  EnumValueNode,
  ExpressionNode,
  FieldAttributeNode,
  FieldNode,
  FunctionCallNode,
  GeneratorNode,
  IdentifierNode,
  KeyValueNode,
  ListTypeNode,
  ModelNode,
  NamedTypeNode,
  NullLiteralNode,
  NumericLiteralNode,
  OptionalTypeNode,
  PathExpressionNode,
  SchemaAST,
  StringLiteralNode,
  TypeNode,
} from "./nodes.js";

/**
 * Factory helpers for constructing AST nodes in tests and (later) the parser.
 * Factories keep `kind` and structural defaults consistent.
 */

export function createIdentifier(
  name: string,
  loc: SourceSpan,
): IdentifierNode {
  return { kind: "Identifier", name, loc };
}

export function createNamedType(
  name: IdentifierNode,
  loc: SourceSpan,
): NamedTypeNode {
  return { kind: "NamedType", name, loc };
}

export function createListType(
  elementType: TypeNode,
  loc: SourceSpan,
): ListTypeNode {
  return { kind: "ListType", elementType, loc };
}

export function createOptionalType(
  innerType: TypeNode,
  loc: SourceSpan,
): OptionalTypeNode {
  return { kind: "OptionalType", innerType, loc };
}

export function createStringLiteral(
  value: string,
  loc: SourceSpan,
): StringLiteralNode {
  return { kind: "StringLiteral", value, loc };
}

export function createNumericLiteral(
  value: string,
  loc: SourceSpan,
): NumericLiteralNode {
  return { kind: "NumericLiteral", value, loc };
}

export function createBooleanLiteral(
  value: boolean,
  loc: SourceSpan,
): BooleanLiteralNode {
  return { kind: "BooleanLiteral", value, loc };
}

export function createNullLiteral(loc: SourceSpan): NullLiteralNode {
  return { kind: "NullLiteral", loc };
}

export function createArrayExpression(
  elements: readonly ExpressionNode[],
  loc: SourceSpan,
): ArrayExpressionNode {
  return { kind: "ArrayExpression", elements, loc };
}

export function createFunctionCall(
  name: IdentifierNode,
  args: readonly ExpressionNode[],
  loc: SourceSpan,
): FunctionCallNode {
  return { kind: "FunctionCall", name, args, loc };
}

export function createPathExpression(
  segments: readonly IdentifierNode[],
  loc: SourceSpan,
): PathExpressionNode {
  return { kind: "PathExpression", segments, loc };
}

export function createKeyValue(
  key: IdentifierNode,
  value: ExpressionNode,
  loc: SourceSpan,
): KeyValueNode {
  return { kind: "KeyValue", key, value, loc };
}

export function createAttributeArg(
  value: ExpressionNode,
  loc: SourceSpan,
  name?: IdentifierNode,
): AttributeArgNode {
  return {
    kind: "AttributeArg",
    ...(name !== undefined ? { name } : {}),
    value,
    loc,
  };
}

export function createFieldAttribute(
  name: IdentifierNode,
  args: readonly AttributeArgNode[],
  loc: SourceSpan,
): FieldAttributeNode {
  return { kind: "FieldAttribute", name, args, loc };
}

export function createBlockAttribute(
  name: IdentifierNode,
  args: readonly AttributeArgNode[],
  loc: SourceSpan,
): BlockAttributeNode {
  return { kind: "BlockAttribute", name, args, loc };
}

export function createField(
  name: IdentifierNode,
  fieldType: TypeNode,
  attributes: readonly FieldAttributeNode[],
  loc: SourceSpan,
  documentation?: string,
): FieldNode {
  return {
    kind: "Field",
    name,
    fieldType,
    attributes,
    ...(documentation !== undefined ? { documentation } : {}),
    loc,
  };
}

export function createModel(
  name: IdentifierNode,
  fields: readonly FieldNode[],
  attributes: readonly BlockAttributeNode[],
  loc: SourceSpan,
  documentation?: string,
): ModelNode {
  return {
    kind: "Model",
    name,
    fields,
    attributes,
    ...(documentation !== undefined ? { documentation } : {}),
    loc,
  };
}

export function createEnumValue(
  name: IdentifierNode,
  attributes: readonly FieldAttributeNode[],
  loc: SourceSpan,
  documentation?: string,
): EnumValueNode {
  return {
    kind: "EnumValue",
    name,
    attributes,
    ...(documentation !== undefined ? { documentation } : {}),
    loc,
  };
}

export function createEnum(
  name: IdentifierNode,
  values: readonly EnumValueNode[],
  attributes: readonly BlockAttributeNode[],
  loc: SourceSpan,
  documentation?: string,
): EnumNode {
  return {
    kind: "Enum",
    name,
    values,
    attributes,
    ...(documentation !== undefined ? { documentation } : {}),
    loc,
  };
}

export function createConfigEntry(
  key: IdentifierNode,
  value: ExpressionNode,
  loc: SourceSpan,
): ConfigEntryNode {
  return { kind: "ConfigEntry", key, value, loc };
}

export function createDatasource(
  name: IdentifierNode,
  config: readonly ConfigEntryNode[],
  loc: SourceSpan,
): DatasourceNode {
  return { kind: "Datasource", name, config, loc };
}

export function createGenerator(
  name: IdentifierNode,
  config: readonly ConfigEntryNode[],
  loc: SourceSpan,
): GeneratorNode {
  return { kind: "Generator", name, config, loc };
}

export function createSchema(
  parts: {
    datasources?: readonly DatasourceNode[];
    generators?: readonly GeneratorNode[];
    models?: readonly ModelNode[];
    enums?: readonly EnumNode[];
  },
  loc: SourceSpan,
): SchemaAST {
  return {
    kind: "Schema",
    datasources: parts.datasources ?? [],
    generators: parts.generators ?? [],
    models: parts.models ?? [],
    enums: parts.enums ?? [],
    loc,
  };
}
