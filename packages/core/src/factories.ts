import type { Snapshot } from "./schema/snapshot.js";
import type { Intent } from "./schema/patch.js";
import { createInitialSystemState } from "./schema/snapshot.js";

/**
 * Create a new snapshot with initial data
 *
 * @param data - Initial domain data
 * @param schemaHash - Hash of the schema this snapshot conforms to
 * @returns New snapshot
 */
export function createSnapshot<T>(data: T, schemaHash: string): Snapshot {
  return {
    data,
    computed: {},
    system: createInitialSystemState(),
    input: undefined,
    meta: {
      version: 0,
      timestamp: Date.now(),
      schemaHash,
    },
  };
}

/**
 * Create an intent
 *
 * @param type - Action type
 * @param input - Action input (optional)
 * @param intentId - Unique identifier for this processing attempt (optional, auto-generated if not provided)
 * @returns Intent
 */
export function createIntent(
  type: string,
  input?: unknown,
  intentId?: string
): Intent {
  return {
    type,
    input,
    intentId: intentId ?? generateIntentId(),
  };
}

/**
 * Generate a unique intent ID
 */
function generateIntentId(): string {
  return `intent-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
