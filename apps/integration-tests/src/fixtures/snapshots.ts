/**
 * Test Snapshot Fixtures
 *
 * Factory functions for creating test snapshots.
 */

import type { Snapshot } from "@manifesto-ai/core";

export const TEST_SCHEMA_HASH = "test-schema-hash-abc123";

/**
 * Create a basic test snapshot.
 *
 * @param data - Initial data state
 * @returns Snapshot instance
 */
export function createTestSnapshot(
  data: Record<string, unknown> = {}
): Snapshot {
  return {
    data,
    computed: {},
    meta: {
      schemaHash: TEST_SCHEMA_HASH,
      version: 1,
      timestamp: Date.now(),
      randomSeed: "test-seed",
    },
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
  };
}

/**
 * Create a counter domain snapshot.
 *
 * @param count - Initial count value
 * @returns Snapshot instance
 */
export function createCounterSnapshot(count: number = 0): Snapshot {
  return createTestSnapshot({ count });
}

/**
 * Create a tasks domain snapshot.
 *
 * @param tasks - Initial tasks array
 * @returns Snapshot instance
 */
export function createTasksSnapshot(tasks: unknown[] = []): Snapshot {
  return createTestSnapshot({
    tasks,
    selectedTaskId: null,
    viewMode: "kanban",
    isCreating: false,
    isEditing: false,
  });
}

/**
 * Create an evaluation snapshot (minimal for evaluation testing).
 *
 * @param data - Data state
 * @param computed - Computed values
 * @returns Evaluation snapshot shape
 */
export function createEvaluationSnapshot(
  data: unknown = {},
  computed: Record<string, unknown> = {}
): { data: unknown; computed: Record<string, unknown> } {
  return { data, computed };
}
