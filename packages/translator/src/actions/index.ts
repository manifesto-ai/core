/**
 * @fileoverview Actions Module Exports
 *
 * Re-exports all action implementations.
 */

// Translate Action (Full Pipeline)
export {
  type TranslateContext,
  translate,
} from "./translate.js";

// Lower Action (Deterministic Pipeline)
export {
  type LowerContext,
  lower,
} from "./lower.js";

// Resolve Action (User Disambiguation)
export {
  type ResolveContext,
  resolve,
  findRequest,
  findAmbiguousRequests,
  findUnresolvedRequests,
} from "./resolve.js";

// Learn Action (Lexicon Learning)
export {
  type LearnContext,
  type LearnActionResult,
  learn,
  findLearnedEntry,
  findEntriesByTargetLemma,
  removeLearnedEntry,
  listLearnedEntries,
  findPendingMapping,
  listPendingMappings,
} from "./learn.js";
