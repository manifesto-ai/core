/**
 * Diagnostic Types for MEL Compiler
 * Error and warning reporting structures
 */

import type { SourceLocation } from "../lexer/source-location.js";

/**
 * Severity level of a diagnostic
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * A diagnostic message (error, warning, or info)
 */
export interface Diagnostic {
  /** Severity level */
  severity: DiagnosticSeverity;
  /** Error code (e.g., "MEL001", "MEL_LEXER") */
  code: string;
  /** Human-readable message */
  message: string;
  /** Location in source */
  location: SourceLocation;
  /** The source line containing the error */
  source?: string;
  /** Suggested fix */
  suggestion?: string;
  /** Related diagnostics */
  related?: RelatedDiagnostic[];
}

/**
 * A related diagnostic (for multi-location errors)
 */
export interface RelatedDiagnostic {
  message: string;
  location: SourceLocation;
}

/**
 * Create an error diagnostic
 */
export function createError(
  code: string,
  message: string,
  location: SourceLocation,
  options?: {
    source?: string;
    suggestion?: string;
    related?: RelatedDiagnostic[];
  }
): Diagnostic {
  return {
    severity: "error",
    code,
    message,
    location,
    ...options,
  };
}

/**
 * Create a warning diagnostic
 */
export function createWarning(
  code: string,
  message: string,
  location: SourceLocation,
  options?: {
    source?: string;
    suggestion?: string;
  }
): Diagnostic {
  return {
    severity: "warning",
    code,
    message,
    location,
    ...options,
  };
}

/**
 * Create an info diagnostic
 */
export function createInfo(
  code: string,
  message: string,
  location: SourceLocation
): Diagnostic {
  return {
    severity: "info",
    code,
    message,
    location,
  };
}

/**
 * Check if a diagnostic is an error
 */
export function isError(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === "error";
}

/**
 * Check if any diagnostics contain errors
 */
export function hasErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some(isError);
}

/**
 * Filter diagnostics by severity
 */
export function filterBySeverity(
  diagnostics: Diagnostic[],
  severity: DiagnosticSeverity
): Diagnostic[] {
  return diagnostics.filter((d) => d.severity === severity);
}
