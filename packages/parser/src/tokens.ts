import type { SourceSpan } from "@zed-orm/ast";

export const TokenKind = {
  // Keywords
  Model: "Model",
  Enum: "Enum",
  Datasource: "Datasource",
  Generator: "Generator",
  True: "True",
  False: "False",
  Null: "Null",

  // Literals / names
  Identifier: "Identifier",
  String: "String",
  Number: "Number",

  // Punctuation
  LeftBrace: "LeftBrace",
  RightBrace: "RightBrace",
  LeftParen: "LeftParen",
  RightParen: "RightParen",
  LeftBracket: "LeftBracket",
  RightBracket: "RightBracket",
  Comma: "Comma",
  Colon: "Colon",
  Equals: "Equals",
  Question: "Question",
  At: "At",
  AtAt: "AtAt",
  Dot: "Dot",

  Eof: "Eof",
} as const;

export type TokenKindName = (typeof TokenKind)[keyof typeof TokenKind];

export interface Token {
  readonly kind: TokenKindName;
  readonly lexeme: string;
  readonly loc: SourceSpan;
}

export const KEYWORDS: ReadonlyMap<string, TokenKindName> = new Map([
  ["model", TokenKind.Model],
  ["enum", TokenKind.Enum],
  ["datasource", TokenKind.Datasource],
  ["generator", TokenKind.Generator],
  ["true", TokenKind.True],
  ["false", TokenKind.False],
  ["null", TokenKind.Null],
]);
