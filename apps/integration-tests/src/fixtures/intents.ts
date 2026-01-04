/**
 * Test Intent Fixtures
 *
 * Factory functions for creating test intents.
 */

import type { Intent } from "@manifesto-ai/core";

/**
 * Create a test intent.
 *
 * @param type - Intent type (action name)
 * @param input - Intent input parameters
 * @param intentId - Optional custom intent ID
 * @returns Intent instance
 */
export function createTestIntent(
  type: string,
  input: Record<string, unknown> = {},
  intentId?: string
): Intent {
  return {
    type,
    input,
    intentId: intentId ?? `intent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

/**
 * Create an increment intent for counter domain.
 */
export function createIncrementIntent(): Intent {
  return createTestIntent("increment");
}

/**
 * Create a decrement intent for counter domain.
 */
export function createDecrementIntent(): Intent {
  return createTestIntent("decrement");
}

/**
 * Create a reset intent for counter domain.
 *
 * @param value - Value to reset to
 */
export function createResetIntent(value: number = 0): Intent {
  return createTestIntent("reset", { value });
}

/**
 * Create a create task intent for tasks domain.
 *
 * @param title - Task title
 * @param description - Task description
 */
export function createTaskIntent(
  title: string,
  description: string = ""
): Intent {
  return createTestIntent("createTask", { title, description });
}

/**
 * Create an update task intent for tasks domain.
 *
 * @param taskId - Task ID to update
 * @param updates - Fields to update
 */
export function updateTaskIntent(
  taskId: string,
  updates: Record<string, unknown>
): Intent {
  return createTestIntent("updateTask", { taskId, ...updates });
}

/**
 * Create a delete task intent for tasks domain.
 *
 * @param taskId - Task ID to delete
 */
export function deleteTaskIntent(taskId: string): Intent {
  return createTestIntent("deleteTask", { taskId });
}
