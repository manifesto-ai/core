/**
 * Common test intent helper
 */
import { createIntent, type Intent } from "@manifesto-ai/core";

let intentCounter = 0;

/**
 * Reset the intent counter (use in beforeEach for predictable tests)
 */
export function resetIntentCounter(): void {
  intentCounter = 0;
}

/**
 * Get the next unique intent ID
 */
export function nextIntentId(): string {
  return `intent-${intentCounter++}`;
}

/**
 * Create a test intent with optional input
 */
export function createTestIntent(type: string, input?: unknown): Intent {
  return input === undefined
    ? createIntent(type, nextIntentId())
    : createIntent(type, input, nextIntentId());
}

/**
 * Create a test intent with a specific intent ID (for deterministic tests)
 */
export function createTestIntentWithId(
  type: string,
  intentId: string,
  input?: unknown
): Intent {
  return {
    type,
    intentId,
    input,
  };
}
