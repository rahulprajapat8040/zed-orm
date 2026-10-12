import type { SourcePosition, SourceSpan } from "@zed-orm/ast";
import { ParseError } from "./errors.js";
import { KEYWORDS, TokenKind, type Token } from "./tokens.js";

export interface LexerOptions {
  readonly fileName?: string;
}

/**
 * Hand-written lexer for Zed schema source.
 * Produces tokens with source spans. Does not parse structure.
 */
export class Lexer {
  private readonly source: string;
  private readonly fileName?: string;
  private offset = 0;
  private line = 1;
  private column = 1;

  constructor(source: string, options: LexerOptions = {}) {
    this.source = source;
    if (options.fileName !== undefined) {
      this.fileName = options.fileName;
    }
  }

  tokenize(): Token[] {
    const tokens: Token[] = [];
    for (;;) {
      const token = this.nextToken();
      tokens.push(token);
      if (token.kind === TokenKind.Eof) {
        break;
      }
    }
    return tokens;
  }

  private nextToken(): Token {
    this.skipTrivia();

    const start = this.position();
    if (this.isAtEnd()) {
      return this.token(TokenKind.Eof, "", start);
    }

    const ch = this.peek();

    switch (ch) {
      case "{":
        this.advance();
        return this.token(TokenKind.LeftBrace, "{", start);
      case "}":
        this.advance();
        return this.token(TokenKind.RightBrace, "}", start);
      case "(":
        this.advance();
        return this.token(TokenKind.LeftParen, "(", start);
      case ")":
        this.advance();
        return this.token(TokenKind.RightParen, ")", start);
      case "[":
        this.advance();
        return this.token(TokenKind.LeftBracket, "[", start);
      case "]":
        this.advance();
        return this.token(TokenKind.RightBracket, "]", start);
      case ",":
        this.advance();
        return this.token(TokenKind.Comma, ",", start);
      case ":":
        this.advance();
        return this.token(TokenKind.Colon, ":", start);
      case "=":
        this.advance();
        return this.token(TokenKind.Equals, "=", start);
      case "?":
        this.advance();
        return this.token(TokenKind.Question, "?", start);
      case ".":
        this.advance();
        return this.token(TokenKind.Dot, ".", start);
      case "@":
        this.advance();
        if (this.peek() === "@") {
          this.advance();
          return this.token(TokenKind.AtAt, "@@", start);
        }
        return this.token(TokenKind.At, "@", start);
      case '"':
        return this.scanString(start);
      default:
        break;
    }

    if (this.isDigit(ch) || (ch === "-" && this.isDigit(this.peekNext()))) {
      return this.scanNumber(start);
    }

    if (this.isIdentStart(ch)) {
      return this.scanIdentifierOrKeyword(start);
    }

    this.advance();
    throw new ParseError(`Unexpected character '${ch}'.`, {
      ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      span: this.span(start, this.position()),
    });
  }

  private scanString(start: SourcePosition): Token {
    this.advance(); // opening "
    let value = "";

    while (!this.isAtEnd() && this.peek() !== '"') {
      const ch = this.peek();
      if (ch === "\n") {
        throw new ParseError("Unterminated string literal.", {
          ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
          span: this.span(start, this.position()),
        });
      }
      if (ch === "\\") {
        this.advance();
        if (this.isAtEnd()) {
          throw new ParseError("Unterminated string literal.", {
            ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
            span: this.span(start, this.position()),
          });
        }
        const escaped = this.advance();
        value += this.unescape(escaped, start);
      } else {
        value += this.advance();
      }
    }

    if (this.isAtEnd()) {
      throw new ParseError("Unterminated string literal.", {
        ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
        span: this.span(start, this.position()),
      });
    }

    this.advance(); // closing "
    return this.token(TokenKind.String, value, start);
  }

  private unescape(ch: string, start: SourcePosition): string {
    switch (ch) {
      case "n":
        return "\n";
      case "t":
        return "\t";
      case "r":
        return "\r";
      case '"':
        return '"';
      case "\\":
        return "\\";
      default:
        throw new ParseError(`Invalid escape sequence '\\${ch}'.`, {
          ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
          span: this.span(start, this.position()),
        });
    }
  }

  private scanNumber(start: SourcePosition): Token {
    let lexeme = "";
    if (this.peek() === "-") {
      lexeme += this.advance();
    }
    while (this.isDigit(this.peek())) {
      lexeme += this.advance();
    }
    if (this.peek() === "." && this.isDigit(this.peekNext())) {
      lexeme += this.advance();
      while (this.isDigit(this.peek())) {
        lexeme += this.advance();
      }
    }
    return this.token(TokenKind.Number, lexeme, start);
  }

  private scanIdentifierOrKeyword(start: SourcePosition): Token {
    let lexeme = "";
    while (this.isIdentContinue(this.peek())) {
      lexeme += this.advance();
    }
    const keyword = KEYWORDS.get(lexeme);
    if (keyword !== undefined) {
      return this.token(keyword, lexeme, start);
    }
    return this.token(TokenKind.Identifier, lexeme, start);
  }

  private skipTrivia(): void {
    for (;;) {
      if (this.isAtEnd()) {
        return;
      }
      const ch = this.peek();
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance();
        continue;
      }
      if (ch === "/" && this.peekNext() === "/") {
        this.advance();
        this.advance();
        while (!this.isAtEnd() && this.peek() !== "\n") {
          this.advance();
        }
        continue;
      }
      if (ch === "/" && this.peekNext() === "*") {
        const start = this.position();
        this.advance();
        this.advance();
        while (
          !this.isAtEnd() &&
          !(this.peek() === "*" && this.peekNext() === "/")
        ) {
          this.advance();
        }
        if (this.isAtEnd()) {
          throw new ParseError("Unterminated block comment.", {
            ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
            span: this.span(start, this.position()),
          });
        }
        this.advance();
        this.advance();
        continue;
      }
      return;
    }
  }

  private token(
    kind: Token["kind"],
    lexeme: string,
    start: SourcePosition,
  ): Token {
    return {
      kind,
      lexeme,
      loc: this.span(start, this.position()),
    };
  }

  private span(start: SourcePosition, end: SourcePosition): SourceSpan {
    return {
      ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      start,
      end,
    };
  }

  private position(): SourcePosition {
    return { line: this.line, column: this.column, offset: this.offset };
  }

  private peek(): string {
    return this.source[this.offset] ?? "\0";
  }

  private peekNext(): string {
    return this.source[this.offset + 1] ?? "\0";
  }

  private advance(): string {
    const ch = this.source[this.offset] ?? "\0";
    this.offset += 1;
    if (ch === "\n") {
      this.line += 1;
      this.column = 1;
    } else {
      this.column += 1;
    }
    return ch;
  }

  private isAtEnd(): boolean {
    return this.offset >= this.source.length;
  }

  private isDigit(ch: string): boolean {
    return ch >= "0" && ch <= "9";
  }

  private isIdentStart(ch: string): boolean {
    return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
  }

  private isIdentContinue(ch: string): boolean {
    return this.isIdentStart(ch) || this.isDigit(ch);
  }
}

/** Tokenize schema source into a token array (including EOF). */
export function tokenize(source: string, fileName?: string): Token[] {
  return new Lexer(
    source,
    fileName !== undefined ? { fileName } : {},
  ).tokenize();
}
