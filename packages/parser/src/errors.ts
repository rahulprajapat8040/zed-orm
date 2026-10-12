import { ZedError, ZedErrorCode } from "@zed-orm/shared";
import type { SourceSpan } from "@zed-orm/ast";
import { spanToLocation } from "@zed-orm/ast";

export interface ParseErrorOptions {
  readonly fileName?: string;
  readonly span?: SourceSpan;
  readonly line?: number;
  readonly column?: number;
  readonly cause?: unknown;
}

/**
 * Structured schema syntax error.
 *
 * Distinct from semantic validation errors (`ZED_SCHEMA_ERROR`).
 */
export class ParseError extends ZedError {
  readonly fileName?: string;
  readonly line: number;
  readonly column: number;
  readonly span?: SourceSpan;

  constructor(message: string, options: ParseErrorOptions = {}) {
    const line = options.span?.start.line ?? options.line ?? 1;
    const column = options.span?.start.column ?? options.column ?? 1;
    const fileName = options.span?.fileName ?? options.fileName;

    const locationPrefix =
      fileName !== undefined
        ? `${fileName}:${line}:${column}`
        : `${line}:${column}`;

    super(ZedErrorCode.PARSE, `${locationPrefix}\n\n${message}`, {
      cause: options.cause,
    });
    this.name = "ParseError";
    this.line = line;
    this.column = column;
    if (fileName !== undefined) {
      this.fileName = fileName;
    }
    if (options.span !== undefined) {
      this.span = options.span;
    }
  }

  /** Compact start location for tooling. */
  get location() {
    if (this.span !== undefined) {
      return spanToLocation(this.span);
    }
    return {
      ...(this.fileName !== undefined ? { fileName: this.fileName } : {}),
      line: this.line,
      column: this.column,
      offset: 0,
      length: 0,
    };
  }
}
