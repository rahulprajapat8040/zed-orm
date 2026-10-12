/**
 * @zed-orm/parser
 *
 * Lexer and recursive-descent parser for the Zed schema language.
 * Produces `@zed-orm/ast` nodes. Does not generate SQL or validate semantics.
 */

export { ParseError, type ParseErrorOptions } from "./errors.js";
export { Lexer, tokenize } from "./lexer.js";
export { Parser, parseSchema, type ParseSchemaOptions } from "./parser.js";
export {
  TokenKind,
  KEYWORDS,
  type Token,
  type TokenKindName,
} from "./tokens.js";

export const PACKAGE_NAME = "@zed-orm/parser" as const;
