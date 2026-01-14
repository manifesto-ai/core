/**
 * @fileoverview Learn Action
 *
 * Handles learning new lemma mappings.
 * Supports confirm (from pending) and direct mapping operations.
 * Aligned with SPEC §6.4.
 */

import {
  type LearnInput,
  type LearnOutput,
  type TranslatorState,
  type LearnedEntry,
  type LearnedAliasEntry,
  type PendingMapping,
  createError,
  isConfirmMapping,
  isDirectMapping,
} from "../types/index.js";

// =============================================================================
// Types
// =============================================================================

/**
 * Learn action context
 */
export type LearnContext = {
  /** Current translator state */
  readonly state: TranslatorState;
};

/**
 * Learn action result with updated state
 */
export type LearnActionResult = {
  readonly output: LearnOutput;
  readonly updatedState?: TranslatorState;
};

// =============================================================================
// Action Implementation
// =============================================================================

/**
 * Execute learn action
 *
 * Adds a new learned entry to the lexicon.
 *
 * @param input - Learn action input
 * @param context - Action context with state
 * @returns LearnActionResult with output and optional updated state
 */
export function learn(
  input: LearnInput,
  context: LearnContext
): LearnActionResult {
  const { state } = context;
  const { mapping } = input;

  if (isConfirmMapping(mapping)) {
    return handleConfirmMapping(mapping.pendingId, mapping.correctedTargetLemma, state);
  }

  if (isDirectMapping(mapping)) {
    return handleDirectMapping(mapping.lemma, mapping.targetLemma, state);
  }

  return {
    output: {
      kind: "error",
      error: createError(
        "LEARN_FAILED",
        "Unknown mapping kind",
        { stage: "learn", recoverable: false }
      ),
    },
  };
}

// =============================================================================
// Mapping Handlers
// =============================================================================

/**
 * Handle confirm mapping - confirm a pending mapping
 */
function handleConfirmMapping(
  pendingId: string,
  correctedTargetLemma: string | undefined,
  state: TranslatorState
): LearnActionResult {
  // Find pending mapping
  const pending = state.pendingMappings.find((p) => p.id === pendingId);

  if (!pending) {
    return {
      output: {
        kind: "error",
        error: createError(
          "LEARN_FAILED",
          `No pending mapping found for id: ${pendingId}`,
          { stage: "learn", recoverable: true }
        ),
      },
    };
  }

  const targetLemma = correctedTargetLemma ?? pending.candidateTargetLemma;

  // Check for existing entry
  const existing = state.learnedEntries[pending.lemma];
  if (existing) {
    return {
      output: {
        kind: "conflict",
        existing,
      },
    };
  }

  // Create new learned entry
  const entry: LearnedAliasEntry = {
    kind: "alias",
    lemma: pending.lemma,
    targetLemma,
    learnedAt: new Date().toISOString(),
    learnedFrom: pending.requestId,
  };

  // Update state
  const updatedEntries = { ...state.learnedEntries, [pending.lemma]: entry };
  const updatedPending = state.pendingMappings.filter((p) => p.id !== pendingId);

  return {
    output: {
      kind: "success",
      entry,
    },
    updatedState: {
      ...state,
      learnedEntries: updatedEntries,
      pendingMappings: updatedPending,
    },
  };
}

/**
 * Handle direct mapping - create mapping without pending
 */
function handleDirectMapping(
  lemma: string,
  targetLemma: string,
  state: TranslatorState
): LearnActionResult {
  // Validate
  if (!lemma || typeof lemma !== "string") {
    return {
      output: {
        kind: "error",
        error: createError(
          "LEARN_FAILED",
          "lemma is required and must be a string",
          { stage: "learn", recoverable: true }
        ),
      },
    };
  }

  if (!targetLemma || typeof targetLemma !== "string") {
    return {
      output: {
        kind: "error",
        error: createError(
          "LEARN_FAILED",
          "targetLemma is required and must be a string",
          { stage: "learn", recoverable: true }
        ),
      },
    };
  }

  // Check for existing entry
  const existing = state.learnedEntries[lemma];
  if (existing) {
    return {
      output: {
        kind: "conflict",
        existing,
      },
    };
  }

  // Create new learned entry
  const entry: LearnedAliasEntry = {
    kind: "alias",
    lemma,
    targetLemma,
    learnedAt: new Date().toISOString(),
    learnedFrom: "direct",
  };

  // Update state
  const updatedEntries = { ...state.learnedEntries, [lemma]: entry };

  return {
    output: {
      kind: "success",
      entry,
    },
    updatedState: {
      ...state,
      learnedEntries: updatedEntries,
    },
  };
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find learned entry by lemma
 */
export function findLearnedEntry(
  state: TranslatorState,
  lemma: string
): LearnedEntry | undefined {
  return state.learnedEntries[lemma];
}

/**
 * Find learned entries by target lemma
 */
export function findEntriesByTargetLemma(
  state: TranslatorState,
  targetLemma: string
): readonly LearnedEntry[] {
  return Object.values(state.learnedEntries).filter(
    (entry) => entry.kind === "alias" && entry.targetLemma === targetLemma
  );
}

/**
 * Remove learned entry from state
 */
export function removeLearnedEntry(
  state: TranslatorState,
  lemma: string
): TranslatorState {
  const { [lemma]: _, ...remaining } = state.learnedEntries;
  return {
    ...state,
    learnedEntries: remaining,
  };
}

/**
 * List all learned entries
 */
export function listLearnedEntries(
  state: TranslatorState
): readonly LearnedEntry[] {
  return Object.values(state.learnedEntries);
}

/**
 * Find pending mapping by ID
 */
export function findPendingMapping(
  state: TranslatorState,
  pendingId: string
): PendingMapping | undefined {
  return state.pendingMappings.find((p) => p.id === pendingId);
}

/**
 * List all pending mappings
 */
export function listPendingMappings(
  state: TranslatorState
): readonly PendingMapping[] {
  return state.pendingMappings;
}
