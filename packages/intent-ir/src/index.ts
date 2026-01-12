/**
 * @manifesto-ai/intent-ir
 *
 * Chomskyan LF-based Intermediate Representation for natural language intent.
 *
 * Architecture:
 * - PF (Natural Language) -> IntentIR (LF) -> IntentBody (Protocol)
 * - Lexicon provides feature checking for validity
 * - Same LF = Same meaning (regardless of surface form)
 *
 * Key Principles:
 * 1. Structure is meaning (not strings, not tokens)
 * 2. Lexicon is the arbiter of validity
 * 3. Same meaning, same form (canonicalization)
 * 4. IR is intent, not plan (execution is downstream)
 * 5. Functional heads are finite and enumerated
 *
 * @packageDocumentation
 */

// =============================================================================
// Version
// =============================================================================

export { INTENT_IR_VERSION } from "./constants.js";

// =============================================================================
// Schemas (SPEC Section 15)
// =============================================================================

export * from "./schema/index.js";

// =============================================================================
// Canonicalization (SPEC Section 11)
// =============================================================================

export {
  canonicalizeSemantic,
  canonicalizeStrict,
  toSemanticCanonicalString,
  toStrictCanonicalString,
  normalizeTermSemantic,
  normalizeTermStrict,
  sortPredicates,
} from "./canonical/index.js";

// =============================================================================
// Key Derivation (SPEC Section 12)
// =============================================================================

export {
  deriveIntentKey,
  deriveIntentKeySync,
  deriveStrictKey,
  deriveStrictKeySync,
  deriveSimKey,
  simhashDistance,
  type IntentBody,
  type IntentScope,
  type Footprint as KeyFootprint,
  type ExecutionContext,
  type Snapshot as KeySnapshot,
} from "./keys/index.js";

// =============================================================================
// Lexicon (SPEC Section 14)
// =============================================================================

export {
  createLexicon,
  checkFeatures,
  type Lexicon,
  type LexiconConfig,
  type EventEntry,
  type ThetaFrame,
  type SelectionalRestriction,
  type Footprint,
  type PolicyHints,
  type EntitySpec,
  type CheckResult,
  type CheckError,
} from "./lexicon/index.js";

// =============================================================================
// Resolver (SPEC Section 8.2)
// =============================================================================

export {
  createResolver,
  type Resolver,
  type ResolutionContext,
  type FocusEntry,
  type DiscourseEntry,
} from "./resolver/index.js";

// =============================================================================
// Lowering (SPEC Section 13)
// =============================================================================

export {
  lower,
  lowerOrThrow,
  type LowerResult,
  type LoweringError,
} from "./lower/index.js";

// =============================================================================
// Constants
// =============================================================================

export {
  ROLE_ORDER,
  FORCE_VALUES,
  EVENT_CLASS_VALUES,
  ROLE_VALUES,
} from "./constants.js";
