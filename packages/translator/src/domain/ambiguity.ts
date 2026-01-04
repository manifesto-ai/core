/**
 * Ambiguity Types (SPEC-1.1.1v §6.8-6.9)
 *
 * AmbiguityReport: Describes ambiguity requiring Human decision
 * AmbiguityResolution: Records the Human's choice
 */

import { z } from "zod";
import type { PatchFragment } from "./patch-fragment.js";
import { PatchFragmentSchema } from "./patch-fragment.js";
import type { ActorRef } from "./types.js";
import { ActorRef as ActorRefSchema } from "./types.js";

// =============================================================================
// Ambiguity Kind
// =============================================================================

/**
 * Kind of ambiguity detected
 *
 * - intent: Multiple possible interpretations of the input
 * - target: Multiple possible targets for the operation
 * - value: Multiple possible values for a field
 * - conflict: Conflicting changes detected
 * - policy: Policy decision required
 */
export type AmbiguityKind =
  | "intent"
  | "target"
  | "value"
  | "conflict"
  | "policy";

export const AmbiguityKindSchema = z.enum([
  "intent",
  "target",
  "value",
  "conflict",
  "policy",
]);

// =============================================================================
// Ambiguity Candidate
// =============================================================================

/** A candidate option for resolving ambiguity */
export interface AmbiguityCandidate {
  /** Unique option identifier */
  optionId: string;
  /** Human-readable description */
  description: string;
  /** Fragments that would be applied if this option is chosen */
  fragments: PatchFragment[];
  /** Confidence score [0, 1] */
  confidence: number;
  /** Evidence supporting this option */
  evidence?: string[];
}

export const AmbiguityCandidateSchema = z.object({
  optionId: z.string(),
  description: z.string(),
  fragments: z.array(PatchFragmentSchema),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).optional(),
});

// =============================================================================
// Resolution Prompt
// =============================================================================

/** Prompt for Human to resolve ambiguity */
export interface ResolutionPrompt {
  /** Question to ask */
  question: string;
  /** Subset of candidates to highlight (UI hint) */
  optionIds?: string[];
  /** Label for affirmative action */
  affirmativeLabel?: string;
  /** Label for negative action */
  negativeLabel?: string;
}

export const ResolutionPromptSchema = z.object({
  question: z.string(),
  optionIds: z.array(z.string()).optional(),
  affirmativeLabel: z.string().optional(),
  negativeLabel: z.string().optional(),
});

// =============================================================================
// AmbiguityReport
// =============================================================================

/**
 * AmbiguityReport: Describes ambiguity requiring Human decision
 *
 * Invariants:
 * - len(candidates) >= 2 (always at least 2 meaningful choices)
 * - opt-cancel required (one candidate MUST be opt-cancel)
 */
export interface AmbiguityReport {
  /** Unique report identifier */
  reportId: string;
  /** Kind of ambiguity */
  kind: AmbiguityKind;
  /** Normalized input that triggered ambiguity */
  normalizedInput: string;
  /** Available options (includes opt-cancel) */
  candidates: AmbiguityCandidate[];
  /** Prompt for Human */
  resolutionPrompt?: ResolutionPrompt;
  /** ISO 8601 timestamp */
  createdAt?: string;
  /** Fragments already confident (partial result) */
  partialFragments?: PatchFragment[];
}

export const AmbiguityReportSchema = z.object({
  reportId: z.string(),
  kind: AmbiguityKindSchema,
  normalizedInput: z.string(),
  candidates: z.array(AmbiguityCandidateSchema),
  resolutionPrompt: ResolutionPromptSchema.optional(),
  createdAt: z.string().optional(),
  partialFragments: z.array(PatchFragmentSchema).optional(),
});

// =============================================================================
// Resolution Choice
// =============================================================================

/** Choice made by Human to resolve ambiguity */
export type ResolutionChoice =
  | { kind: "option"; optionId: string }
  | { kind: "freeform"; text: string };

export const ResolutionChoiceSchema = z.union([
  z.object({
    kind: z.literal("option"),
    optionId: z.string(),
  }),
  z.object({
    kind: z.literal("freeform"),
    text: z.string(),
  }),
]);

// =============================================================================
// Escalation Metadata
// =============================================================================

/** Metadata about escalation to Human */
export interface EscalationMetadata {
  /** When escalation occurred (ISO 8601) */
  escalatedAt: string;
  /** Actor who received the escalation */
  escalatedTo: ActorRef;
}

export const EscalationMetadataSchema = z.object({
  escalatedAt: z.string(),
  escalatedTo: ActorRefSchema,
});

// =============================================================================
// AmbiguityResolution
// =============================================================================

/**
 * AmbiguityResolution: Records the Human's choice
 *
 * Required when resolvedBy.kind == "human": escalation metadata
 */
export interface AmbiguityResolution {
  /** Report being resolved */
  reportId: string;
  /** Choice made */
  choice: ResolutionChoice;
  /** Actor who resolved */
  resolvedBy: ActorRef;
  /** When resolved (ISO 8601) */
  resolvedAt: string;
  /** Escalation metadata (required for human resolution) */
  escalation?: EscalationMetadata;
}

export const AmbiguityResolutionSchema = z.object({
  reportId: z.string(),
  choice: ResolutionChoiceSchema,
  resolvedBy: ActorRefSchema,
  resolvedAt: z.string(),
  escalation: EscalationMetadataSchema.optional(),
});

// =============================================================================
// Constants
// =============================================================================

/** Universal cancel option ID */
export const OPT_CANCEL = "opt-cancel";

// =============================================================================
// Helper Functions
// =============================================================================

/** Create an opt-cancel candidate */
export function createOptCancelCandidate(
  description = "Cancel: do not apply any changes"
): AmbiguityCandidate {
  return {
    optionId: OPT_CANCEL,
    description,
    fragments: [],
    confidence: 1.0,
  };
}

/** Check if a resolution chose opt-cancel */
export function isOptCancel(resolution: AmbiguityResolution): boolean {
  return (
    resolution.choice.kind === "option" &&
    resolution.choice.optionId === OPT_CANCEL
  );
}
