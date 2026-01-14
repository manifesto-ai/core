/**
 * @fileoverview Action Input/Output Types
 *
 * Types for the four translator actions: translate, lower, resolve, learn.
 * Aligned with SPEC §9 Actions.
 */

import type { IntentIR, IntentBody, Role, Term } from "@manifesto-ai/intent-ir";
import type { TranslatorError } from "./errors.js";
import type { LearnedEntry } from "./lexicon.js";
import type {
  TranslateResult,
  LoweringResult,
  AmbiguityCandidate,
  MissingInfo,
  SimKeyHex,
  PathKeyHex,
} from "./state.js";

// =============================================================================
// Translate Action
// =============================================================================

/**
 * Translate action input
 * SPEC §9.1
 */
export type TranslateInput = {
  /** Natural language text */
  readonly text: string;
  /** Language hint (optional) */
  readonly lang?: string;
  /** Mode - v0.1 supports only schema */
  readonly mode?: "schema";
  /** Error on feature check failure */
  readonly strict?: boolean;
};

/**
 * Translate action output
 * SPEC §9.1
 */
export type TranslateOutput = {
  readonly requestId: string;
  readonly result: TranslateResult;
  /** Semantic coordinate (null if IR generation failed) */
  readonly simKey: SimKeyHex | null;
  /** Protocol identity (present only on success) */
  readonly intentKey?: string;
  /** Temporal hint (when enabled) */
  readonly pathKey?: PathKeyHex | null;
};

// =============================================================================
// Lower Action
// =============================================================================

/**
 * Lower action input
 * SPEC §9.2
 */
export type LowerInput = {
  /** IntentIR to lower */
  readonly ir: IntentIR;
  /** Request ID (optional, generated if absent) */
  readonly requestId?: string;
};

/**
 * Lower action output
 * SPEC §9.2
 */
export type LowerOutput = {
  readonly requestId: string;
  readonly result: LoweringResult | { kind: "error"; error: TranslatorError };
  /** Always present (IR is provided) */
  readonly simKey: SimKeyHex;
  /** Present only on success */
  readonly intentKey?: string;
};

// =============================================================================
// Resolve Action
// =============================================================================

/**
 * Select resolution - choose from ambiguous candidates
 */
export type SelectResolution = {
  readonly kind: "select";
  readonly index: number;
};

/**
 * Provide resolution - fill in missing information
 */
export type ProvideResolution = {
  readonly kind: "provide";
  readonly role: Role;
  readonly value: Term;
};

/**
 * Cancel resolution - terminate the request
 */
export type CancelResolution = {
  readonly kind: "cancel";
};

/**
 * Resolution union type
 * SPEC §9.3
 */
export type Resolution = SelectResolution | ProvideResolution | CancelResolution;

/**
 * Resolve action input
 * SPEC §9.3
 */
export type ResolveInput = {
  /** Original request ID */
  readonly requestId: string;
  /** Resolution method */
  readonly resolution: Resolution;
};

/**
 * Success resolve output
 */
export type ResolveSuccessOutput = {
  readonly kind: "success";
  readonly body: IntentBody;
  readonly intentKey: string;
};

/**
 * Still ambiguous resolve output
 */
export type ResolveStillAmbiguousOutput = {
  readonly kind: "still_ambiguous";
  readonly candidates: readonly AmbiguityCandidate[];
};

/**
 * Still unresolved resolve output
 */
export type ResolveStillUnresolvedOutput = {
  readonly kind: "still_unresolved";
  readonly partial: Partial<IntentBody>;
  readonly missing: readonly MissingInfo[];
};

/**
 * Cancelled resolve output
 */
export type ResolveCancelledOutput = {
  readonly kind: "cancelled";
};

/**
 * Error resolve output
 */
export type ResolveErrorOutput = {
  readonly kind: "error";
  readonly error: TranslatorError;
};

/**
 * Resolve action output union
 * SPEC §9.3
 */
export type ResolveOutput =
  | ResolveSuccessOutput
  | ResolveStillAmbiguousOutput
  | ResolveStillUnresolvedOutput
  | ResolveCancelledOutput
  | ResolveErrorOutput;

// =============================================================================
// Learn Action
// =============================================================================

/**
 * Confirm mapping from pending
 */
export type ConfirmMapping = {
  readonly kind: "confirm";
  readonly pendingId: string;
  /** Corrected target lemma (optional) */
  readonly correctedTargetLemma?: string;
};

/**
 * Direct mapping without pending
 */
export type DirectMapping = {
  readonly kind: "direct";
  readonly lemma: string;
  readonly targetLemma: string;
};

/**
 * Learn action input
 * SPEC §9.4
 */
export type LearnInput = {
  readonly mapping: ConfirmMapping | DirectMapping;
};

/**
 * Success learn output
 */
export type LearnSuccessOutput = {
  readonly kind: "success";
  readonly entry: LearnedEntry;
};

/**
 * Conflict learn output
 */
export type LearnConflictOutput = {
  readonly kind: "conflict";
  readonly existing: LearnedEntry;
};

/**
 * Error learn output
 */
export type LearnErrorOutput = {
  readonly kind: "error";
  readonly error: TranslatorError;
};

/**
 * Learn action output union
 * SPEC §9.4
 */
export type LearnOutput = LearnSuccessOutput | LearnConflictOutput | LearnErrorOutput;

// =============================================================================
// Type Guards
// =============================================================================

export function isSelectResolution(r: Resolution): r is SelectResolution {
  return r.kind === "select";
}

export function isProvideResolution(r: Resolution): r is ProvideResolution {
  return r.kind === "provide";
}

export function isCancelResolution(r: Resolution): r is CancelResolution {
  return r.kind === "cancel";
}

export function isConfirmMapping(
  m: ConfirmMapping | DirectMapping
): m is ConfirmMapping {
  return m.kind === "confirm";
}

export function isDirectMapping(
  m: ConfirmMapping | DirectMapping
): m is DirectMapping {
  return m.kind === "direct";
}
