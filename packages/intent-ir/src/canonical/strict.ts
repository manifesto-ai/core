/**
 * @fileoverview Strict Canonicalization (SPEC Section 11)
 *
 * Canonicalize for exact reproduction - normalizes ValueTerm.raw.
 * Used for strictKey derivation.
 */

import { toJcs } from "@manifesto-ai/core";
import type {
  IntentIR,
  Args,
  Term,
  ResolvedIntentIR,
  ResolvedArgs,
  ResolvedTerm,
} from "../schema/index.js";
import { normalizeTermStrict } from "./normalize-term.js";
import { sortPredicates } from "./normalize-pred.js";

/**
 * Strictly canonicalize IntentIR or ResolvedIntentIR.
 *
 * Used for: strictKey generation, exact reproduction caching.
 *
 * Same rules as semantic, but preserves and normalizes raw values.
 */
export function canonicalizeStrict<T extends IntentIR | ResolvedIntentIR>(
  ir: T
): T {
  // 1. Uppercase lemma
  const event = {
    lemma: ir.event.lemma.trim().toUpperCase(),
    class: ir.event.class,
  };

  // 2. Normalize args (normalize each term, keeping raw)
  const args = normalizeArgsStrict(ir.args as Args | ResolvedArgs);

  // 3. Sort and normalize predicates
  const cond = ir.cond ? sortPredicates(ir.cond, "strict") : undefined;
  const normalizedCond = cond?.map((pred) => ({
    ...pred,
    rhs: normalizeTermStrict(pred.rhs),
  }));

  // 4. Build result with empty fields removed
  const result = {
    v: ir.v,
    force: ir.force,
    event,
    args,
  } as T;

  // Add optional fields only if non-empty
  if (normalizedCond && normalizedCond.length > 0) {
    (result as IntentIR).cond = normalizedCond;
  }

  if (ir.mod !== undefined) {
    (result as IntentIR).mod = ir.mod;
  }

  if (ir.time !== undefined && hasValue(ir.time)) {
    (result as IntentIR).time = ir.time;
  }

  if (ir.verify !== undefined && hasValue(ir.verify)) {
    (result as IntentIR).verify = ir.verify;
  }

  if (ir.out !== undefined && hasValue(ir.out)) {
    (result as IntentIR).out = ir.out;
  }

  if (ir.ext !== undefined && Object.keys(ir.ext).length > 0) {
    (result as IntentIR).ext = ir.ext;
  }

  return result;
}

/**
 * Serialize strictly canonicalized IntentIR to JCS string.
 */
export function toStrictCanonicalString(ir: IntentIR | ResolvedIntentIR): string {
  const canonical = canonicalizeStrict(ir);
  return toJcs(canonical);
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeArgsStrict(args: Args | ResolvedArgs): Args | ResolvedArgs {
  const result: Record<string, Term | ResolvedTerm> = {};

  const entries = Object.entries(args).sort(([a], [b]) => a.localeCompare(b));

  for (const [role, term] of entries) {
    if (term !== undefined) {
      result[role] = normalizeTermStrict(term);
    }
  }

  return result as Args | ResolvedArgs;
}

function hasValue(obj: object): boolean {
  return Object.keys(obj).length > 0;
}
