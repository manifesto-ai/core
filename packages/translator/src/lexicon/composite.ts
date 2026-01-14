/**
 * @fileoverview Composite Lexicon
 *
 * 3-layer composite lexicon with lookup order: Learned → Project → Builtin
 * Aligned with SPEC §7.1 and FDR-TAPP-014.
 */

import type { Lexicon, EventEntry, EntitySpec, IntentIR } from "@manifesto-ai/intent-ir";
import type { LexiconSource } from "../types/index.js";

/**
 * Composite lexicon lookup result with source
 */
export type LookupResult<T> = {
  readonly value: T;
  readonly source: LexiconSource;
};

/**
 * Create a 3-layer composite lexicon
 *
 * Lookup order: Learned → Project → Builtin
 *
 * @param learned - Learned lexicon (user-added entries)
 * @param project - Project lexicon (from DomainSchema)
 * @param builtin - Builtin operator lexicon (always present)
 */
export function createCompositeLexicon(
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon
): Lexicon {
  return {
    resolveEvent(lemma: string): EventEntry | undefined {
      return (
        learned.resolveEvent(lemma) ??
        project.resolveEvent(lemma) ??
        builtin.resolveEvent(lemma)
      );
    },

    resolveEntity(entityType: string): EntitySpec | undefined {
      return (
        learned.resolveEntity?.(entityType) ??
        project.resolveEntity?.(entityType) ??
        builtin.resolveEntity?.(entityType)
      );
    },

    resolveActionType(lemma: string): string | undefined {
      return (
        learned.resolveActionType(lemma) ??
        project.resolveActionType(lemma) ??
        builtin.resolveActionType(lemma)
      );
    },

    mapArgsToInput(
      args: IntentIR["args"],
      cond?: IntentIR["cond"]
    ): unknown {
      // Use project mapper as primary (domain-specific)
      // Fall back to builtin mapper
      return project.mapArgsToInput(args, cond);
    },

    deriveScopeProposal(ir: IntentIR) {
      return (
        learned.deriveScopeProposal?.(ir) ??
        project.deriveScopeProposal?.(ir) ??
        builtin.deriveScopeProposal?.(ir)
      );
    },
  };
}

/**
 * Resolve event with source tracking
 */
export function resolveEventWithSource(
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon,
  lemma: string
): LookupResult<EventEntry> | undefined {
  const learnedEntry = learned.resolveEvent(lemma);
  if (learnedEntry) {
    return { value: learnedEntry, source: "learned" };
  }

  const projectEntry = project.resolveEvent(lemma);
  if (projectEntry) {
    return { value: projectEntry, source: "project" };
  }

  const builtinEntry = builtin.resolveEvent(lemma);
  if (builtinEntry) {
    return { value: builtinEntry, source: "builtin" };
  }

  return undefined;
}

/**
 * Resolve action type with source tracking
 */
export function resolveActionTypeWithSource(
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon,
  lemma: string
): LookupResult<string> | undefined {
  const learnedType = learned.resolveActionType(lemma);
  if (learnedType) {
    return { value: learnedType, source: "learned" };
  }

  const projectType = project.resolveActionType(lemma);
  if (projectType) {
    return { value: projectType, source: "project" };
  }

  const builtinType = builtin.resolveActionType(lemma);
  if (builtinType) {
    return { value: builtinType, source: "builtin" };
  }

  return undefined;
}

/**
 * Determine which lexicon source a lemma comes from
 */
export function determineLexiconSource(
  learned: Lexicon,
  project: Lexicon,
  builtin: Lexicon,
  lemma: string
): LexiconSource | undefined {
  if (learned.resolveEvent(lemma)) return "learned";
  if (project.resolveEvent(lemma)) return "project";
  if (builtin.resolveEvent(lemma)) return "builtin";
  return undefined;
}
