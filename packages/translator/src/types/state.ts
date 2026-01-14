/**
 * @fileoverview Translator State Types
 *
 * Core state model types for Translator App.
 * Aligned with SPEC §8 State Model.
 */

import type { IntentIR, IntentBody, EntityRef } from "@manifesto-ai/intent-ir";
import type { TranslatorError } from "./errors.js";
import type { LearnedEntry, PendingMapping } from "./lexicon.js";

// =============================================================================
// Key Types
// =============================================================================

/**
 * 16-char lowercase hex string (zero-padded)
 * Represents serialized SimKey for storage/transport
 * SPEC §6.2
 */
export type SimKeyHex = string;

/**
 * 64-char lowercase hex string
 * PathKey for temporal hinting (feature-flagged)
 * SPEC Appendix D
 */
export type PathKeyHex = string;

// =============================================================================
// Configuration
// =============================================================================

/**
 * Translator configuration
 * SPEC §8.5
 */
export type TranslatorConfig = {
  /** Resolver context depth (default: 5, range: 1-20) */
  readonly resolverContextDepth: number;
  /** Language hint */
  readonly defaultLang: string;
  /** Strict mode - error on feature check failure */
  readonly strict: boolean;
  /** Enable temporal hinting (feature-flagged, default: false) */
  readonly enableTemporalHint?: boolean;
  /** Temporal depth for pathKey (default: 8, range: 1-32) */
  readonly temporalDepth?: number;
};

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: TranslatorConfig = {
  resolverContextDepth: 5,
  defaultLang: "en",
  strict: false,
  enableTemporalHint: false,
  temporalDepth: 8,
};

// =============================================================================
// Lowering Result Types
// =============================================================================

/**
 * Lexicon source identifier
 */
export type LexiconSource = "builtin" | "project" | "learned";

/**
 * Field mapping record
 */
export type FieldMapping = {
  readonly from: { readonly role: string; readonly path: string };
  readonly to: { readonly field: string };
};

/**
 * Resolution record - tracks discourse reference resolution
 * SPEC §10.2
 */
export type ResolutionRecord = {
  readonly path: string;
  readonly original: EntityRef;
  readonly resolved: EntityRef;
};

/**
 * Lowering evidence - provenance information
 * SPEC §11.3
 */
export type LoweringEvidence = {
  readonly lexiconSource: LexiconSource;
  readonly originalLemma: string;
  readonly resolvedLemma: string;
  readonly mappedFields: readonly FieldMapping[];
  readonly resolutions?: readonly ResolutionRecord[];
  readonly intentKey: string;
};

/**
 * Missing information for unresolved result
 * SPEC §11.5
 */
export type MissingInfo = {
  readonly kind: "required_role" | "action_type" | "entity_ref";
  readonly detail: string;
  readonly suggestion?: string;
};

/**
 * Ambiguity reason
 * SPEC §11.4
 */
export type AmbiguityReason =
  | "multiple_action_match"
  | "role_mapping_unclear"
  | "entity_type_ambiguous";

/**
 * Ambiguity candidate
 * SPEC §11.4
 */
export type AmbiguityCandidate = {
  readonly index: number;
  readonly body: IntentBody;
  readonly confidence: number;
  readonly reason: string;
};

/**
 * Resolved lowering result
 */
export type ResolvedResult = {
  readonly kind: "resolved";
  readonly body: IntentBody;
  readonly evidence: LoweringEvidence;
};

/**
 * Ambiguous lowering result
 */
export type AmbiguousResult = {
  readonly kind: "ambiguous";
  readonly candidates: readonly AmbiguityCandidate[];
  readonly reason: AmbiguityReason;
};

/**
 * Unresolved lowering result (cold start / missing info)
 */
export type UnresolvedResult = {
  readonly kind: "unresolved";
  readonly partial: Partial<IntentBody>;
  readonly missing: readonly MissingInfo[];
};

/**
 * Lowering result union
 * SPEC §11.1
 */
export type LoweringResult = ResolvedResult | AmbiguousResult | UnresolvedResult;

// =============================================================================
// Translate Result Types
// =============================================================================

/**
 * Success translate result
 */
export type TranslateSuccessResult = {
  readonly kind: "success";
  readonly body: IntentBody;
};

/**
 * Ambiguous translate result
 */
export type TranslateAmbiguousResult = {
  readonly kind: "ambiguous";
  readonly candidates: readonly AmbiguityCandidate[];
};

/**
 * Unresolved translate result
 */
export type TranslateUnresolvedResult = {
  readonly kind: "unresolved";
  readonly partial: Partial<IntentBody>;
  readonly missing: readonly MissingInfo[];
};

/**
 * Error translate result
 */
export type TranslateErrorResult = {
  readonly kind: "error";
  readonly error: TranslatorError;
};

/**
 * Translate result union
 * SPEC §8.2
 */
export type TranslateResult =
  | TranslateSuccessResult
  | TranslateAmbiguousResult
  | TranslateUnresolvedResult
  | TranslateErrorResult;

// =============================================================================
// Request Types
// =============================================================================

/**
 * Translate input
 * SPEC §9.1
 */
export type TranslateInput = {
  readonly text: string;
  readonly lang?: string;
  readonly mode?: "schema";
  readonly strict?: boolean;
};

/**
 * Translate request record
 * SPEC §8.2
 */
export type TranslateRequest = {
  readonly requestId: string;
  readonly input: TranslateInput;
  readonly result: TranslateResult | null;
  readonly intentIR: IntentIR | null;
  /** Semantic coordinate (null if IR generation failed) */
  readonly simKey: SimKeyHex | null;
  /** Protocol identity (null unless lowering succeeded) */
  readonly intentKey: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
  /** Temporal hint (when enabled) */
  readonly pathKey?: PathKeyHex | null;
  readonly prevPathKey?: PathKeyHex | null;
};

// =============================================================================
// Translator State
// =============================================================================

/**
 * Translator App state
 * SPEC §8.1
 */
export type TranslatorState = {
  /** Current working schema (null before initialization) */
  readonly schema: unknown | null;
  /** Schema hash (from App) */
  readonly schemaHash: string | null;
  /** Request history */
  readonly requests: readonly TranslateRequest[];
  /** Last request ID */
  readonly lastRequestId: string | null;
  /** Temporary candidates before Lexicon learning */
  readonly pendingMappings: readonly PendingMapping[];
  /** Learned Lexicon entries */
  readonly learnedEntries: Readonly<Record<string, LearnedEntry>>;
  /** Configuration */
  readonly config: TranslatorConfig;
};

/**
 * Create initial translator state
 */
export function createInitialState(
  config?: Partial<TranslatorConfig>
): TranslatorState {
  return {
    schema: null,
    schemaHash: null,
    requests: [],
    lastRequestId: null,
    pendingMappings: [],
    learnedEntries: {},
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

// =============================================================================
// Type Guards
// =============================================================================

export function isSuccessResult(
  result: TranslateResult
): result is TranslateSuccessResult {
  return result.kind === "success";
}

export function isAmbiguousResult(
  result: TranslateResult
): result is TranslateAmbiguousResult {
  return result.kind === "ambiguous";
}

export function isUnresolvedResult(
  result: TranslateResult
): result is TranslateUnresolvedResult {
  return result.kind === "unresolved";
}

export function isErrorResult(
  result: TranslateResult
): result is TranslateErrorResult {
  return result.kind === "error";
}

export function isResolvedLoweringResult(
  result: LoweringResult
): result is ResolvedResult {
  return result.kind === "resolved";
}
