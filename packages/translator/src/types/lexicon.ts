/**
 * @fileoverview Lexicon-related Types
 *
 * Types for learned lexicon entries and pending mappings.
 * Aligned with SPEC §7 Lexicon and §8 State Model.
 */

import type { EventEntry } from "@manifesto-ai/intent-ir";

/**
 * Source of a pending mapping
 */
export type MappingSource = "llm" | "user" | "inferred";

/**
 * Pending mapping waiting for user confirmation
 * SPEC §8.3
 */
export type PendingMapping = {
  readonly id: string;
  /** New lemma to learn */
  readonly lemma: string;
  /** Target existing lemma for mapping (LLM or user proposed) */
  readonly candidateTargetLemma: string;
  /** Confidence score (0-1) */
  readonly confidence: number;
  /** How this mapping was proposed */
  readonly source: MappingSource;
  /** Request that triggered this pending mapping */
  readonly requestId: string;
  /** ISO 8601 timestamp */
  readonly createdAt: string;
};

/**
 * Learned lexicon entry - Alias strategy (recommended)
 * SPEC §8.4
 */
export type LearnedAliasEntry = {
  readonly kind: "alias";
  readonly lemma: string;
  readonly targetLemma: string;
  readonly learnedAt: string;
  readonly learnedFrom: string;
};

/**
 * Learned lexicon entry - Clone strategy
 * SPEC §8.4
 */
export type LearnedCloneEntry = {
  readonly kind: "clone";
  readonly lemma: string;
  readonly entry: EventEntry;
  readonly actionType: string;
  readonly learnedAt: string;
  readonly learnedFrom: string;
};

/**
 * Learned entry - either alias or clone
 */
export type LearnedEntry = LearnedAliasEntry | LearnedCloneEntry;

/**
 * Type guard for alias entry
 */
export function isAliasEntry(entry: LearnedEntry): entry is LearnedAliasEntry {
  return entry.kind === "alias";
}

/**
 * Type guard for clone entry
 */
export function isCloneEntry(entry: LearnedEntry): entry is LearnedCloneEntry {
  return entry.kind === "clone";
}
