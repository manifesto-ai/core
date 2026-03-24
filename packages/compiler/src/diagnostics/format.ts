/**
 * Plain-text Diagnostic Formatter
 *
 * Browser-safe (no ANSI colors). Produces human-readable error messages
 * with optional source context and caret indicators.
 *
 * @module
 */

import type { Diagnostic } from "./types.js";

/**
 * Format a single diagnostic as plain text.
 *
 * Without source: `[MEL_PARSER] Expected '{' (3:15)`
 * With source:
 * ```
 * [MEL_PARSER] Expected '{' (3:15)
 *    3 | domain Bad bad syntax here }
 *                ^^^
 * ```
 */
export function formatDiagnostic(diagnostic: Diagnostic, source?: string): string {
  const { code, message, location } = diagnostic;

  if (!location || (location.start.line === 0 && location.start.column === 0)) {
    return `[${code}] ${message}`;
  }

  const { line, column } = location.start;
  const header = `[${code}] ${message} (${line}:${column})`;

  if (!source) {
    return header;
  }

  const sourceLines = source.split("\n");
  const lineContent = sourceLines[line - 1];

  if (!lineContent) {
    return header;
  }

  const lineNumStr = String(line).padStart(4, " ");
  const sourceLine = `${lineNumStr} | ${lineContent}`;

  const underlineLen = Math.max(
    1,
    location.end.line === location.start.line
      ? Math.min(location.end.column - column, lineContent.length - column + 1)
      : 1,
  );
  const padding = " ".repeat(lineNumStr.length + 3 + column - 1);
  const underline = `${padding}${"^".repeat(underlineLen)}`;

  return `${header}\n${sourceLine}\n${underline}`;
}

/**
 * Format multiple diagnostics, separated by blank lines.
 */
export function formatDiagnostics(diagnostics: Diagnostic[], source?: string): string {
  return diagnostics
    .map((d) => formatDiagnostic(d, source))
    .join("\n\n");
}
