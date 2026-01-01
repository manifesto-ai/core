/**
 * Source Location Types
 * Tracks positions in MEL source code for error reporting
 */

/**
 * A position in source code (1-based line/column)
 */
export interface Position {
  /** 1-based line number */
  line: number;
  /** 1-based column number */
  column: number;
  /** 0-based byte offset from start of source */
  offset: number;
}

/**
 * A span in source code (start to end)
 */
export interface SourceLocation {
  start: Position;
  end: Position;
  /** Optional source file path */
  source?: string;
}

/**
 * Create a position
 */
export function createPosition(line: number, column: number, offset: number): Position {
  return { line, column, offset };
}

/**
 * Create a source location from two positions
 */
export function createLocation(start: Position, end: Position, source?: string): SourceLocation {
  return { start, end, source };
}

/**
 * Create a zero-width location at a position
 */
export function createPointLocation(pos: Position, source?: string): SourceLocation {
  return { start: pos, end: pos, source };
}

/**
 * Merge two locations into one spanning both
 */
export function mergeLocations(a: SourceLocation, b: SourceLocation): SourceLocation {
  return {
    start: a.start.offset < b.start.offset ? a.start : b.start,
    end: a.end.offset > b.end.offset ? a.end : b.end,
    source: a.source ?? b.source,
  };
}
