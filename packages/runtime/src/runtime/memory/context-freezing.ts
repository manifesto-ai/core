/**
 * Memory Context Freezing
 *
 * Preserves determinism by freezing memory context into Snapshot.
 *
 * @see SPEC v2.0.0 §11.4
 * @module
 */

import type { Snapshot, RecallResult } from "@manifesto-ai/shared";

/**
 * App-owned input namespace.
 *
 * Uses `$app` prefix to avoid collision with domain input fields.
 *
 * @see SPEC v2.0.0 §11.4
 */
export type AppInputNamespace = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

/**
 * App execution context for internal tracking.
 *
 * NOT part of World SPEC's HostExecutionOptions.
 *
 * @see SPEC v2.0.0 §11.4
 */
export type AppExecutionContext = {
  readonly memoryContext?: unknown;
  readonly memoryRecallFailed?: boolean;
};

/**
 * Freeze memory context into Snapshot.
 *
 * MUST be value copy, NOT reference.
 *
 * MEM-7: Recalled context MUST be frozen as value into `input.$app.memoryContext`
 * MEM-8: Replay MUST use frozen context from `input.$app`, NOT re-query MemoryStore
 *
 * @see SPEC v2.0.0 §11.4
 */
export function freezeMemoryContext<T>(
  snapshot: Snapshot,
  context: T
): Snapshot {
  // Use structuredClone for deep copy (value copy, not reference)
  const frozenContext = structuredClone(context);
  const existingInput = snapshot.input as Record<string, unknown> | undefined;
  const existingApp = getAppNamespace(snapshot) ?? {};

  return {
    ...snapshot,
    input: {
      ...(existingInput ?? {}),
      $app: {
        ...existingApp,
        memoryContext: frozenContext,
      },
    },
  };
}

/**
 * Mark memory recall as failed in Snapshot.
 *
 * Used when recall fails to preserve the failure state for replay.
 */
export function markMemoryRecallFailed(snapshot: Snapshot): Snapshot {
  const existingInput = snapshot.input as Record<string, unknown> | undefined;
  const existingApp = getAppNamespace(snapshot) ?? {};

  return {
    ...snapshot,
    input: {
      ...(existingInput ?? {}),
      $app: {
        ...existingApp,
        memoryRecallFailed: true,
      },
    },
  };
}

/**
 * Get memory context from Snapshot.
 *
 * MEM-8: Replay MUST use frozen context.
 */
export function getMemoryContext<T = unknown>(snapshot: Snapshot): T | undefined {
  const appNamespace = getAppNamespace(snapshot);
  return appNamespace?.memoryContext as T | undefined;
}

/**
 * Check if memory recall was marked as failed.
 */
export function wasMemoryRecallFailed(snapshot: Snapshot): boolean {
  const appNamespace = getAppNamespace(snapshot);
  return appNamespace?.memoryRecallFailed === true;
}

/**
 * Check if Snapshot has frozen memory context.
 */
export function hasMemoryContext(snapshot: Snapshot): boolean {
  const appNamespace = getAppNamespace(snapshot);
  return appNamespace?.memoryContext !== undefined;
}

/**
 * Get the $app namespace from Snapshot input.
 */
function getAppNamespace(snapshot: Snapshot): AppInputNamespace | undefined {
  const input = snapshot.input as Record<string, unknown>;
  return input?.$app as AppInputNamespace | undefined;
}

/**
 * Freeze recall result into Snapshot.
 *
 * Convenience function for freezing RecallResult specifically.
 */
export function freezeRecallResult(
  snapshot: Snapshot,
  result: RecallResult
): Snapshot {
  return freezeMemoryContext(snapshot, {
    attachments: result.attachments,
    selected: result.selected,
    views: result.views,
  });
}

/**
 * Get frozen recall result from Snapshot.
 */
export function getFrozenRecallResult(snapshot: Snapshot): RecallResult | undefined {
  const context = getMemoryContext<{
    attachments: RecallResult["attachments"];
    selected: RecallResult["selected"];
    views: RecallResult["views"];
  }>(snapshot);

  if (!context) {
    return undefined;
  }

  return {
    attachments: context.attachments ?? [],
    selected: context.selected ?? [],
    views: context.views ?? [],
  };
}

/**
 * Clear $app namespace from Snapshot.
 *
 * Used when creating new Snapshots that shouldn't inherit context.
 */
export function clearAppNamespace(snapshot: Snapshot): Snapshot {
  const input = snapshot.input as Record<string, unknown>;
  if (!input || !("$app" in input)) {
    return snapshot;
  }

  const { $app, ...cleanInput } = input;
  return {
    ...snapshot,
    input: cleanInput,
  };
}
