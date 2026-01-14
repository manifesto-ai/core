/**
 * @fileoverview Builtin Operator Lexicon
 *
 * Minimum required lemmas for schema editing operations.
 * Always present, provides cold-start support.
 * Aligned with SPEC Appendix A.
 */

import {
  createLexicon,
  type Lexicon,
  type EventEntry,
  type LexiconConfig,
} from "@manifesto-ai/intent-ir";

// =============================================================================
// Builtin Event Entries
// =============================================================================

/**
 * DEFINE_TYPE - Define a new type
 */
const DEFINE_TYPE: EventEntry = {
  eventClass: "CREATE",
  thetaFrame: {
    required: ["TARGET"],
    optional: ["INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_FIELD - Add a field to a type
 */
const ADD_FIELD: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET", "THEME"],
    optional: ["INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_CONSTRAINT - Add a constraint to a field
 */
const ADD_CONSTRAINT: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET", "THEME"],
    optional: ["INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

/**
 * SET_DEFAULT - Set a field's default value
 */
const SET_DEFAULT: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET", "THEME"],
    optional: [],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["value"] },
    },
  },
};

/**
 * ADD_COMPUTED - Add a computed value
 */
const ADD_COMPUTED: EventEntry = {
  eventClass: "CREATE",
  thetaFrame: {
    required: ["TARGET"],
    optional: ["INSTRUMENT", "THEME"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
      THEME: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_ACTION - Define an action
 */
const ADD_ACTION: EventEntry = {
  eventClass: "CREATE",
  thetaFrame: {
    required: ["TARGET"],
    optional: ["INSTRUMENT", "THEME"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
      THEME: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_ACTION_PARAM - Add a parameter to an action
 */
const ADD_ACTION_PARAM: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET", "THEME"],
    optional: ["INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["value"], valueTypes: ["string"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_ACTION_GUARD - Add a guard to an action
 */
const ADD_ACTION_GUARD: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET"],
    optional: ["THEME", "INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["artifact"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

/**
 * ADD_ACTION_EFFECT - Add an effect to an action
 */
const ADD_ACTION_EFFECT: EventEntry = {
  eventClass: "TRANSFORM",
  thetaFrame: {
    required: ["TARGET"],
    optional: ["THEME", "INSTRUMENT"],
    restrictions: {
      TARGET: { termKinds: ["value"], valueTypes: ["string"] },
      THEME: { termKinds: ["artifact"] },
      INSTRUMENT: { termKinds: ["artifact"] },
    },
  },
};

// =============================================================================
// Builtin Lexicon Configuration
// =============================================================================

/**
 * All builtin event entries
 */
export const BUILTIN_EVENTS: Readonly<Record<string, EventEntry>> = {
  DEFINE_TYPE,
  ADD_FIELD,
  ADD_CONSTRAINT,
  SET_DEFAULT,
  ADD_COMPUTED,
  ADD_ACTION,
  ADD_ACTION_PARAM,
  ADD_ACTION_GUARD,
  ADD_ACTION_EFFECT,
};

/**
 * Builtin lemma list
 */
export const BUILTIN_LEMMAS = Object.keys(BUILTIN_EVENTS) as readonly string[];

/**
 * Builtin lexicon configuration
 */
const BUILTIN_CONFIG: LexiconConfig = {
  events: BUILTIN_EVENTS,
  entities: {},
  // Action types are same as lemmas for builtin
  actionTypes: Object.fromEntries(
    BUILTIN_LEMMAS.map((lemma) => [lemma, lemma])
  ),
};

// =============================================================================
// Factory
// =============================================================================

/**
 * Create the builtin operator lexicon
 * Always present, never empty
 */
export function createBuiltinLexicon(): Lexicon {
  return createLexicon(BUILTIN_CONFIG);
}

/**
 * Check if a lemma is a builtin operator
 */
export function isBuiltinLemma(lemma: string): boolean {
  return lemma.toUpperCase() in BUILTIN_EVENTS;
}
