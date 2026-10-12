/**
 * @zed-orm/ast
 *
 * Schema language AST types, source locations, guards, and factories.
 * Parser-independent. No SQL. No semantic validation.
 */

export { AstNodeKind, type AstNodeKindName } from "./kinds.js";

export {
  type SourcePosition,
  type SourceSpan,
  type SourceLocation,
  spanToLocation,
  positionToSpan,
  UNKNOWN_SPAN,
} from "./location.js";

export type {
  AstNodeBase,
  AstNode,
  IdentifierNode,
  NamedTypeNode,
  ListTypeNode,
  OptionalTypeNode,
  TypeNode,
  StringLiteralNode,
  NumericLiteralNode,
  BooleanLiteralNode,
  NullLiteralNode,
  ArrayExpressionNode,
  FunctionCallNode,
  PathExpressionNode,
  KeyValueNode,
  ExpressionNode,
  AttributeArgNode,
  FieldAttributeNode,
  BlockAttributeNode,
  AttributeNode,
  FieldNode,
  ModelNode,
  EnumValueNode,
  EnumNode,
  ConfigEntryNode,
  DatasourceNode,
  GeneratorNode,
  SchemaAST,
} from "./nodes.js";

export {
  ScalarTypeName,
  type ScalarTypeNameValue,
  SCALAR_TYPE_NAMES,
  FieldAttributeName,
  BlockAttributeName,
} from "./names.js";

export {
  isSchemaAST,
  isIdentifier,
  isModel,
  isField,
  isEnum,
  isEnumValue,
  isDatasource,
  isGenerator,
  isNamedType,
  isListType,
  isOptionalType,
  isTypeNode,
  isFieldAttribute,
  isBlockAttribute,
  isAttribute,
  isAttributeArg,
  isStringLiteral,
  isNumericLiteral,
  isBooleanLiteral,
  isNullLiteral,
  isArrayExpression,
  isFunctionCall,
  isPathExpression,
  isKeyValue,
  isConfigEntry,
  isExpression,
  isAstNode,
  getNamedType,
  isListFieldType,
  isOptionalFieldType,
} from "./guards.js";

export {
  createIdentifier,
  createNamedType,
  createListType,
  createOptionalType,
  createStringLiteral,
  createNumericLiteral,
  createBooleanLiteral,
  createNullLiteral,
  createArrayExpression,
  createFunctionCall,
  createPathExpression,
  createKeyValue,
  createAttributeArg,
  createFieldAttribute,
  createBlockAttribute,
  createField,
  createModel,
  createEnumValue,
  createEnum,
  createConfigEntry,
  createDatasource,
  createGenerator,
  createSchema,
} from "./factories.js";

export const PACKAGE_NAME = "@zed-orm/ast" as const;
