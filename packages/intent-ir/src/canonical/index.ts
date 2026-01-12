/**
 * @fileoverview Canonicalization Module Exports
 *
 * Two canonicalization modes per SPEC Section 11.2:
 * - Semantic: For similarity search (raw removed)
 * - Strict: For exact reproduction (raw normalized)
 */

export {
  canonicalizeSemantic,
  toSemanticCanonicalString,
} from "./semantic.js";

export {
  canonicalizeStrict,
  toStrictCanonicalString,
} from "./strict.js";

export {
  normalizeTermSemantic,
  normalizeTermStrict,
} from "./normalize-term.js";

export { sortPredicates } from "./normalize-pred.js";
