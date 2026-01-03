import type { Snapshot } from "./schema/snapshot.js";
import type { Intent } from "./schema/patch.js";
import type { HostContext } from "./schema/host-context.js";
import { createInitialSystemState } from "./schema/snapshot.js";

/**
 * Create a new snapshot with initial data
 *
 * @param data - Initial domain data
 * @param schemaHash - Hash of the schema this snapshot conforms to
 * @returns New snapshot
 */
export function createSnapshot<T>(
  data: T,
  schemaHash: string,
  context: HostContext
): Snapshot {
  return {
    data,
    computed: {},
    system: createInitialSystemState(),
    input: undefined,
    meta: {
      version: 0,
      timestamp: context.now,
      randomSeed: context.randomSeed,
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
export function createIntent(type: string, intentId: string): Intent;
export function createIntent(type: string, input: unknown, intentId: string): Intent;
export function createIntent(
  type: string,
  inputOrIntentId: unknown,
  intentId?: string
): Intent {
  if (intentId === undefined && typeof inputOrIntentId === "string") {
    return {
      type,
      input: undefined,
      intentId: inputOrIntentId,
    };
  }

  if (intentId === undefined) {
    return {
      type,
      input: inputOrIntentId,
      intentId: "",
    };
  }

  return {
    type,
    input: inputOrIntentId,
    intentId,
  };
}
