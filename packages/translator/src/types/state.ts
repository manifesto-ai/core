/**
 * Translator domain state types
 */

import type { FastPathResult } from "./fast-path.js";
import type { NormalizationResult } from "./normalization.js";
import type { ProposalResult } from "./proposal.js";
import type { TranslationRequest } from "./request.js";
import type { RetrievalResult } from "./retrieval.js";
import type { TranslationResult } from "./result.js";

/** Translator domain state */
export interface TranslatorState {
  /** Current translation request */
  readonly request: TranslationRequest | null;

  /** Normalization result */
  readonly normalization: NormalizationResult | null;

  /** Fast path result */
  readonly fastPath: FastPathResult | null;

  /** Retrieval result */
  readonly retrieval: RetrievalResult | null;

  /** Proposal result */
  readonly proposal: ProposalResult | null;

  /** Final translation result */
  readonly result: TranslationResult | null;

  /** Intent marker: initializing */
  readonly initializing: string | null;

  /** Intent marker: normalizing */
  readonly normalizing: string | null;

  /** Intent marker: fast pathing */
  readonly fastPathing: string | null;

  /** Intent marker: retrieving */
  readonly retrieving: string | null;

  /** Intent marker: proposing */
  readonly proposing: string | null;

  /** Intent marker: resolving */
  readonly resolving: string | null;

  /** Intent marker: resetting */
  readonly resetting: string | null;
}

/** Pipeline stage */
export type PipelineStage =
  | "idle"
  | "normalizing"
  | "fast-path"
  | "retrieving"
  | "proposing"
  | "awaiting-resolution"
  | "complete";
