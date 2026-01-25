/**
 * Translation Result (SPEC-1.1.1v §6.10)
 *
 * The final result of a translation call.
 */

import { z } from "zod";
import type { AmbiguityReport } from "./ambiguity.js";
import { AmbiguityReportSchema } from "./ambiguity.js";
import type { PatchFragment } from "./patch-fragment.js";
import { PatchFragmentSchema } from "./patch-fragment.js";
import type { TranslationTrace } from "./trace.js";
import { TranslationTraceSchema } from "./trace.js";
import type { TranslationError } from "./errors.js";
import { TranslationErrorSchema } from "./errors.js";

// =============================================================================
// TranslationResult
// =============================================================================

/** Successful translation with fragments */
export interface TranslationResultFragment {
  kind: "fragment";
  fragments: PatchFragment[];
  trace: TranslationTrace;
}

/** Translation resulted in ambiguity requiring Human decision */
export interface TranslationResultAmbiguity {
  kind: "ambiguity";
  report: AmbiguityReport;
  trace: TranslationTrace;
}

/** Translation failed with error */
export interface TranslationResultError {
  kind: "error";
  error: TranslationError;
  trace: TranslationTrace;
}

/**
 * TranslationResult: Final result of translation
 *
 * Fragment Result Semantics:
 * - len(fragments) >= 1: Semantic changes proposed (normal)
 * - len(fragments) == 0: No-op (ONLY from opt-cancel resolution)
 *
 * When translate() produces fragment result directly (not via resolution),
 * len(fragments) >= 1. If proposer produces zero fragments, it MUST return
 * error(NO_FRAGMENTS_PRODUCED).
 */
export type TranslationResult =
  | TranslationResultFragment
  | TranslationResultAmbiguity
  | TranslationResultError;

export const TranslationResultSchema: z.ZodType<TranslationResult> =
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("fragment"),
      fragments: z.array(PatchFragmentSchema),
      trace: TranslationTraceSchema,
    }),
    z.object({
      kind: z.literal("ambiguity"),
      report: AmbiguityReportSchema,
      trace: TranslationTraceSchema,
    }),
    z.object({
      kind: z.literal("error"),
      error: TranslationErrorSchema,
      trace: TranslationTraceSchema,
    }),
  ]);

// =============================================================================
// Helper Functions
// =============================================================================

/** Check if result is successful with fragments */
export function isFragmentResult(
  result: TranslationResult
): result is TranslationResultFragment {
  return result.kind === "fragment";
}

/** Check if result is ambiguity */
export function isAmbiguityResult(
  result: TranslationResult
): result is TranslationResultAmbiguity {
  return result.kind === "ambiguity";
}

/** Check if result is error */
export function isErrorResult(
  result: TranslationResult
): result is TranslationResultError {
  return result.kind === "error";
}

/** Check if result is a no-op (opt-cancel resolution) */
export function isNoOpResult(result: TranslationResult): boolean {
  return result.kind === "fragment" && result.fragments.length === 0;
}
