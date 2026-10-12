import {
  CompletionItem,
  CompletionItemKind,
  CompletionList,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  InsertTextFormat,
  ProposedFeatures,
  SemanticTokenModifiers,
  SemanticTokenTypes,
  TextDocuments,
  TextDocumentSyncKind,
  type InitializeResult,
  type Position,
  type Range,
  type SemanticTokens,
  type SemanticTokensLegend,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  SCALAR_TYPE_NAMES,
  getNamedType,
  isListType,
  isNamedType,
  isOptionalType,
  type SchemaAST,
  type TypeNode,
} from "@zed-orm/ast";
import { parseSchema, tokenize, TokenKind, type Token } from "@zed-orm/parser";
import {
  BLOCK_ATTRIBUTE_DEFINITIONS,
  DEFAULT_FUNCTION_DEFINITIONS,
  FIELD_ATTRIBUTE_DEFINITIONS,
  validateSchema,
  type AttributeDefinition,
} from "@zed-orm/schema";

export type SemanticTokenEntry = {
  readonly start: Position;
  readonly end: Position;
  readonly tokenType: string;
  readonly modifiers: readonly string[];
};

export interface SchemaAnalysis {
  readonly ast?: SchemaAST;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CompletionContext {
  readonly document: TextDocument;
  readonly position: Position;
  readonly ast?: SchemaAST;
}

const ALL_SCALAR_TYPES = [...SCALAR_TYPE_NAMES];
let developmentLoggingEnabled = process.env.ZED_ORM_LSP_DEBUG === "1";

export function createDocumentManager() {
  const documents = new Map<string, TextDocument>();

  return {
    documents,
    open(document: TextDocument) {
      documents.set(document.uri, document);
    },
    update(document: TextDocument) {
      documents.set(document.uri, document);
    },
    close(uri: string) {
      documents.delete(uri);
    },
    get(uri: string) {
      return documents.get(uri);
    },
    entries() {
      return Array.from(documents.values());
    },
  };
}

export function getSemanticTokensLegend(): SemanticTokensLegend {
  return {
    tokenTypes: [
      SemanticTokenTypes.namespace,
      SemanticTokenTypes.type,
      SemanticTokenTypes.class,
      SemanticTokenTypes.enum,
      SemanticTokenTypes.enumMember,
      SemanticTokenTypes.property,
      SemanticTokenTypes.function,
      SemanticTokenTypes.keyword,
      SemanticTokenTypes.decorator,
      SemanticTokenTypes.parameter,
    ],
    tokenModifiers: [
      SemanticTokenModifiers.declaration,
      SemanticTokenModifiers.definition,
      SemanticTokenModifiers.readonly,
      SemanticTokenModifiers.defaultLibrary,
    ],
  };
}

export function analyzeSchemaSource(
  source: string,
  fileName = "schema.zed",
): SchemaAnalysis {
  const diagnostics: Diagnostic[] = [];
  let ast: SchemaAST | undefined;

  try {
    ast = parseSchema(source, fileName);
    validateSchema(ast);
  } catch (error) {
    debugLog(
      `Schema parsing or validation failed for ${fileName}: ${errorMessage(error)}`,
    );
    const diagnostic = convertErrorToDiagnostic(error, source, fileName);
    if (diagnostic !== undefined) {
      diagnostics.push(diagnostic);
    } else {
      debugLog(
        `Could not convert the schema error for ${fileName} to a diagnostic.`,
      );
    }
  }

  if (ast !== undefined) {
    return { ast, diagnostics };
  }
  return { diagnostics };
}

export function computeDiagnostics(document: TextDocument): Diagnostic[] {
  const analysis = analyzeSchemaSource(document.getText(), document.uri);
  return [...analysis.diagnostics];
}

export function computeCompletionItems(
  document: TextDocument,
  position: Position,
  ast = analyzeSchemaSource(document.getText(), document.uri).ast,
): CompletionItem[] {
  const source = document.getText();
  const offset = document.offsetAt(position);
  if (isInsideCommentOrString(source, offset)) {
    return [];
  }

  const prefix = source.slice(0, offset);
  let tokens: Token[];
  try {
    tokens = tokenize(prefix);
  } catch (error) {
    debugLog(`Could not tokenize completion context: ${errorMessage(error)}`);
    return [];
  }

  const context = resolveCompletionContext(source, offset, tokens, ast);
  if (context === undefined) {
    debugLog("Completion context: none; result count: 0.");
    return [];
  }

  const items = (() => {
    switch (context.kind) {
      case "field-attribute":
        return createAttributeCompletions(
          context,
          getFieldAttributeDefinitions(context.fieldType),
        );
      case "block-attribute":
        return createAttributeCompletions(context, BLOCK_ATTRIBUTE_DEFINITIONS);
      case "default-value":
        return createDefaultCompletions(context);
      case "relation-argument":
        return createRelationArgumentCompletions(context);
      case "relation-field":
        return createFieldNameCompletions(
          context.fields,
          context.prefix,
          context.wordRange,
        );
      case "block-field":
        return createFieldNameCompletions(
          context.fields,
          context.prefix,
          context.wordRange,
        );
      case "field-type":
        return createTypeCompletions(context);
      case "top-level":
        return createTopLevelCompletions(context.prefix);
      case "enum-value":
        return [];
    }
  })();
  debugLog(
    `Completion context: ${context.kind}; result count: ${items.length}.`,
  );
  return items;
}

type FieldTypeContext = {
  readonly typeName: string;
  readonly typeKind: "scalar" | "enum" | "model" | "unknown";
  readonly isList: boolean;
  readonly isOptional: boolean;
};

type AttributeCompletionContext = {
  readonly kind: "field-attribute" | "block-attribute";
  readonly document: TextDocument;
  readonly source: string;
  readonly offset: number;
  readonly marker: Token;
  readonly prefix: string;
  readonly wordRange: Range;
  readonly hasArguments: boolean;
  readonly fieldType?: FieldTypeContext;
  readonly modelName?: string;
  readonly fields: readonly string[];
  readonly relatedFields: readonly string[];
};

type ArgumentCompletionContext = {
  readonly kind:
    "default-value" | "relation-argument" | "relation-field" | "block-field";
  readonly source: string;
  readonly offset: number;
  readonly prefix: string;
  readonly wordRange: Range;
  readonly fieldType?: FieldTypeContext;
  readonly enumValues: readonly string[];
  readonly fields: readonly string[];
  readonly relatedFields: readonly string[];
  readonly argumentName?: string;
  readonly availableArguments?: readonly {
    readonly name: string;
    readonly description: string;
    readonly values?: readonly string[];
  }[];
  readonly blockAttributeName?: string;
};

type TopLevelCompletionContext = {
  readonly kind: "top-level";
  readonly prefix: string;
  readonly document: TextDocument;
  readonly offset: number;
};

type FieldTypeCompletionContext = {
  readonly kind: "field-type";
  readonly prefix: string;
  readonly document: TextDocument;
  readonly offset: number;
  readonly ast?: SchemaAST;
};

type ResolvedCompletionContext =
  | AttributeCompletionContext
  | ArgumentCompletionContext
  | TopLevelCompletionContext
  | FieldTypeCompletionContext
  | { readonly kind: "enum-value" };

function resolveCompletionContext(
  source: string,
  offset: number,
  tokens: readonly Token[],
  initialAst: SchemaAST | undefined,
): ResolvedCompletionContext | undefined {
  const document = TextDocument.create(
    "file:///completion.zed",
    "zed",
    1,
    source,
  );
  const block = findEnclosingBlock(tokens);
  const marker = findActiveAttributeMarker(tokens, document.positionAt(offset));
  const ast =
    initialAst ?? recoverCompletionAst(source, marker?.loc.start.offset);
  const model =
    block?.kind === "model"
      ? ast?.models.find((item) => item.name.name === block.name)
      : undefined;
  const lineTokens = tokens.filter(
    (token) => token.loc.start.line === document.positionAt(offset).line + 1,
  );
  const markerIndex = marker === undefined ? -1 : tokens.indexOf(marker);

  if (marker !== undefined && markerIndex >= 0) {
    const markerIsBlock = marker.kind === TokenKind.AtAt;
    const attributeNameToken = tokens[markerIndex + 1];
    const attributeName =
      attributeNameToken !== undefined &&
      attributeNameToken.kind === TokenKind.Identifier &&
      attributeNameToken.loc.start.offset < offset
        ? attributeNameToken.lexeme
        : "";
    const hasArguments = tokens
      .slice(markerIndex + 1)
      .some((token) => token.kind === TokenKind.LeftParen);
    const modelFields = model?.fields.map((field) => field.name.name) ?? [];
    const relationFields = getRelationCandidateFields(model, ast);
    const attributeLineTokens = tokens.filter(
      (token) => token.loc.start.line === marker.loc.start.line,
    );
    const currentField = markerIsBlock
      ? undefined
      : findCurrentField(model, attributeLineTokens, marker, ast);
    const fieldType =
      currentField?.type ??
      inferFieldTypeFromTokens(
        attributeLineTokens,
        marker,
        attributeNameToken,
        ast,
        block?.name,
      );
    const relatedModel =
      fieldType?.typeKind === "model"
        ? ast?.models.find((item) => item.name.name === fieldType.typeName)
        : undefined;
    const range = wordRangeAt(document, source, offset, marker.loc.end.offset);

    if (markerIsBlock) {
      if (block?.kind !== "model") {
        return undefined;
      }
      if (hasArguments) {
        const currentBlockAttribute = attributeName;
        if (
          currentBlockAttribute === "id" ||
          currentBlockAttribute === "index" ||
          currentBlockAttribute === "unique"
        ) {
          return {
            kind: "block-field",
            source,
            offset,
            prefix: range.prefix,
            wordRange: range.range,
            fields: modelFields,
            relatedFields: [],
            enumValues: [],
            blockAttributeName: currentBlockAttribute,
          };
        }
        return undefined;
      }
      return {
        kind: "block-attribute",
        document,
        source,
        offset,
        marker,
        prefix: range.prefix,
        wordRange: range.range,
        hasArguments: hasOpeningParenthesisAfter(
          source,
          document.offsetAt(range.range.end),
        ),
        modelName: block.name,
        fields: modelFields,
        relatedFields: [],
      };
    }

    if (block?.kind === "enum") {
      return { kind: "enum-value" };
    }
    if (block?.kind !== "model" || fieldType === undefined) {
      return undefined;
    }

    if (hasArguments) {
      if (attributeName === "default") {
        return {
          kind: "default-value",
          source,
          offset,
          prefix: range.prefix,
          wordRange: range.range,
          fieldType,
          enumValues:
            fieldType.typeKind === "enum"
              ? [
                  ...(ast?.enums
                    .find((item) => item.name.name === fieldType.typeName)
                    ?.values.map((value) => value.name.name) ?? []),
                ]
              : [],
          fields: modelFields,
          relatedFields:
            relatedModel?.fields.map((field) => field.name.name) ?? [],
        };
      }
      if (attributeName === "relation") {
        const relationArgument = findRelationArgument(tokens, markerIndex + 1);
        if (
          relationArgument.hasColon &&
          (relationArgument.name === "fields" ||
            relationArgument.name === "references")
        ) {
          if (!hasClosedArrayAfter(tokens, relationArgument.colonOffset)) {
            return {
              kind: "relation-field",
              source,
              offset,
              prefix: range.prefix,
              wordRange: range.range,
              fields:
                relationArgument.name === "fields"
                  ? relationFields
                  : getRelationCandidateFields(relatedModel, ast),
              relatedFields: [],
              enumValues: [],
              argumentName: relationArgument.name,
            };
          }
        }

        if (
          relationArgument.hasColon &&
          relationArgument.name === "onSoftDelete"
        ) {
          return {
            kind: "relation-argument",
            source,
            offset,
            prefix: range.prefix,
            wordRange: range.range,
            enumValues: [],
            fields: modelFields,
            relatedFields:
              relatedModel?.fields.map((field) => field.name.name) ?? [],
            argumentName: relationArgument.name,
            availableArguments: [
              {
                name: "onSoftDelete",
                description:
                  "Policy applied when the related record is soft-deleted.",
                values: ["Cascade", "Restrict", "Nullify", "Ignore"],
              },
            ],
          };
        }
        if (relationArgument.hasColon && relationArgument.name === "name") {
          return {
            kind: "relation-argument",
            source,
            offset,
            prefix: range.prefix,
            wordRange: range.range,
            enumValues: [],
            fields: modelFields,
            relatedFields:
              relatedModel?.fields.map((field) => field.name.name) ?? [],
            argumentName: "name",
          };
        }
        return {
          kind: "relation-argument",
          source,
          offset,
          prefix: range.prefix,
          wordRange: range.range,
          enumValues: [],
          fields: modelFields,
          relatedFields:
            relatedModel?.fields.map((field) => field.name.name) ?? [],
          availableArguments:
            FIELD_ATTRIBUTE_DEFINITIONS.find((item) => item.name === "relation")
              ?.arguments ?? [],
        };
      }
      return undefined;
    }

    return {
      kind: "field-attribute",
      document,
      source,
      offset,
      marker,
      prefix: range.prefix,
      wordRange: range.range,
      hasArguments: hasOpeningParenthesisAfter(
        source,
        document.offsetAt(range.range.end),
      ),
      fieldType,
      modelName: block.name,
      fields: modelFields,
      relatedFields: relatedModel?.fields.map((field) => field.name.name) ?? [],
    };
  }

  if (block?.kind === "model") {
    const identifiers = lineTokens.filter(
      (token) => token.kind === TokenKind.Identifier,
    );
    if (identifiers.length >= 2) {
      const word = wordRangeAt(document, source, offset, 0);
      return {
        kind: "field-type",
        prefix: word.prefix,
        document,
        offset,
        ...(ast !== undefined ? { ast } : {}),
      };
    }
    return undefined;
  }
  if (block?.kind === "enum") {
    return { kind: "enum-value" };
  }

  const word = wordRangeAt(document, source, offset, 0);
  return { kind: "top-level", prefix: word.prefix, document, offset };
}

function findEnclosingBlock(
  tokens: readonly Token[],
): { readonly kind: "model" | "enum"; readonly name: string } | undefined {
  const stack: { kind: "model" | "enum"; name: string }[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind === TokenKind.LeftBrace) {
      const declaration = tokens[index - 2];
      const name = tokens[index - 1];
      if (
        (declaration?.kind === TokenKind.Model ||
          declaration?.kind === TokenKind.Enum) &&
        name?.kind === TokenKind.Identifier
      ) {
        stack.push({
          kind: declaration.kind === TokenKind.Model ? "model" : "enum",
          name: name.lexeme,
        });
      }
    } else if (token?.kind === TokenKind.RightBrace) {
      stack.pop();
    }
  }
  return stack.at(-1);
}

function findActiveAttributeMarker(
  tokens: readonly Token[],
  position: Position,
): Token | undefined {
  let closingParens = 0;
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (token === undefined) {
      continue;
    }
    if (token.kind === TokenKind.RightParen) {
      closingParens += 1;
    } else if (token.kind === TokenKind.LeftParen) {
      if (closingParens === 0) {
        for (let markerIndex = index - 1; markerIndex >= 0; markerIndex -= 1) {
          const candidate = tokens[markerIndex];
          if (
            candidate?.kind === TokenKind.At ||
            candidate?.kind === TokenKind.AtAt
          ) {
            return candidate;
          }
        }
        return undefined;
      }
      closingParens -= 1;
    } else if (
      closingParens === 0 &&
      (token.kind === TokenKind.At || token.kind === TokenKind.AtAt) &&
      token.loc.start.line === position.line + 1
    ) {
      return token;
    }
  }
  return undefined;
}

function findCurrentField(
  model: SchemaAST["models"][number] | undefined,
  lineTokens: readonly Token[],
  marker: Token,
  ast: SchemaAST | undefined,
): { readonly type: FieldTypeContext } | undefined {
  const fieldName = lineTokens.find(
    (token) =>
      token.kind === TokenKind.Identifier &&
      token.loc.start.offset < marker.loc.start.offset,
  )?.lexeme;
  const field = model?.fields.find((item) => item.name.name === fieldName);
  if (field !== undefined) {
    const named = getNamedType(field.fieldType);
    if (named === undefined) {
      return undefined;
    }
    const isList =
      isListType(field.fieldType) ||
      (isOptionalType(field.fieldType) &&
        isListType(field.fieldType.innerType));
    const isOptional =
      isOptionalType(field.fieldType) ||
      (isListType(field.fieldType) &&
        isOptionalType(field.fieldType.elementType));
    return {
      type: {
        typeName: named.name.name,
        typeKind: getFieldTypeKind(named.name.name, model, ast),
        isList,
        isOptional,
      },
    };
  }
  return undefined;
}

function inferFieldTypeFromTokens(
  lineTokens: readonly Token[],
  marker: Token,
  _attributeNameToken: Token | undefined,
  ast: SchemaAST | undefined,
  modelName: string | undefined,
): FieldTypeContext | undefined {
  const before = lineTokens.filter(
    (token) => token.loc.start.offset < marker.loc.start.offset,
  );
  const identifiers = before.filter(
    (token) => token.kind === TokenKind.Identifier,
  );
  const typeToken = identifiers[1];
  if (typeToken === undefined) {
    return undefined;
  }
  const typeName = typeToken.lexeme;
  const model = ast?.models.find((item) => item.name.name === modelName);
  return {
    typeName,
    typeKind: getFieldTypeKind(typeName, model, ast),
    isList: before.some((token) => token.kind === TokenKind.LeftBracket),
    isOptional: before.some((token) => token.kind === TokenKind.Question),
  };
}

function getFieldTypeKind(
  typeName: string,
  model?: SchemaAST["models"][number],
  ast?: SchemaAST,
): FieldTypeContext["typeKind"] {
  if (
    ALL_SCALAR_TYPES.includes(typeName as (typeof ALL_SCALAR_TYPES)[number])
  ) {
    return "scalar";
  }
  if (ast?.enums.some((item) => item.name.name === typeName)) {
    return "enum";
  }
  if (ast?.models.some((item) => item.name.name === typeName)) {
    return "model";
  }
  if (
    model?.fields.some(
      (field) => getNamedType(field.fieldType)?.name.name === typeName,
    )
  ) {
    return "model";
  }
  return "unknown";
}

function getRelationCandidateFields(
  model: SchemaAST["models"][number] | undefined,
  ast: SchemaAST | undefined,
): string[] {
  if (model === undefined) {
    return [];
  }
  return model.fields
    .filter((field) => {
      const named = getNamedType(field.fieldType);
      const isList =
        isListType(field.fieldType) ||
        (isOptionalType(field.fieldType) &&
          isListType(field.fieldType.innerType));
      if (named === undefined || isList) {
        return false;
      }
      const typeKind = getFieldTypeKind(named.name.name, model, ast);
      return typeKind === "scalar" || typeKind === "enum";
    })
    .map((field) => field.name.name);
}

function findRelationArgument(
  tokens: readonly Token[],
  afterAttributeName: number,
): {
  readonly name?: string;
  readonly colonOffset: number;
  readonly hasColon: boolean;
} {
  const argsStart = tokens.findIndex(
    (token, index) =>
      index > afterAttributeName && token.kind === TokenKind.LeftParen,
  );
  if (argsStart < 0) {
    return { colonOffset: 0, hasColon: false };
  }
  let candidateName: string | undefined;
  let currentName: string | undefined;
  let bracketDepth = 0;
  let hasColon = false;
  let colonOffset = tokens[argsStart]?.loc.end.offset ?? 0;
  for (const token of tokens.slice(argsStart + 1)) {
    if (token.kind === TokenKind.LeftBracket) {
      bracketDepth += 1;
    } else if (token.kind === TokenKind.RightBracket) {
      bracketDepth = Math.max(0, bracketDepth - 1);
    } else if (token.kind === TokenKind.Comma && bracketDepth === 0) {
      candidateName = undefined;
      currentName = undefined;
      hasColon = false;
      colonOffset = token.loc.end.offset;
    } else if (
      bracketDepth === 0 &&
      token.kind === TokenKind.Identifier &&
      candidateName === undefined &&
      !hasColon
    ) {
      candidateName = token.lexeme;
    } else if (
      bracketDepth === 0 &&
      token.kind === TokenKind.Colon &&
      candidateName !== undefined
    ) {
      currentName = candidateName;
      candidateName = undefined;
      hasColon = true;
      colonOffset = token.loc.end.offset;
    }
  }
  const name = currentName ?? candidateName;
  return {
    ...(name !== undefined ? { name } : {}),
    colonOffset,
    hasColon,
  };
}

function hasClosedArrayAfter(
  tokens: readonly Token[],
  startOffset: number,
): boolean {
  let depth = 0;
  let foundArray = false;
  for (const token of tokens) {
    if (token.loc.start.offset <= startOffset) {
      continue;
    }
    if (token.kind === TokenKind.LeftBracket) {
      foundArray = true;
      depth += 1;
    } else if (token.kind === TokenKind.RightBracket && foundArray) {
      depth -= 1;
      if (depth <= 0) {
        return true;
      }
    }
  }
  return false;
}

function getFieldAttributeDefinitions(
  fieldType: FieldTypeContext | undefined,
): readonly AttributeDefinition[] {
  if (fieldType === undefined) {
    return [];
  }
  return FIELD_ATTRIBUTE_DEFINITIONS.filter((attribute) => {
    switch (attribute.name) {
      case "id":
      case "unique":
        return (
          !fieldType.isList &&
          (fieldType.typeKind === "scalar" || fieldType.typeKind === "enum")
        );
      case "default":
        return (
          !fieldType.isList &&
          (fieldType.typeKind === "scalar" || fieldType.typeKind === "enum")
        );
      case "updatedAt":
        return fieldType.typeName === "DateTime" && !fieldType.isList;
      case "relation":
        return fieldType.typeKind === "model" && !fieldType.isList;
      default:
        return false;
    }
  });
}

function createAttributeCompletions(
  context: AttributeCompletionContext,
  definitions: readonly AttributeDefinition[],
): CompletionItem[] {
  return definitions
    .filter((definition) =>
      definition.name.toLowerCase().startsWith(context.prefix.toLowerCase()),
    )
    .map((definition) => {
      const label = `${context.marker.kind === TokenKind.AtAt ? "@@" : "@"}${definition.name}`;
      const snippet = definition.snippet;
      const newText =
        snippet !== undefined && !context.hasArguments
          ? snippet
          : definition.name;
      return {
        label,
        filterText: definition.name,
        kind:
          context.marker.kind === TokenKind.AtAt
            ? CompletionItemKind.Property
            : CompletionItemKind.Keyword,
        documentation: definition.description,
        textEdit: {
          range: context.wordRange,
          newText,
        },
        ...(snippet !== undefined && !context.hasArguments
          ? { insertTextFormat: InsertTextFormat.Snippet }
          : {}),
        sortText: definition.name,
      };
    });
}

function createDefaultCompletions(
  context: ArgumentCompletionContext,
): CompletionItem[] {
  const type = context.fieldType;
  if (type === undefined) {
    return [];
  }
  const values: {
    label: string;
    text: string;
    description: string;
    snippet?: boolean;
  }[] = [];
  if (type.isOptional) {
    values.push({
      label: "null",
      text: "null",
      description: "Use a null default.",
    });
  }
  if (type.typeKind === "enum") {
    for (const value of context.enumValues) {
      values.push({
        label: value,
        text: value,
        description: `Use the ${value} enum value.`,
      });
    }
  } else {
    switch (type.typeName) {
      case "String":
        values.push(
          {
            label: '""',
            text: '"${1:value}"',
            description: "Use a string literal.",
            snippet: true,
          },
          ...DEFAULT_FUNCTION_DEFINITIONS.filter((item) =>
            item.fieldTypes.some((fieldType) => fieldType === "String"),
          ).map((item) => ({
            label: `${item.name}()`,
            text: `${item.name}()`,
            description: item.description,
          })),
        );
        break;
      case "DateTime":
        values.push({
          label: "now()",
          text: "now()",
          description: "Use the current date and time.",
        });
        break;
      case "Int":
      case "BigInt":
        values.push({
          label: "0",
          text: "0",
          description: "Use an integer literal.",
        });
        break;
      case "Float":
      case "Decimal":
        values.push({
          label: "0.0",
          text: "0.0",
          description: "Use a numeric literal.",
        });
        break;
      case "Boolean":
        values.push(
          {
            label: "true",
            text: "true",
            description: "Use the boolean value true.",
          },
          {
            label: "false",
            text: "false",
            description: "Use the boolean value false.",
          },
        );
        break;
      case "Json":
        values.push(
          {
            label: "null",
            text: "null",
            description: "Use a JSON null value.",
          },
          {
            label: "true",
            text: "true",
            description: "Use a JSON boolean value.",
          },
          {
            label: "false",
            text: "false",
            description: "Use a JSON boolean value.",
          },
          { label: "0", text: "0", description: "Use a JSON numeric value." },
          {
            label: '""',
            text: '"${1:value}"',
            description: "Use a JSON string value.",
            snippet: true,
          },
        );
        break;
    }
  }
  return values
    .filter((item) =>
      item.label.toLowerCase().startsWith(context.prefix.toLowerCase()),
    )
    .map((item) => ({
      label: item.label,
      kind: item.label.endsWith("()")
        ? CompletionItemKind.Function
        : CompletionItemKind.Value,
      documentation: item.description,
      textEdit: { range: context.wordRange, newText: item.text },
      ...(item.snippet ? { insertTextFormat: InsertTextFormat.Snippet } : {}),
    }));
}

function createRelationArgumentCompletions(
  context: ArgumentCompletionContext,
): CompletionItem[] {
  if (context.argumentName === "onSoftDelete") {
    return (context.availableArguments?.[0]?.values ?? [])
      .filter((value) =>
        value.toLowerCase().startsWith(context.prefix.toLowerCase()),
      )
      .map((value) => ({
        label: value,
        kind: CompletionItemKind.EnumMember,
        documentation: "Supported relational soft-delete policy.",
        textEdit: { range: context.wordRange, newText: value },
      }));
  }
  if (context.argumentName === "name") {
    return [
      {
        label: "relation name",
        kind: CompletionItemKind.Value,
        documentation: "Set an optional relation name.",
        textEdit: { range: context.wordRange, newText: '"${1:relationName}"' },
        insertTextFormat: InsertTextFormat.Snippet,
      },
    ];
  }

  const alreadyPresent = new Set<string>();
  const textBefore = context.source.slice(0, context.offset);
  for (const arg of ["fields", "references", "name", "onSoftDelete"]) {
    if (new RegExp(`\\b${arg}\\s*:`).test(textBefore)) {
      alreadyPresent.add(arg);
    }
  }
  const definitions =
    context.availableArguments ??
    FIELD_ATTRIBUTE_DEFINITIONS.find((item) => item.name === "relation")
      ?.arguments ??
    [];
  return definitions
    .filter(
      (argument) =>
        !alreadyPresent.has(argument.name) &&
        argument.name.toLowerCase().startsWith(context.prefix.toLowerCase()),
    )
    .map((argument) => ({
      label: `${argument.name}:`,
      filterText: argument.name,
      kind: CompletionItemKind.Property,
      documentation: argument.description,
      textEdit: {
        range: context.wordRange,
        newText:
          argument.name === "fields" || argument.name === "references"
            ? `${argument.name}: [$1]`
            : argument.name === "name"
              ? `${argument.name}: "$1"`
              : `${argument.name}: $1`,
      },
      insertTextFormat: InsertTextFormat.Snippet,
    }));
}

function createFieldNameCompletions(
  fields: readonly string[],
  prefix: string,
  range: Range,
): CompletionItem[] {
  return fields
    .filter((field) => field.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((field) => ({
      label: field,
      kind: CompletionItemKind.Field,
      documentation: "Field declared in the relevant model.",
      textEdit: { range, newText: field },
    }));
}

function createTypeCompletions(
  context: FieldTypeCompletionContext,
): CompletionItem[] {
  const typeNames = [
    ...ALL_SCALAR_TYPES,
    ...(context.ast?.models.map((model) => model.name.name) ?? []),
    ...(context.ast?.enums.map((enumNode) => enumNode.name.name) ?? []),
  ];
  const word = wordRangeAt(
    context.document,
    context.document.getText(),
    context.offset,
    0,
  );
  return [...new Set(typeNames)]
    .filter((name) => name.toLowerCase().startsWith(word.prefix.toLowerCase()))
    .map((name) => ({
      label: name,
      kind: ALL_SCALAR_TYPES.includes(name as (typeof ALL_SCALAR_TYPES)[number])
        ? CompletionItemKind.Class
        : CompletionItemKind.Reference,
      textEdit: { range: word.range, newText: name },
    }));
}

function createTopLevelCompletions(prefix: string): CompletionItem[] {
  return [
    {
      label: "model",
      detail: "Model declaration",
      documentation: "Declare a database model.",
      insertText: "model ${1:Model} {\n\t$0\n}",
    },
    {
      label: "enum",
      detail: "Enum declaration",
      documentation: "Declare an enum type.",
      insertText: "enum ${1:Name} {\n\t$0\n}",
    },
    {
      label: "datasource",
      detail: "Datasource declaration",
      documentation: "Configure a database datasource.",
      insertText:
        'datasource ${1:db} {\n\tprovider = "${2:postgresql}"\n\turl = env("${3:DATABASE_URL}")\n}',
    },
    {
      label: "generator",
      detail: "Generator declaration",
      documentation: "Configure a Zed client generator.",
      insertText: 'generator ${1:client} {\n\tprovider = "${2:zed-client}"\n}',
    },
  ]
    .filter((item) => item.label.startsWith(prefix))
    .map((item) => ({
      ...item,
      kind: CompletionItemKind.Keyword,
      insertTextFormat: InsertTextFormat.Snippet,
    }));
}

function wordRangeAt(
  document: TextDocument,
  source: string,
  offset: number,
  lowerBound: number,
): { readonly prefix: string; readonly range: Range } {
  let start = offset;
  let end = offset;
  while (start > lowerBound && isIdentifierCharacter(source[start - 1] ?? "")) {
    start -= 1;
  }
  while (end < source.length && isIdentifierCharacter(source[end] ?? "")) {
    end += 1;
  }
  return {
    prefix: source.slice(start, offset),
    range: { start: document.positionAt(start), end: document.positionAt(end) },
  };
}

function isIdentifierCharacter(character: string): boolean {
  return (
    (character >= "a" && character <= "z") ||
    (character >= "A" && character <= "Z") ||
    (character >= "0" && character <= "9") ||
    character === "_"
  );
}

function hasOpeningParenthesisAfter(
  source: string,
  nameEndOffset: number,
): boolean {
  let next = nameEndOffset;
  while (next < source.length && /\s/.test(source[next] ?? "")) {
    next += 1;
  }
  return next < source.length && source[next] === "(";
}

function isInsideCommentOrString(source: string, offset: number): boolean {
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < offset; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
      }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else if (current === '"') {
      inString = true;
    }
  }
  return inString || lineComment || blockComment;
}

function recoverCompletionAst(
  source: string,
  attributeStart: number | undefined,
): SchemaAST | undefined {
  if (attributeStart === undefined) {
    return undefined;
  }
  const expressionEnd = findAttributeExpressionEnd(source, attributeStart);
  const recoveredSource =
    source.slice(0, attributeStart) + source.slice(expressionEnd);
  let openBraces = 0;
  try {
    for (const token of tokenize(recoveredSource)) {
      if (token.kind === TokenKind.LeftBrace) {
        openBraces += 1;
      } else if (token.kind === TokenKind.RightBrace) {
        openBraces -= 1;
      }
    }
    return parseSchema(
      recoveredSource + "\n" + "}".repeat(Math.max(0, openBraces)),
    );
  } catch {
    return undefined;
  }
}

function findAttributeExpressionEnd(source: string, start: number): number {
  let parenDepth = 0;
  let sawArgumentList = false;
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const current = source[index] ?? "";
    const next = source[index + 1] ?? "";
    if (lineComment) {
      if (current === "\n") {
        lineComment = false;
        if (!sawArgumentList) {
          return index;
        }
      }
      continue;
    }
    if (blockComment) {
      if (current === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (current === "\\") {
        escaped = true;
      } else if (current === '"') {
        inString = false;
      }
      continue;
    }
    if (current === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (current === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else if (current === '"') {
      inString = true;
    } else if (current === "(") {
      sawArgumentList = true;
      parenDepth += 1;
    } else if (current === ")" && sawArgumentList) {
      parenDepth -= 1;
      if (parenDepth === 0) {
        return index + 1;
      }
    } else if (current === "}" && sawArgumentList) {
      return index;
    } else if (current === "\n" && !sawArgumentList) {
      return index;
    }
  }
  return source.length;
}

export function computeSemanticTokens(
  document: TextDocument,
  ast = analyzeSchemaSource(document.getText(), document.uri).ast,
): SemanticTokens {
  const tokenEntries = collectSemanticTokenEntries(ast, document.getText());
  const data: number[] = [];
  let previousLine = 0;
  let previousCharacter = 0;

  for (const token of tokenEntries) {
    const startLine = token.start.line;
    const startCharacter = token.start.character;
    const deltaLine = startLine - previousLine;
    const deltaStart =
      deltaLine === 0 ? startCharacter - previousCharacter : startCharacter;

    const tokenTypeIndex = tokenTypeIndexForName(token.tokenType);
    const modifierBits = token.modifiers
      .map((modifier) => modifierIndexForName(modifier))
      .filter((index) => index >= 0)
      .reduce((sum, value) => sum + (1 << value), 0);

    data.push(
      deltaLine,
      deltaStart,
      token.end.character - token.start.character,
      tokenTypeIndex,
      modifierBits,
    );

    previousLine = startLine;
    previousCharacter = startCharacter;
  }

  return { data };
}

export function createLanguageServer(
  connection = createConnection(ProposedFeatures.all),
) {
  const documents = new TextDocuments(TextDocument);
  const manager = createDocumentManager();

  connection.onInitialize((params): InitializeResult => {
    developmentLoggingEnabled =
      process.env.ZED_ORM_LSP_DEBUG === "1" ||
      hasDebugInitializationOption(params.initializationOptions);
    debugLog("Language server initialized.");
    return {
      capabilities: {
        completionProvider: {
          resolveProvider: false,
          triggerCharacters: ["@", ".", ":", "(", ",", "["],
        },
        definitionProvider: true,
        hoverProvider: true,
        semanticTokensProvider: {
          legend: getSemanticTokensLegend(),
          full: { delta: false },
        },
        textDocumentSync: TextDocumentSyncKind.Incremental,
      },
    };
  });

  documents.onDidOpen((event) => {
    manager.open(event.document);
    debugLog(`Opened ${event.document.uri}.`);
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: computeDiagnostics(event.document),
    });
  });

  documents.onDidChangeContent((event) => {
    manager.update(event.document);
    debugLog(`Updated ${event.document.uri}.`);
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: computeDiagnostics(event.document),
    });
  });

  documents.onDidClose((event) => {
    manager.close(event.document.uri);
    connection.sendDiagnostics({
      uri: event.document.uri,
      diagnostics: [],
    });
  });

  connection.onCompletion((params) => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
      debugLog(
        `Completion request for unopened document ${params.textDocument.uri}.`,
      );
      return CompletionList.create([], false);
    }
    try {
      const completions = computeCompletionItems(document, params.position);
      return CompletionList.create(completions, false);
    } catch (error) {
      connection.console.error(
        `Zed ORM completion failed for ${document.uri}: ${errorMessage(error)}`,
      );
      throw error;
    }
  });

  connection.languages.semanticTokens.on((params) => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
      return { data: [] };
    }
    return computeSemanticTokens(document);
  });

  connection.onHover((params) => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
      return undefined;
    }
    const analysis = analyzeSchemaSource(document.getText(), document.uri);
    if (analysis.ast === undefined) {
      return undefined;
    }
    return {
      contents: {
        kind: "markdown",
        value: "Zed ORM schema: validated by the parser and schema validator.",
      },
    };
  });

  documents.listen(connection);
  return connection;
}

function convertErrorToDiagnostic(
  error: unknown,
  source: string,
  fileName: string,
): Diagnostic | undefined {
  const shape = asErrorShape(error);
  if (shape === undefined) {
    return undefined;
  }

  const range = normalizeErrorRange(shape, source, fileName);
  return {
    severity: DiagnosticSeverity.Error,
    range,
    message: shape.message.split("\n\n").at(1) ?? shape.message,
    source: "zed-orm",
  };
}

function asErrorShape(error: unknown): ErrorShape | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const candidate = error as Partial<ErrorShape>;
  if (
    typeof candidate.message !== "string" ||
    (typeof candidate.line !== "number" && candidate.line !== undefined) ||
    (typeof candidate.column !== "number" && candidate.column !== undefined)
  ) {
    return undefined;
  }

  return {
    message: candidate.message,
    ...(candidate.line !== undefined ? { line: candidate.line } : {}),
    ...(candidate.column !== undefined ? { column: candidate.column } : {}),
    ...(candidate.fileName !== undefined
      ? { fileName: candidate.fileName }
      : {}),
    ...(candidate.span !== undefined ? { span: candidate.span } : {}),
  };
}

interface ErrorShape {
  readonly message: string;
  readonly line?: number;
  readonly column?: number;
  readonly fileName?: string;
  readonly span?: {
    readonly start: { readonly line: number; readonly column: number };
    readonly end: { readonly line: number; readonly column: number };
  };
}

function normalizeErrorRange(
  shape: ErrorShape,
  _source: string,
  _fallbackFileName: string,
): Range {
  const startLine = Math.max(
    0,
    Math.min((shape.span?.start.line ?? shape.line ?? 1) - 1, 999999),
  );
  const startColumn = Math.max(
    0,
    (shape.span?.start.column ?? shape.column ?? 1) - 1,
  );
  const endLine = Math.max(
    startLine,
    (shape.span?.end.line ?? shape.line ?? 1) - 1,
  );
  const endColumn = Math.max(
    startColumn + 1,
    (shape.span?.end.column ?? startColumn + 1) - 1,
  );

  return {
    start: { line: startLine, character: startColumn },
    end: { line: endLine, character: endColumn },
  };
}

function hasDebugInitializationOption(value: unknown): boolean {
  if (typeof value !== "object" || value === null || !("debug" in value)) {
    return false;
  }
  return value.debug === true;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function debugLog(message: string): void {
  if (developmentLoggingEnabled) {
    console.error(`[zed-orm] ${message}`);
  }
}

function collectSemanticTokenEntries(
  ast: SchemaAST | undefined,
  source: string,
): SemanticTokenEntry[] {
  const entries: SemanticTokenEntry[] = [];

  if (ast === undefined) {
    return entries;
  }

  for (const model of ast.models) {
    addNamedToken(entries, model.name, "class", ["declaration"]);
    for (const field of model.fields) {
      addNamedToken(entries, field.name, "property", ["declaration"]);
      addTypeTokens(entries, field.fieldType, source);
      for (const attribute of field.attributes) {
        addNamedToken(entries, attribute.name, "decorator", ["declaration"]);
      }
    }
    for (const attribute of model.attributes) {
      addNamedToken(entries, attribute.name, "decorator", ["declaration"]);
    }
  }

  for (const enumNode of ast.enums) {
    addNamedToken(entries, enumNode.name, "enum", ["declaration"]);
    for (const value of enumNode.values) {
      addNamedToken(entries, value.name, "enumMember", ["declaration"]);
    }
  }

  for (const datasource of ast.datasources) {
    addNamedToken(entries, datasource.name, "type", ["declaration"]);
  }

  for (const generator of ast.generators) {
    addNamedToken(entries, generator.name, "type", ["declaration"]);
  }

  return entries.sort((left, right) =>
    left.start.line !== right.start.line
      ? left.start.line - right.start.line
      : left.start.character - right.start.character,
  );
}

function addNamedToken(
  entries: SemanticTokenEntry[],
  identifier: {
    readonly loc: {
      readonly start: { readonly line: number; readonly column: number };
      readonly end: { readonly line: number; readonly column: number };
    };
  },
  tokenType: string,
  modifiers: readonly string[],
) {
  entries.push({
    start: {
      line: identifier.loc.start.line - 1,
      character: identifier.loc.start.column - 1,
    },
    end: {
      line: identifier.loc.end.line - 1,
      character: identifier.loc.end.column - 1,
    },
    tokenType,
    modifiers,
  });
}

function addTypeTokens(
  entries: SemanticTokenEntry[],
  typeNode: TypeNode,
  source: string,
) {
  if (isNamedType(typeNode)) {
    const name = typeNode.name.name;
    addNamedToken(entries, typeNode.name, "type", ["definition"]);
    if (
      name !== "String" &&
      name !== "Int" &&
      name !== "BigInt" &&
      name !== "Float" &&
      name !== "Decimal" &&
      name !== "Boolean" &&
      name !== "DateTime" &&
      name !== "Json" &&
      name !== "Bytes"
    ) {
      addNamedToken(entries, typeNode.name, "type", ["definition"]);
    }
    return;
  }

  if (isListType(typeNode)) {
    addTypeTokens(entries, typeNode.elementType, source);
  }

  if (isOptionalType(typeNode)) {
    addTypeTokens(entries, typeNode.innerType, source);
  }
}

function tokenTypeIndexForName(name: string): number {
  const types = getSemanticTokensLegend().tokenTypes;
  const index = types.indexOf(name as (typeof types)[number]);
  return index >= 0 ? index : 0;
}

function modifierIndexForName(name: string): number {
  const modifiers = getSemanticTokensLegend().tokenModifiers;
  return modifiers.indexOf(name as (typeof modifiers)[number]);
}

if (process.argv[1] && /server\.(cjs|js)$/.test(process.argv[1])) {
  createLanguageServer().listen();
}
