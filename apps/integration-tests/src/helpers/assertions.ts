/**
 * Custom Assertion Helpers
 *
 * Helpers for common test assertions.
 */

import { expect } from "vitest";
import type { Snapshot, Patch } from "@manifesto-ai/core";

/**
 * Assert that a patch was applied at the given path.
 *
 * @param snapshot - Snapshot to check
 * @param path - Dot-separated path
 * @param expectedValue - Expected value at path
 */
export function expectPatchApplied(
  snapshot: Snapshot,
  path: string,
  expectedValue: unknown
): void {
  const parts = path.split(".");
  let current: unknown = snapshot.data;

  for (const part of parts) {
    if (current === null || current === undefined) {
      throw new Error(`Path ${path} not found in snapshot.data`);
    }
    current = (current as Record<string, unknown>)[part];
  }

  expect(current).toEqual(expectedValue);
}

/**
 * Assert snapshot system status.
 *
 * @param snapshot - Snapshot to check
 * @param status - Expected status
 */
export function expectSnapshotStatus(
  snapshot: Snapshot,
  status: "idle" | "pending" | "error"
): void {
  expect(snapshot.system.status).toBe(status);
}

/**
 * Assert no errors in snapshot.
 *
 * @param snapshot - Snapshot to check
 */
export function expectNoErrors(snapshot: Snapshot): void {
  expect(snapshot.system.lastError).toBeNull();
  expect(snapshot.system.errors).toHaveLength(0);
}

/**
 * Assert patch count.
 *
 * @param patches - Patches array
 * @param count - Expected count
 */
export function expectPatchCount(patches: Patch[], count: number): void {
  expect(patches).toHaveLength(count);
}

/**
 * Assert patch operation.
 *
 * @param patch - Patch to check
 * @param op - Expected operation
 * @param path - Expected path
 * @param value - Expected value (optional)
 */
export function expectPatch(
  patch: Patch,
  op: "set" | "unset" | "merge",
  path: string,
  value?: unknown
): void {
  expect(patch.op).toBe(op);
  expect(patch.path).toBe(path);
  if (value !== undefined) {
    expect(patch.value).toEqual(value);
  }
}

/**
 * Assert array contains item matching predicate.
 *
 * @param array - Array to search
 * @param predicate - Match predicate
 */
export function expectArrayContains<T>(
  array: T[],
  predicate: (item: T) => boolean
): void {
  const found = array.find(predicate);
  expect(found).toBeDefined();
}

/**
 * Assert value is within range.
 *
 * @param value - Value to check
 * @param min - Minimum (inclusive)
 * @param max - Maximum (inclusive)
 */
export function expectInRange(
  value: number,
  min: number,
  max: number
): void {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
}

/**
 * Assert evaluation result is null (for total function testing).
 *
 * @param result - Result to check
 */
export function expectNull(result: unknown): void {
  expect(result).toBeNull();
}

/**
 * Assert evaluation result is not null.
 *
 * @param result - Result to check
 */
export function expectNotNull<T>(result: T | null): asserts result is T {
  expect(result).not.toBeNull();
}
