import { ZedError, ZedErrorCode } from "@zed-orm/shared";
import type { SourceSpan } from "@zed-orm/ast";
import { spanToLocation } from "@zed-orm/ast";

export interface SchemaErrorOptions {
  readonly code?: string;
  readonly fileName?: string;
  readonly span?: SourceSpan;
  readonly line?: number;
  readonly column?: number;
  readonly cause?: unknown;
}

/**
 * Semantic schema validation error.
 *
 * Distinct from syntax errors (`ZED_PARSE_ERROR`).
 */
export class SchemaError extends ZedError {
  readonly fileName?: string;
  readonly line: number;
  readonly column: number;
  readonly span?: SourceSpan;

  constructor(message: string, options: SchemaErrorOptions = {}) {
    const code = options.code ?? ZedErrorCode.SCHEMA;
    const line = options.span?.start.line ?? options.line ?? 1;
    const column = options.span?.start.column ?? options.column ?? 1;
    const fileName = options.span?.fileName ?? options.fileName;

    const locationPrefix =
      fileName !== undefined
        ? `${fileName}:${line}:${column}`
        : `${line}:${column}`;

    super(code, `${locationPrefix}\n\n${message}`, {
      cause: options.cause,
    });
    this.name = "SchemaError";
    this.line = line;
    this.column = column;
    if (fileName !== undefined) {
      this.fileName = fileName;
    }
    if (options.span !== undefined) {
      this.span = options.span;
    }
  }

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
