/**
 * @fileoverview ExtensionCandidate Types (SPEC Section 5.6)
 *
 * Target-agnostic extension hint. Generalizes MEL-specific
 * extension candidates to support multiple target types.
 *
 * Per SPEC Section 11.9 (EXP-*):
 * - EXP-7: Core SHALL NOT use MEL candidate terminology
 *          -> use ExtensionCandidate(kind="mel")
 *
 * @module core/types/extension-candidate
 */

// =============================================================================
// ExtensionCandidateKind
// =============================================================================

/**
 * Known extension candidate kinds.
 * Extensible via string literal type.
 */
export type ExtensionCandidateKind =
  | "mel" // Manifesto Expression Language (Manifesto target)
  | "jsonschema" // JSON Schema extension (OpenAPI target)
  | "patch-template" // Patch template (generic)
  | string; // Allow custom kinds

// =============================================================================
// ExtensionCandidate
// =============================================================================

/**
 * Target-agnostic extension hint.
 *
 * Per SPEC Section 5.6:
 * - nodeId: Related node ID
 * - kind: Hint type
 * - payload: Kind-specific payload
 * - wouldEnable: Capabilities enabled if this hint is applied
 */
export interface ExtensionCandidate {
  /** Related node ID */
  readonly nodeId: string;

  /**
   * Hint type.
   * - "mel": Manifesto Expression Language (Manifesto target)
   * - "jsonschema": JSON Schema extension (OpenAPI target)
   * - "patch-template": Patch template (generic)
   */
  readonly kind: ExtensionCandidateKind;

  /** Kind-specific payload */
  readonly payload: unknown;

  /** Capabilities enabled if this hint is applied */
  readonly wouldEnable?: readonly string[];
}

// =============================================================================
// MEL-specific types (for kind="mel")
// =============================================================================

/**
 * MEL extension candidate payload.
 * Used when kind="mel".
 */
export interface MelCandidatePayload {
  /** MEL expression template */
  readonly template: string;

  /** Placeholder variables in the template */
  readonly placeholders?: readonly string[];

  /** Description of what this MEL enables */
  readonly description?: string;
}

/**
 * Type guard for MEL extension candidates.
 */
export function isMelCandidate(
  candidate: ExtensionCandidate
): candidate is ExtensionCandidate & { payload: MelCandidatePayload } {
  return candidate.kind === "mel";
}
