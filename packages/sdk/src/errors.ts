/**
 * SDK v1.0.0 Error Types
 *
 * @see SDK SPEC v1.0.0 §12
 * @see SDK-ERR-1, SDK-ERR-2, SDK-ERR-3
 * @module
 */

// =============================================================================
// Base Error
// =============================================================================

/**
 * Base error for all SDK errors.
 *
 * @see SDK-ERR-1
 */
export class ManifestoError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ManifestoError";
    this.code = code;
  }
}

// =============================================================================
// Reserved Effect Error
// =============================================================================

/**
 * Thrown when user effects attempt to override reserved effect types (e.g. system.get).
 *
 * @see SDK-ERR-2, SDK-INV-4
 */
export class ReservedEffectError extends ManifestoError {
  readonly effectType: string;

  constructor(effectType: string) {
    super(
      "RESERVED_EFFECT",
      `Effect type "${effectType}" is reserved and cannot be overridden`,
    );
    this.name = "ReservedEffectError";
    this.effectType = effectType;
  }
}

// =============================================================================
// Disposed Error
// =============================================================================

// =============================================================================
// Compile Error
// =============================================================================

/**
 * Thrown when MEL compilation fails. Exposes full diagnostic info.
 *
 * @see SDK-ERR-4
 */
export class CompileError extends ManifestoError {
  readonly diagnostics: readonly CompileDiagnostic[];

  constructor(diagnostics: readonly CompileDiagnostic[], formattedMessage: string) {
    super("COMPILE_ERROR", formattedMessage);
    this.name = "CompileError";
    this.diagnostics = diagnostics;
  }
}

/**
 * Minimal diagnostic shape exposed by SDK.
 * Matches @manifesto-ai/compiler Diagnostic but avoids hard dependency.
 */
export interface CompileDiagnostic {
  readonly severity: "error" | "warning" | "info";
  readonly code: string;
  readonly message: string;
  readonly location: {
    readonly start: { readonly line: number; readonly column: number; readonly offset: number };
    readonly end: { readonly line: number; readonly column: number; readonly offset: number };
  };
  readonly source?: string;
  readonly suggestion?: string;
}

// =============================================================================
// Disposed Error
// =============================================================================

/**
 * Thrown when dispatch is called on a disposed instance.
 *
 * @see SDK-ERR-3, SDK-DISPATCH-4
 */
export class DisposedError extends ManifestoError {
  constructor() {
    super("DISPOSED", "Cannot dispatch on a disposed ManifestoInstance");
    this.name = "DisposedError";
  }
}
