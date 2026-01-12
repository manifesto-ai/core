/**
 * @fileoverview Predicate Normalization (SPEC Section 11.4.1)
 *
 * Sort predicates by (lhs, op, rhs.kind, canonicalize(rhs)) tuple.
 */

import { toJcs } from "@manifesto-ai/core";
import type { Pred } from "../schema/index.js";
import { normalizeTermSemantic, normalizeTermStrict } from "./normalize-term.js";

/**
 * Sort predicates for canonicalization (FDR-INT-CAN-004).
 *
 * AND conditions have no semantic order (A AND B === B AND A).
 * Sorting ensures permutation invariance.
 */
export function sortPredicates(preds: readonly Pred[], mode: "semantic" | "strict"): Pred[] {
  const normalizeTerm = mode === "semantic" ? normalizeTermSemantic : normalizeTermStrict;

  return [...preds].sort((a, b) => {
    // 1. Compare lhs
    const lhsCmp = a.lhs.localeCompare(b.lhs);
    if (lhsCmp !== 0) return lhsCmp;

    // 2. Compare op
    const opCmp = a.op.localeCompare(b.op);
    if (opCmp !== 0) return opCmp;

    // 3. Compare rhs.kind
    const kindCmp = a.rhs.kind.localeCompare(b.rhs.kind);
    if (kindCmp !== 0) return kindCmp;

    // 4. Compare canonicalized rhs
    const aRhsCanonical = toJcs(normalizeTerm(a.rhs));
    const bRhsCanonical = toJcs(normalizeTerm(b.rhs));
    return aRhsCanonical.localeCompare(bRhsCanonical);
  });
}
