/**
 * Diagnostic severity levels
 */
export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * Diagnostic codes
 */
export type DiagnosticCode =
  | "INVALID_PATH"
  | "MISSING_DEPENDENCY"
  | "CIRCULAR_COMPUTED"
  | "CIRCULAR_FLOW"
  | "TYPE_MISMATCH"
  | "INVALID_AVAILABILITY"
  | "UNREACHABLE_CODE";

/**
 * Single diagnostic entry
 */
export interface Diagnostic {
  /**
   * Error/warning code
   */
  readonly code: DiagnosticCode;

  /**
   * Severity level
   */
  readonly severity: DiagnosticSeverity;

  /**
   * Human-readable message
   */
  readonly message: string;

  /**
   * Path to the problematic definition (e.g., "computed.canReceive")
   */
  readonly path?: string;

  /**
   * Suggested fix
   */
  readonly suggestion?: string;
}

/**
 * DomainDiagnostics - Collection of validation results
 *
 * Per FDR-B010, diagnostics are mandatory and Builder MUST NOT
 * silently emit invalid schemas.
 */
export interface DomainDiagnostics {
  /**
   * True if no errors (warnings allowed)
   */
  readonly valid: boolean;

  /**
   * Error-level diagnostics (must fix)
   */
  readonly errors: readonly Diagnostic[];

  /**
   * Warning-level diagnostics (should fix)
   */
  readonly warnings: readonly Diagnostic[];

  /**
   * Info-level diagnostics (FYI)
   */
  readonly infos: readonly Diagnostic[];

  /**
   * All diagnostics combined
   */
  readonly all: readonly Diagnostic[];

  /**
   * Throw if not valid
   */
  assertValid(): void;
}

/**
 * Create a DomainDiagnostics object from a list of diagnostics
 */
export function createDomainDiagnostics(diagnostics: Diagnostic[]): DomainDiagnostics {
  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    infos,
    all: diagnostics,
    assertValid() {
      if (!this.valid) {
        const messages = errors
          .map((e) => `[${e.code}] ${e.message}${e.path ? ` at ${e.path}` : ""}`)
          .join("\n");
        throw new Error(`Domain validation failed:\n${messages}`);
      }
    },
  };
}
