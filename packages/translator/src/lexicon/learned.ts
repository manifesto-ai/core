/**
 * @fileoverview Learned Lexicon
 *
 * Creates a Lexicon from learned entries using alias strategy.
 * Aliases map new vocabulary to existing semantic coordinates.
 * Aligned with SPEC §7.4 and FDR-TAPP-019.
 */

import type { Lexicon, EventEntry, EntitySpec, IntentIR } from "@manifesto-ai/intent-ir";
import type { LearnedEntry } from "../types/index.js";
import { isAliasEntry } from "../types/index.js";

/**
 * Create a Learned Lexicon from state entries
 *
 * Implements alias strategy (recommended):
 * - resolveEvent(lemma) → Re-lookup via targetLemma in base lexicon
 * - resolveActionType(lemma) → Returns targetLemma (resolved canonical lemma)
 *
 * @param entries - Learned entries from TranslatorState
 * @param baseLexicon - Base lexicon for re-lookup (Project + Builtin composite)
 */
export function createLearnedLexicon(
  entries: Readonly<Record<string, LearnedEntry>>,
  baseLexicon: Lexicon
): Lexicon {
  return {
    resolveEvent(lemma: string): EventEntry | undefined {
      const upper = lemma.toUpperCase();
      const entry = entries[upper];

      if (!entry) {
        return undefined;
      }

      if (isAliasEntry(entry)) {
        // Alias strategy: re-lookup via targetLemma
        return baseLexicon.resolveEvent(entry.targetLemma);
      } else {
        // Clone strategy: return stored entry
        return entry.entry;
      }
    },

    resolveEntity(entityType: string): EntitySpec | undefined {
      // Learned lexicon does not store entities in v0.1
      return undefined;
    },

    resolveActionType(lemma: string): string | undefined {
      const upper = lemma.toUpperCase();
      const entry = entries[upper];

      if (!entry) {
        return undefined;
      }

      if (isAliasEntry(entry)) {
        // Return targetLemma (resolved canonical lemma)
        return entry.targetLemma;
      } else {
        // Clone strategy: return stored actionType
        return entry.actionType;
      }
    },

    mapArgsToInput(
      args: IntentIR["args"],
      cond?: IntentIR["cond"]
    ): unknown {
      // Delegate to base lexicon
      return baseLexicon.mapArgsToInput(args, cond);
    },

    // deriveScopeProposal not used in learned lexicon
  };
}

/**
 * Check if a lemma exists in learned entries
 */
export function hasLearnedEntry(
  entries: Readonly<Record<string, LearnedEntry>>,
  lemma: string
): boolean {
  return lemma.toUpperCase() in entries;
}
