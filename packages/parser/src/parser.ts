import {
  createArrayExpression,
  createAttributeArg,
  createBlockAttribute,
  createBooleanLiteral,
  createConfigEntry,
  createDatasource,
  createEnum,
  createEnumValue,
  createField,
  createFieldAttribute,
  createFunctionCall,
  createGenerator,
  createIdentifier,
  createListType,
  createModel,
  createNamedType,
  createNullLiteral,
  createNumericLiteral,
  createOptionalType,
  createPathExpression,
  createSchema,
  createStringLiteral,
  type AttributeArgNode,
  type BlockAttributeNode,
  type ConfigEntryNode,
  type DatasourceNode,
  type EnumNode,
  type EnumValueNode,
  type ExpressionNode,
  type FieldAttributeNode,
  type FieldNode,
  type GeneratorNode,
  type IdentifierNode,
  type ModelNode,
  type SchemaAST,
  type SourceSpan,
  type TypeNode,
} from "@zed-orm/ast";
import { ParseError } from "./errors.js";
import { Lexer } from "./lexer.js";
import { TokenKind, type Token } from "./tokens.js";

export interface ParseSchemaOptions {
  readonly fileName?: string;
}

/**
 * Recursive-descent parser producing `@zed-orm/ast` nodes.
 * Performs syntax analysis only — no semantic validation.
 */
export class Parser {
  private readonly tokens: Token[];
  private readonly fileName?: string;
  private current = 0;

  constructor(tokens: Token[], options: ParseSchemaOptions = {}) {
    this.tokens = tokens;
    if (options.fileName !== undefined) {
      this.fileName = options.fileName;
    }
  }

  parse(): SchemaAST {
    const start = this.peek().loc.start;
    const datasources: DatasourceNode[] = [];
    const generators: GeneratorNode[] = [];
    const models: ModelNode[] = [];
    const enums: EnumNode[] = [];

    while (!this.isAtEnd()) {
      if (this.check(TokenKind.Datasource)) {
        datasources.push(this.parseDatasource());
      } else if (this.check(TokenKind.Generator)) {
        generators.push(this.parseGenerator());
      } else if (this.check(TokenKind.Model)) {
        models.push(this.parseModel());
      } else if (this.check(TokenKind.Enum)) {
        enums.push(this.parseEnum());
      } else {
        const token = this.peek();
        throw this.error(
          `Unexpected token '${token.lexeme}'. Expected a top-level declaration (datasource, generator, model, or enum).`,
          token.loc,
        );
      }
    }

    return createSchema(
      { datasources, generators, models, enums },
      this.spanFrom(start, this.previous().loc.end),
    );
  }

  private parseDatasource(): DatasourceNode {
    const start = this.advance().loc.start; // datasource
    const name = this.parseIdentifier();
    this.expect(TokenKind.LeftBrace, "Expected '{' after datasource name.");
    const config: ConfigEntryNode[] = [];
    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      config.push(this.parseConfigEntry());
    }
    const endToken = this.expect(
      TokenKind.RightBrace,
      "Expected '}' to close datasource.",
    );
    return createDatasource(
      name,
      config,
      this.spanFrom(start, endToken.loc.end),
    );
  }

  private parseGenerator(): GeneratorNode {
    const start = this.advance().loc.start; // generator
    const name = this.parseIdentifier();
    this.expect(TokenKind.LeftBrace, "Expected '{' after generator name.");
    const config: ConfigEntryNode[] = [];
    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      config.push(this.parseConfigEntry());
    }
    const endToken = this.expect(
      TokenKind.RightBrace,
      "Expected '}' to close generator.",
    );
    return createGenerator(
      name,
      config,
      this.spanFrom(start, endToken.loc.end),
    );
  }

  private parseConfigEntry(): ConfigEntryNode {
    const key = this.parseIdentifier();
    this.expect(TokenKind.Equals, "Expected '=' in configuration entry.");
    const value = this.parseExpression();
    return createConfigEntry(
      key,
      value,
      this.spanFrom(key.loc.start, value.loc.end),
    );
  }

  private parseModel(): ModelNode {
    const start = this.advance().loc.start; // model
    const name = this.parseIdentifier();
    this.expect(TokenKind.LeftBrace, "Expected '{' after model name.");

    const fields: FieldNode[] = [];
    const attributes: BlockAttributeNode[] = [];

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.AtAt)) {
        attributes.push(this.parseBlockAttribute());
      } else {
        fields.push(this.parseField());
      }
    }

    const endToken = this.expect(
      TokenKind.RightBrace,
      "Expected '}' to close model.",
    );
    return createModel(
      name,
      fields,
      attributes,
      this.spanFrom(start, endToken.loc.end),
    );
  }

  private parseEnum(): EnumNode {
    const start = this.advance().loc.start; // enum
    const name = this.parseIdentifier();
    this.expect(TokenKind.LeftBrace, "Expected '{' after enum name.");

    const values: EnumValueNode[] = [];
    const attributes: BlockAttributeNode[] = [];

    while (!this.check(TokenKind.RightBrace) && !this.isAtEnd()) {
      if (this.check(TokenKind.AtAt)) {
        attributes.push(this.parseBlockAttribute());
      } else {
        values.push(this.parseEnumValue());
      }
    }

    const endToken = this.expect(
      TokenKind.RightBrace,
      "Expected '}' to close enum.",
    );
    return createEnum(
      name,
      values,
      attributes,
      this.spanFrom(start, endToken.loc.end),
    );
  }

  private parseEnumValue(): EnumValueNode {
    const name = this.parseIdentifier();
    const attributes: FieldAttributeNode[] = [];
    while (this.check(TokenKind.At)) {
      attributes.push(this.parseFieldAttribute());
    }
    const end =
      attributes.length > 0
        ? (attributes[attributes.length - 1]?.loc.end ?? name.loc.end)
        : name.loc.end;
    return createEnumValue(
      name,
      attributes,
      this.spanFrom(name.loc.start, end),
    );
  }

  private parseField(): FieldNode {
    const name = this.parseIdentifier();
    const fieldType = this.parseType();
    const attributes: FieldAttributeNode[] = [];
    while (this.check(TokenKind.At)) {
      attributes.push(this.parseFieldAttribute());
    }
    const end =
      attributes.length > 0
        ? (attributes[attributes.length - 1]?.loc.end ?? fieldType.loc.end)
        : fieldType.loc.end;
    return createField(
      name,
      fieldType,
      attributes,
      this.spanFrom(name.loc.start, end),
    );
  }

  /**
   * Type := NamedType ( '[]' )? ( '?' )?
   *
   * Optional applies to the whole type including list (`Post[]?`).
   */
  private parseType(): TypeNode {
    const named = this.parseNamedType();
    let type: TypeNode = named;

    if (this.match(TokenKind.LeftBracket)) {
      const endToken = this.expect(
        TokenKind.RightBracket,
        "Expected ']' after list type.",
      );
      type = createListType(
        type,
        this.spanFrom(named.loc.start, endToken.loc.end),
      );
    }

    if (this.match(TokenKind.Question)) {
      const question = this.previous();
      type = createOptionalType(
        type,
        this.spanFrom(named.loc.start, question.loc.end),
      );
    }

    return type;
  }

  private parseNamedType(): TypeNode {
    const name = this.parseIdentifier();
    return createNamedType(name, name.loc);
  }

  private parseFieldAttribute(): FieldAttributeNode {
    const at = this.expect(TokenKind.At, "Expected '@'.");
    const name = this.parseIdentifier();
    let args: AttributeArgNode[] = [];
    let end = name.loc.end;

    if (this.match(TokenKind.LeftParen)) {
      args = this.parseAttributeArgs();
      const close = this.expect(
        TokenKind.RightParen,
        "Expected ')' after attribute arguments.",
      );
      end = close.loc.end;
    }

    return createFieldAttribute(name, args, this.spanFrom(at.loc.start, end));
  }

  private parseBlockAttribute(): BlockAttributeNode {
    const atat = this.expect(TokenKind.AtAt, "Expected '@@'.");
    const name = this.parseIdentifier();
    let args: AttributeArgNode[] = [];
    let end = name.loc.end;

    if (this.match(TokenKind.LeftParen)) {
      args = this.parseAttributeArgs();
      const close = this.expect(
        TokenKind.RightParen,
        "Expected ')' after attribute arguments.",
      );
      end = close.loc.end;
    }

    return createBlockAttribute(name, args, this.spanFrom(atat.loc.start, end));
  }

  private parseAttributeArgs(): AttributeArgNode[] {
    if (this.check(TokenKind.RightParen)) {
      return [];
    }

    const args: AttributeArgNode[] = [];
    do {
      args.push(this.parseAttributeArg());
    } while (this.match(TokenKind.Comma));

    return args;
  }

  private parseAttributeArg(): AttributeArgNode {
    // Named argument: ident ':' expression
    if (this.check(TokenKind.Identifier) && this.checkNext(TokenKind.Colon)) {
      const name = this.parseIdentifier();
      this.advance(); // :
      const value = this.parseExpression();
      return createAttributeArg(
        value,
        this.spanFrom(name.loc.start, value.loc.end),
        name,
      );
    }

    const value = this.parseExpression();
    return createAttributeArg(value, value.loc);
  }

  private parseExpression(): ExpressionNode {
    if (this.check(TokenKind.String)) {
      const token = this.advance();
      return createStringLiteral(token.lexeme, token.loc);
    }
    if (this.check(TokenKind.Number)) {
      const token = this.advance();
      return createNumericLiteral(token.lexeme, token.loc);
    }
    if (this.check(TokenKind.True) || this.check(TokenKind.False)) {
      const token = this.advance();
      return createBooleanLiteral(token.kind === TokenKind.True, token.loc);
    }
    if (this.check(TokenKind.Null)) {
      const token = this.advance();
      return createNullLiteral(token.loc);
    }
    if (this.check(TokenKind.LeftBracket)) {
      return this.parseArrayExpression();
    }
    if (this.check(TokenKind.Identifier)) {
      return this.parseIdentifierExpression();
    }

    const token = this.peek();
    throw this.error(
      `Unexpected token '${token.lexeme}' in expression.`,
      token.loc,
    );
  }

  private parseArrayExpression(): ExpressionNode {
    const startToken = this.advance(); // [
    const elements: ExpressionNode[] = [];

    if (!this.check(TokenKind.RightBracket)) {
      do {
        elements.push(this.parseExpression());
      } while (this.match(TokenKind.Comma));
    }

    const endToken = this.expect(
      TokenKind.RightBracket,
      "Expected ']' after array expression.",
    );
    return createArrayExpression(
      elements,
      this.spanFrom(startToken.loc.start, endToken.loc.end),
    );
  }

  /**
   * Identifier, path (a.b), or function call (uuid()).
   */
  private parseIdentifierExpression(): ExpressionNode {
    const first = this.parseIdentifier();

    if (this.match(TokenKind.LeftParen)) {
      const args: ExpressionNode[] = [];
      if (!this.check(TokenKind.RightParen)) {
        do {
          args.push(this.parseExpression());
        } while (this.match(TokenKind.Comma));
      }
      const close = this.expect(
        TokenKind.RightParen,
        "Expected ')' after function arguments.",
      );
      return createFunctionCall(
        first,
        args,
        this.spanFrom(first.loc.start, close.loc.end),
      );
    }

    if (this.check(TokenKind.Dot)) {
      const segments: IdentifierNode[] = [first];
      while (this.match(TokenKind.Dot)) {
        segments.push(this.parseIdentifier());
      }
      const last = segments[segments.length - 1];
      if (last === undefined) {
        throw this.error("Invalid path expression.", first.loc);
      }
      return createPathExpression(
        segments,
        this.spanFrom(first.loc.start, last.loc.end),
      );
    }

    return first;
  }

  private parseIdentifier(): IdentifierNode {
    // Allow keyword tokens reused as identifiers in limited contexts? Prefer strict:
    // identifiers only. Type names like String are identifiers, not keywords.
    const token = this.expect(TokenKind.Identifier, "Expected identifier.");
    return createIdentifier(token.lexeme, token.loc);
  }

  private expect(kind: Token["kind"], message: string): Token {
    if (this.check(kind)) {
      return this.advance();
    }
    const token = this.peek();
    throw this.error(message, token.loc);
  }

  private match(kind: Token["kind"]): boolean {
    if (this.check(kind)) {
      this.advance();
      return true;
    }
    return false;
  }

  private check(kind: Token["kind"]): boolean {
    if (this.isAtEnd()) {
      return kind === TokenKind.Eof;
    }
    return this.peek().kind === kind;
  }

  private checkNext(kind: Token["kind"]): boolean {
    const next = this.tokens[this.current + 1];
    return next !== undefined && next.kind === kind;
  }

  private advance(): Token {
    if (!this.isAtEnd()) {
      this.current += 1;
    }
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().kind === TokenKind.Eof;
  }

  private peek(): Token {
    const token = this.tokens[this.current];
    if (token === undefined) {
      throw new ParseError("Unexpected end of input.", {
        ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      });
    }
    return token;
  }

  private previous(): Token {
    const token = this.tokens[this.current - 1];
    if (token === undefined) {
      return this.peek();
    }
    return token;
  }

  private spanFrom(
    start: SourceSpan["start"],
    end: SourceSpan["end"],
  ): SourceSpan {
    return {
      ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      start,
      end,
    };
  }

  private error(message: string, span: SourceSpan): ParseError {
    return new ParseError(message, {
      ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      span,
    });
  }
}

/**
 * Parse a Zed schema source string into a `SchemaAST`.
 *
 * @throws {ParseError} on syntax errors
 */
export function parseSchema(source: string, fileName?: string): SchemaAST {
  const options = fileName !== undefined ? { fileName } : {};
  const tokens = new Lexer(source, options).tokenize();
  return new Parser(tokens, options).parse();
}
