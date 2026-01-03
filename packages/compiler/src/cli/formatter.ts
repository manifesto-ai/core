/**
 * Diagnostic Formatter
 * Formats compiler diagnostics for terminal output
 */

import type { Diagnostic } from "../diagnostics/types.js";

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
  underline: "\x1b[4m",
};

/**
 * Format a single diagnostic
 */
export function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string,
  filePath?: string
): string {
  const lines: string[] = [];
  const { severity, code, message, location } = diagnostic;

  // Severity color
  const severityColor = severity === "error" ? colors.red : colors.yellow;
  const severityLabel = severity.toUpperCase();

  // Header: file:line:column: severity[code]: message
  const locationStr = filePath
    ? `${filePath}:${location.start.line}:${location.start.column}`
    : `${location.start.line}:${location.start.column}`;

  lines.push(
    `${colors.bold}${locationStr}:${colors.reset} ` +
    `${severityColor}${severityLabel}${colors.reset}` +
    `${colors.gray}[${code}]${colors.reset}: ` +
    `${message}`
  );

  // Source context
  const sourceLines = source.split("\n");
  const lineNum = location.start.line;
  const lineContent = sourceLines[lineNum - 1] ?? "";

  if (lineContent) {
    const lineNumStr = String(lineNum).padStart(4, " ");
    lines.push(`${colors.gray}${lineNumStr} |${colors.reset} ${lineContent}`);

    // Underline the error position
    const padding = " ".repeat(lineNumStr.length + 3 + location.start.column - 1);
    const underlineLen = Math.max(
      1,
      Math.min(location.end.column - location.start.column, lineContent.length - location.start.column + 1)
    );
    const underline = "^".repeat(underlineLen);
    lines.push(`${padding}${severityColor}${underline}${colors.reset}`);
  }

  return lines.join("\n");
}

/**
 * Format multiple diagnostics
 */
export function formatDiagnostics(
  diagnostics: Diagnostic[],
  source: string,
  filePath?: string
): string {
  return diagnostics
    .map(d => formatDiagnostic(d, source, filePath))
    .join("\n\n");
}

/**
 * Create a summary line
 */
export function formatSummary(diagnostics: Diagnostic[]): string {
  const errors = diagnostics.filter(d => d.severity === "error").length;
  const warnings = diagnostics.filter(d => d.severity === "warning").length;

  const parts: string[] = [];

  if (errors > 0) {
    parts.push(`${colors.red}${errors} error${errors > 1 ? "s" : ""}${colors.reset}`);
  }

  if (warnings > 0) {
    parts.push(`${colors.yellow}${warnings} warning${warnings > 1 ? "s" : ""}${colors.reset}`);
  }

  if (parts.length === 0) {
    return `${colors.green}No issues found${colors.reset}`;
  }

  return parts.join(", ");
}
