/**
 * @fileoverview Lowering (SPEC Section 13)
 *
 * Lower IntentIR to IntentBody.
 *
 * Pipeline:
 * IntentIR (semantic structure)
 *    ↓ lower()
 * IntentBody (protocol intent)
 *    ↓ Issuer.issue()
 * IntentInstance (executable attempt)
 */

import type { IntentIR, ResolvedIntentIR } from "../schema/index.js";
import type { Lexicon } from "../lexicon/index.js";
import type { Resolver, ResolutionContext } from "../resolver/index.js";
import type { IntentBody } from "../keys/types.js";

// =============================================================================
// LoweringError
// =============================================================================

/**
 * Error during lowering (as value, not exception).
 */
export type LoweringError =
  | { readonly code: "UNKNOWN_LEMMA"; readonly lemma: string }
  | { readonly code: "RESOLUTION_FAILED"; readonly message: string };

/**
 * Lowering result type.
 */
export type LowerResult =
  | { readonly ok: true; readonly body: IntentBody; readonly resolvedIR: ResolvedIntentIR }
  | { readonly ok: false; readonly error: LoweringError };

// =============================================================================
// lower
// =============================================================================

/**
 * Lower IntentIR to IntentBody.
 *
 * Per SPEC Section 13.3:
 * 1. Resolve action type from lemma
 * 2. Resolve discourse references (this/that/last -> id)
 * 3. Map args + cond to domain input (cond becomes filter)
 * 4. Derive scope proposal if write operation
 *
 * @example
 * const result = lower(ir, lexicon, resolver, context);
 * if (result.ok) {
 *   const { body, resolvedIR } = result;
 *   // Use body for protocol, resolvedIR for strictKey
 * }
 */
export function lower(
  ir: IntentIR,
  lexicon: Lexicon,
  resolver: Resolver,
  context?: ResolutionContext
): LowerResult {
  // 1. Resolve action type from lemma
  const actionType = lexicon.resolveActionType(ir.event.lemma);
  if (!actionType) {
    return {
      ok: false,
      error: { code: "UNKNOWN_LEMMA", lemma: ir.event.lemma },
    };
  }

  // 2. Resolve discourse references (this/that/last -> id)
  let resolvedIR: ResolvedIntentIR;
  try {
    resolvedIR = resolver.resolveReferences(ir, context);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: "RESOLUTION_FAILED",
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }

  // 3. Map args + cond to domain input (cond becomes filter)
  const input = lexicon.mapArgsToInput(resolvedIR.args, resolvedIR.cond);

  // 4. Derive scope proposal if write operation
  const scopeProposal = lexicon.deriveScopeProposal?.(resolvedIR);

  const body: IntentBody = {
    type: actionType,
    ...(input !== undefined && { input }),
    ...(scopeProposal && { scopeProposal }),
  };

  return { ok: true, body, resolvedIR };
}

// =============================================================================
// lowerOrThrow (convenience)
// =============================================================================

/**
 * Lower IntentIR to IntentBody, throwing on error.
 *
 * Use when you want exception-based error handling.
 */
export function lowerOrThrow(
  ir: IntentIR,
  lexicon: Lexicon,
  resolver: Resolver,
  context?: ResolutionContext
): { body: IntentBody; resolvedIR: ResolvedIntentIR } {
  const result = lower(ir, lexicon, resolver, context);

  if (!result.ok) {
    const error = result.error;
    switch (error.code) {
      case "UNKNOWN_LEMMA":
        throw new Error(`Unknown lemma: ${error.lemma}`);
      case "RESOLUTION_FAILED":
        throw new Error(`Resolution failed: ${error.message}`);
    }
  }

  return { body: result.body, resolvedIR: result.resolvedIR };
}
