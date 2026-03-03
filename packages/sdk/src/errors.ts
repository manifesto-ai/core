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
