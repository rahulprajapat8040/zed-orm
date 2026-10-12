import type { AstNodeKindName } from "./kinds.js";
import type { SourceSpan } from "./location.js";

/** Base shape shared by all AST nodes. */
export interface AstNodeBase {
  readonly kind: AstNodeKindName;
  readonly loc: SourceSpan;
}

/** Identifier with source location (model names, field names, attribute names). */
export interface IdentifierNode extends AstNodeBase {
  readonly kind: "Identifier";
  readonly name: string;
}

/** Named type reference: `String`, `User`, `Role`, etc. */
export interface NamedTypeNode extends AstNodeBase {
  readonly kind: "NamedType";
  readonly name: IdentifierNode;
}

/** List type: `Post[]`. */
export interface ListTypeNode extends AstNodeBase {
  readonly kind: "ListType";
  readonly elementType: TypeNode;
}

/** Optional type: `String?` or `Post[]?`. */
export interface OptionalTypeNode extends AstNodeBase {
  readonly kind: "OptionalType";
  readonly innerType: TypeNode;
}

/**
 * Field / relation type expression.
 *
 * Grammar intent (parser Milestone 2):
 *   Type := NamedType | ListType\<Type\> | OptionalType\<Type\>
 */
export type TypeNode = NamedTypeNode | ListTypeNode | OptionalTypeNode;

/** String literal: `"postgresql"` / `"hello"`. */
export interface StringLiteralNode extends AstNodeBase {
  readonly kind: "StringLiteral";
  readonly value: string;
}

/** Numeric literal: `18`, `3.14`. Stored as string to preserve precision. */
export interface NumericLiteralNode extends AstNodeBase {
  readonly kind: "NumericLiteral";
  readonly value: string;
}

/** Boolean literal: `true` / `false`. */
export interface BooleanLiteralNode extends AstNodeBase {
  readonly kind: "BooleanLiteral";
  readonly value: boolean;
}

/** Null literal. */
export interface NullLiteralNode extends AstNodeBase {
  readonly kind: "NullLiteral";
}

/** Array expression: `[authorId]`, `[id]`. */
export interface ArrayExpressionNode extends AstNodeBase {
  readonly kind: "ArrayExpression";
  readonly elements: readonly ExpressionNode[];
}

/** Function call expression: `uuid()`, `now()`, `cuid()`. */
export interface FunctionCallNode extends AstNodeBase {
  readonly kind: "FunctionCall";
  readonly name: IdentifierNode;
  readonly args: readonly ExpressionNode[];
}

/**
 * Dotted / bare path used in attribute args: `Cascade`, `fields`, etc.
 * Distinct from Identifier so parsers can represent multi-segment paths later.
 */
export interface PathExpressionNode extends AstNodeBase {
  readonly kind: "PathExpression";
  readonly segments: readonly IdentifierNode[];
}

/** Key-value pair inside attribute args: `fields: [authorId]`. */
export interface KeyValueNode extends AstNodeBase {
  readonly kind: "KeyValue";
  readonly key: IdentifierNode;
  readonly value: ExpressionNode;
}

/**
 * Expressions usable as attribute arguments and config values.
 */
export type ExpressionNode =
  | StringLiteralNode
  | NumericLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode
  | ArrayExpressionNode
  | FunctionCallNode
  | PathExpressionNode
  | IdentifierNode
  | KeyValueNode;

/**
 * A single attribute argument.
 *
 * Supports both positional (`@default(uuid())`) and named (`fields: [authorId]`) forms.
 */
export interface AttributeArgNode extends AstNodeBase {
  readonly kind: "AttributeArg";
  /** Present for named args (`fields: [...]`). Absent for positional args. */
  readonly name?: IdentifierNode;
  readonly value: ExpressionNode;
}

/** Field-level attribute: `@id`, `@unique`, `@default(...)`, `@relation(...)`. */
export interface FieldAttributeNode extends AstNodeBase {
  readonly kind: "FieldAttribute";
  readonly name: IdentifierNode;
  readonly args: readonly AttributeArgNode[];
}

/** Model/enum-level attribute: `@@index`, `@@unique`, `@@softDelete`. */
export interface BlockAttributeNode extends AstNodeBase {
  readonly kind: "BlockAttribute";
  readonly name: IdentifierNode;
  readonly args: readonly AttributeArgNode[];
}

export type AttributeNode = FieldAttributeNode | BlockAttributeNode;

/** A field declaration inside a model. */
export interface FieldNode extends AstNodeBase {
  readonly kind: "Field";
  readonly name: IdentifierNode;
  readonly fieldType: TypeNode;
  readonly attributes: readonly FieldAttributeNode[];
  readonly documentation?: string;
}

/** A `model` declaration. */
export interface ModelNode extends AstNodeBase {
  readonly kind: "Model";
  readonly name: IdentifierNode;
  readonly fields: readonly FieldNode[];
  readonly attributes: readonly BlockAttributeNode[];
  readonly documentation?: string;
}

/** An enum member. */
export interface EnumValueNode extends AstNodeBase {
  readonly kind: "EnumValue";
  readonly name: IdentifierNode;
  readonly attributes: readonly FieldAttributeNode[];
  readonly documentation?: string;
}

/** An `enum` declaration. */
export interface EnumNode extends AstNodeBase {
  readonly kind: "Enum";
  readonly name: IdentifierNode;
  readonly values: readonly EnumValueNode[];
  readonly attributes: readonly BlockAttributeNode[];
  readonly documentation?: string;
}

/** Config entry inside datasource / generator blocks: `provider = "postgresql"`. */
export interface ConfigEntryNode extends AstNodeBase {
  readonly kind: "ConfigEntry";
  readonly key: IdentifierNode;
  readonly value: ExpressionNode;
}

/** A `datasource` block. */
export interface DatasourceNode extends AstNodeBase {
  readonly kind: "Datasource";
  readonly name: IdentifierNode;
  readonly config: readonly ConfigEntryNode[];
}

/** A `generator` block. */
export interface GeneratorNode extends AstNodeBase {
  readonly kind: "Generator";
  readonly name: IdentifierNode;
  readonly config: readonly ConfigEntryNode[];
}

/**
 * Root schema AST produced by the parser.
 *
 * Order of top-level declarations is preserved for formatting and diagnostics.
 */
export interface SchemaAST extends AstNodeBase {
  readonly kind: "Schema";
  readonly datasources: readonly DatasourceNode[];
  readonly generators: readonly GeneratorNode[];
  readonly models: readonly ModelNode[];
  readonly enums: readonly EnumNode[];
}

/** Union of all concrete AST node types. */
export type AstNode =
  | SchemaAST
  | IdentifierNode
  | ModelNode
  | FieldNode
  | EnumNode
  | EnumValueNode
  | DatasourceNode
  | GeneratorNode
  | NamedTypeNode
  | ListTypeNode
  | OptionalTypeNode
  | FieldAttributeNode
  | BlockAttributeNode
  | AttributeArgNode
  | StringLiteralNode
  | NumericLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode
  | ArrayExpressionNode
  | FunctionCallNode
  | PathExpressionNode
  | KeyValueNode
  | ConfigEntryNode;
