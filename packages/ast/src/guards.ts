import type {
  ArrayExpressionNode,
  AstNode,
  AttributeArgNode,
  AttributeNode,
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasKind(value: unknown, kind: string): boolean {
  return isObject(value) && value["kind"] === kind;
}

export function isSchemaAST(node: unknown): node is SchemaAST {
  return hasKind(node, "Schema");
}

export function isIdentifier(node: unknown): node is IdentifierNode {
  return hasKind(node, "Identifier");
}

export function isModel(node: unknown): node is ModelNode {
  return hasKind(node, "Model");
}

export function isField(node: unknown): node is FieldNode {
  return hasKind(node, "Field");
}

export function isEnum(node: unknown): node is EnumNode {
  return hasKind(node, "Enum");
}

export function isEnumValue(node: unknown): node is EnumValueNode {
  return hasKind(node, "EnumValue");
}

export function isDatasource(node: unknown): node is DatasourceNode {
  return hasKind(node, "Datasource");
}

export function isGenerator(node: unknown): node is GeneratorNode {
  return hasKind(node, "Generator");
}

export function isNamedType(node: unknown): node is NamedTypeNode {
  return hasKind(node, "NamedType");
}

export function isListType(node: unknown): node is ListTypeNode {
  return hasKind(node, "ListType");
}

export function isOptionalType(node: unknown): node is OptionalTypeNode {
  return hasKind(node, "OptionalType");
}

export function isTypeNode(node: unknown): node is TypeNode {
  return isNamedType(node) || isListType(node) || isOptionalType(node);
}

export function isFieldAttribute(node: unknown): node is FieldAttributeNode {
  return hasKind(node, "FieldAttribute");
}

export function isBlockAttribute(node: unknown): node is BlockAttributeNode {
  return hasKind(node, "BlockAttribute");
}

export function isAttribute(node: unknown): node is AttributeNode {
  return isFieldAttribute(node) || isBlockAttribute(node);
}

export function isAttributeArg(node: unknown): node is AttributeArgNode {
  return hasKind(node, "AttributeArg");
}

export function isStringLiteral(node: unknown): node is StringLiteralNode {
  return hasKind(node, "StringLiteral");
}

export function isNumericLiteral(node: unknown): node is NumericLiteralNode {
  return hasKind(node, "NumericLiteral");
}

export function isBooleanLiteral(node: unknown): node is BooleanLiteralNode {
  return hasKind(node, "BooleanLiteral");
}

export function isNullLiteral(node: unknown): node is NullLiteralNode {
  return hasKind(node, "NullLiteral");
}

export function isArrayExpression(node: unknown): node is ArrayExpressionNode {
  return hasKind(node, "ArrayExpression");
}

export function isFunctionCall(node: unknown): node is FunctionCallNode {
  return hasKind(node, "FunctionCall");
}

export function isPathExpression(node: unknown): node is PathExpressionNode {
  return hasKind(node, "PathExpression");
}

export function isKeyValue(node: unknown): node is KeyValueNode {
  return hasKind(node, "KeyValue");
}

export function isConfigEntry(node: unknown): node is ConfigEntryNode {
  return hasKind(node, "ConfigEntry");
}

export function isExpression(node: unknown): node is ExpressionNode {
  return (
    isStringLiteral(node) ||
    isNumericLiteral(node) ||
    isBooleanLiteral(node) ||
    isNullLiteral(node) ||
    isArrayExpression(node) ||
    isFunctionCall(node) ||
    isPathExpression(node) ||
    isIdentifier(node) ||
    isKeyValue(node)
  );
}

export function isAstNode(node: unknown): node is AstNode {
  return isObject(node) && typeof node["kind"] === "string" && "loc" in node;
}

/**
 * Unwrap optional/list wrappers to the underlying named type, if present.
 * Useful for semantic analysis (Milestone 3).
 */
export function getNamedType(type: TypeNode): NamedTypeNode | undefined {
  switch (type.kind) {
    case "NamedType":
      return type;
    case "ListType":
      return getNamedType(type.elementType);
    case "OptionalType":
      return getNamedType(type.innerType);
  }
}

/** Returns true if the type (at any wrapping level) is a list. */
export function isListFieldType(type: TypeNode): boolean {
  switch (type.kind) {
    case "ListType":
      return true;
    case "OptionalType":
      return isListFieldType(type.innerType);
    case "NamedType":
      return false;
  }
}

/** Returns true if the outermost or nested wrapper marks the field optional. */
export function isOptionalFieldType(type: TypeNode): boolean {
  switch (type.kind) {
    case "OptionalType":
      return true;
    case "ListType":
      return isOptionalFieldType(type.elementType);
    case "NamedType":
      return false;
  }
}
