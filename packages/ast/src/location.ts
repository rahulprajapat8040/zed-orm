/**
 * Source location metadata for AST nodes.
 *
 * Locations are 1-based for line/column (editor-friendly) and 0-based for offset.
 */

/** A single point in a schema source file. */
export interface SourcePosition {
  /** 1-based line number. */
  readonly line: number;
  /** 1-based column number. */
  readonly column: number;
  /** 0-based UTF-16 code unit offset from the start of the file. */
  readonly offset: number;
}

/**
 * A span covering an AST node in source.
 *
 * Prefer attaching `SourceSpan` to nodes rather than only a start position,
 * so diagnostics can underline the full construct.
 */
export interface SourceSpan {
  /** Optional schema file path or logical name (e.g. `schema.zed`). */
  readonly fileName?: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

/**
 * Compact location used when a full span is unnecessary.
 * Kept for compatibility with simpler diagnostics.
 */
export interface SourceLocation {
  readonly fileName?: string;
  readonly line: number;
  readonly column: number;
  readonly offset: number;
  readonly length: number;
}

/** Convert a span to a compact start-based location. */
export function spanToLocation(span: SourceSpan): SourceLocation {
  return {
    ...(span.fileName !== undefined ? { fileName: span.fileName } : {}),
    line: span.start.line,
    column: span.start.column,
    offset: span.start.offset,
    length: Math.max(0, span.end.offset - span.start.offset),
  };
}

/** Create a zero-width span at a position (useful for synthetic nodes). */
export function positionToSpan(
  position: SourcePosition,
  fileName?: string,
): SourceSpan {
  return {
    ...(fileName !== undefined ? { fileName } : {}),
    start: position,
    end: position,
  };
}

/** Unknown / synthetic span when source is unavailable. */
export const UNKNOWN_SPAN: SourceSpan = {
  start: { line: 1, column: 1, offset: 0 },
  end: { line: 1, column: 1, offset: 0 },
};
