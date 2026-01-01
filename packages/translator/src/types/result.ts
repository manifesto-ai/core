/**
 * Translation result types
 */

import type { AmbiguityReport } from "./proposal.js";
import type { PatchFragment } from "./fragment.js";

/** Translation result with fragment */
export interface TranslationResultFragment {
  readonly kind: "fragment";
  readonly fragment: PatchFragment;
}

/** Translation result with ambiguity */
export interface TranslationResultAmbiguity {
  readonly kind: "ambiguity";
  readonly report: AmbiguityReport;
}

/** Translation result discarded */
export interface TranslationResultDiscarded {
  readonly kind: "discarded";
  readonly reason: string;
}

/** Final translation result (discriminated union) */
export type TranslationResult =
  | TranslationResultFragment
  | TranslationResultAmbiguity
  | TranslationResultDiscarded;
