/**
 * @fileoverview Semantic Canonicalization (SPEC Section 11)
 *
 * Canonicalize for similarity search - removes ValueTerm.raw.
 * Same meaning -> same bytes (regardless of surface form).
 */

import { toJcs } from "@manifesto-ai/core";
import type { IntentIR, Pred, Args, Term } from "../schema/index.js";
import { normalizeTermSemantic } from "./normalize-term.js";
import { sortPredicates } from "./normalize-pred.js";

/**
 * Semantically canonicalize IntentIR.
 *
 * Used for: simKey generation, similarity search, clustering.
 *
 * Rules applied:
 * 1. Uppercase lemma
 * 2. Normalize terms (remove raw)
 * 3. Sort args keys lexicographically (RFC 8785)
 * 4. Sort cond predicates
 * 5. Remove empty optional fields
 *
 * Invariants:
 * - Idempotent: canonicalize(canonicalize(ir)) === canonicalize(ir)
 * - Order-invariant: cond order doesn't affect result
 */
export function canonicalizeSemantic(ir: IntentIR): IntentIR {
  // 1. Uppercase lemma
  const event = {
    lemma: ir.event.lemma.trim().toUpperCase(),
    class: ir.event.class,
  };

  // 2. Normalize args (normalize each term)
  const args = normalizeArgs(ir.args);

  // 3. Sort and normalize predicates
  const cond = ir.cond ? sortPredicates(ir.cond, "semantic") : undefined;
  const normalizedCond = cond?.map((pred) => ({
    ...pred,
    rhs: normalizeTermSemantic(pred.rhs),
  }));

  // 4. Build result with empty fields removed
  const result: IntentIR = {
    v: ir.v,
    force: ir.force,
    event,
    args,
  };

  // Add optional fields only if non-empty
  if (normalizedCond && normalizedCond.length > 0) {
    result.cond = normalizedCond;
  }

  if (ir.mod !== undefined) {
    result.mod = ir.mod;
  }

  if (ir.time !== undefined && hasValue(ir.time)) {
    result.time = ir.time;
  }

  if (ir.verify !== undefined && hasValue(ir.verify)) {
    result.verify = ir.verify;
  }

  if (ir.out !== undefined && hasValue(ir.out)) {
    result.out = ir.out;
  }

  if (ir.ext !== undefined && Object.keys(ir.ext).length > 0) {
    result.ext = ir.ext;
  }

  return result;
}

/**
 * Serialize semantically canonicalized IntentIR to JCS string.
 */
export function toSemanticCanonicalString(ir: IntentIR): string {
  const canonical = canonicalizeSemantic(ir);
  return toJcs(canonical);
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeArgs(args: Args): Args {
  const result: Args = {};

  const entries = Object.entries(args).sort(([a], [b]) => a.localeCompare(b));

  for (const [role, term] of entries) {
    if (term !== undefined) {
      (result as Record<string, Term>)[role] = normalizeTermSemantic(term);
    }
  }

  return result;
}

function hasValue(obj: object): boolean {
  return Object.keys(obj).length > 0;
}
