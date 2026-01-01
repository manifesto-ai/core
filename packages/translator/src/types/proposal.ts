/**
 * Proposal result types
 */

import type { FallbackBehavior } from "./common.js";
import type { PatchFragment } from "./fragment.js";

/** Ambiguity kind */
export type AmbiguityKind = "anchor" | "intent" | "value" | "conflict";

/** Resolution option for ambiguity */
export interface ResolutionOption {
  /** Unique option ID */
  readonly id: string;
  /** Human-readable label */
  readonly label: string;
  /** Fragment for this option */
  readonly fragment: PatchFragment;
  /** Confidence for this option */
  readonly confidence: number;
}

/** Ambiguity report when multiple interpretations exist */
export interface AmbiguityReport {
  /** Kind of ambiguity */
  readonly kind: AmbiguityKind;
  /** Question to present to user */
  readonly question: string;
  /** Available options */
  readonly options: readonly ResolutionOption[];
  /** Fallback behavior on timeout */
  readonly fallbackBehavior: FallbackBehavior;
  /** Expiration timestamp (null if no timeout) */
  readonly expiresAt: number | null;
}

/** Result of proposal stage */
export interface ProposalResult {
  /** Generated fragment (null if ambiguous) */
  readonly fragment: PatchFragment | null;
  /** Ambiguity report (null if unambiguous) */
  readonly ambiguity: AmbiguityReport | null;
  /** Confidence score (0.0 - 1.0) */
  readonly confidence: number;
  /** LLM reasoning for debugging */
  readonly reasoning: string | null;
}

/** Resolution decision */
export type ResolutionDecision = "select" | "discard" | "freeform";

/** Resolution selection from user */
export interface ResolutionSelection {
  /** Decision type */
  readonly decision: ResolutionDecision;
  /** Selected option ID (for "select" decision) */
  readonly optionId: string | null;
  /** Freeform input (for "freeform" decision) */
  readonly freeformInput: string | null;
}
