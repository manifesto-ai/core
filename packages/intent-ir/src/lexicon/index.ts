/**
 * @fileoverview Lexicon Module Exports
 *
 * Lexicon is the arbiter of validity.
 * Feature checking against Lexicon is decidable.
 */

export type {
  Lexicon,
  EventEntry,
  ThetaFrame,
  SelectionalRestriction,
  Footprint,
  PolicyHints,
  EntitySpec,
} from "./interface.js";

export { createLexicon, type LexiconConfig } from "./factory.js";

export { checkFeatures, type CheckResult, type CheckError } from "./check.js";
