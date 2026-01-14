/**
 * @fileoverview Lexicon Module Exports
 *
 * Re-exports all lexicon components.
 */

// Builtin lexicon
export {
  BUILTIN_EVENTS,
  BUILTIN_LEMMAS,
  createBuiltinLexicon,
  isBuiltinLemma,
} from "./builtin.js";

// Project lexicon
export {
  type DomainSchemaLike,
  type ActionSpecLike,
  type FieldSpecLike,
  deriveProjectLexicon,
} from "./project.js";

// Learned lexicon
export { createLearnedLexicon, hasLearnedEntry } from "./learned.js";

// Composite lexicon
export {
  type LookupResult,
  createCompositeLexicon,
  resolveEventWithSource,
  resolveActionTypeWithSource,
  determineLexiconSource,
} from "./composite.js";

// Re-export lexicon types from intent-ir
export type {
  Lexicon,
  LexiconConfig,
  EventEntry,
  ThetaFrame,
  SelectionalRestriction,
  Footprint,
  PolicyHints,
  EntitySpec,
} from "@manifesto-ai/intent-ir";
