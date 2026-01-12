/**
 * @fileoverview Lexicon Factory
 *
 * Helper for creating Lexicon instances from static configuration.
 */

import type { IntentIR } from "../schema/index.js";
import type { IntentScope } from "../keys/types.js";
import type {
  Lexicon,
  EventEntry,
  EntitySpec,
} from "./interface.js";

// =============================================================================
// LexiconConfig
// =============================================================================

/**
 * Configuration for creating a Lexicon.
 */
export type LexiconConfig = {
  /** Event entries keyed by lemma (uppercase) */
  readonly events: Record<string, EventEntry>;
  /** Entity specifications keyed by type name */
  readonly entities: Record<string, EntitySpec>;
  /** Optional lemma -> action type mapping (defaults to lowercase lemma) */
  readonly actionTypes?: Record<string, string>;
  /** Optional custom args mapper */
  readonly mapArgsToInput?: (
    args: IntentIR["args"],
    cond?: IntentIR["cond"]
  ) => unknown;
  /** Optional custom scope proposal derivation */
  readonly deriveScopeProposal?: (ir: IntentIR) => IntentScope | undefined;
};

// =============================================================================
// createLexicon
// =============================================================================

/**
 * Create a Lexicon from static configuration.
 *
 * Common pattern for domain-specific lexicons.
 *
 * @example
 * const lexicon = createLexicon({
 *   events: {
 *     CANCEL: {
 *       eventClass: "CONTROL",
 *       thetaFrame: {
 *         required: ["TARGET"],
 *         optional: [],
 *         restrictions: {
 *           TARGET: { termKinds: ["entity"], entityTypes: ["Order"] }
 *         }
 *       }
 *     }
 *   },
 *   entities: {
 *     Order: { fields: { id: "string", status: "string" } }
 *   }
 * });
 */
export function createLexicon(config: LexiconConfig): Lexicon {
  return {
    resolveEvent(lemma: string): EventEntry | undefined {
      return config.events[lemma.toUpperCase()];
    },

    resolveEntity(entityType: string): EntitySpec | undefined {
      return config.entities[entityType];
    },

    resolveActionType(lemma: string): string | undefined {
      const upper = lemma.toUpperCase();
      // Check if lemma exists in events first
      if (!config.events[upper]) {
        return undefined; // Unknown lemma
      }
      // Use custom mapping if provided, otherwise lowercase lemma
      return config.actionTypes?.[upper] ?? lemma.toLowerCase();
    },

    mapArgsToInput(
      args: IntentIR["args"],
      cond?: IntentIR["cond"]
    ): unknown {
      // Use custom mapper if provided
      if (config.mapArgsToInput) {
        return config.mapArgsToInput(args, cond);
      }

      // Default implementation: direct mapping
      // Args become input, cond becomes filter
      return {
        args: serializeArgs(args),
        filter: cond?.map(serializePred) ?? undefined,
      };
    },

    deriveScopeProposal: config.deriveScopeProposal,
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Serialize args for IntentBody input.
 */
function serializeArgs(args: IntentIR["args"]): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [role, term] of Object.entries(args)) {
    if (term !== undefined) {
      result[role.toLowerCase()] = serializeTerm(term);
    }
  }

  return result;
}

/**
 * Serialize a term for IntentBody input.
 */
function serializeTerm(term: NonNullable<IntentIR["args"][keyof IntentIR["args"]]>): unknown {
  switch (term.kind) {
    case "entity":
      return {
        type: term.entityType,
        ref: term.ref,
      };

    case "path":
      return term.path;

    case "artifact":
      return term.ref.kind === "inline"
        ? { inline: term.content }
        : { id: term.ref.id };

    case "value":
      // Prefer raw if available, otherwise shape
      return term.raw ?? term.shape;

    case "expr":
      return term.expr;
  }
}

/**
 * Serialize a predicate for filter.
 */
function serializePred(pred: NonNullable<IntentIR["cond"]>[number]): unknown {
  return {
    field: pred.lhs,
    op: pred.op,
    value: serializeTerm(pred.rhs),
  };
}
