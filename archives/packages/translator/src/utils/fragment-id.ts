/**
 * Fragment ID Computation
 *
 * Content-addressed fragment identity per SPEC-1.1.1v §6.6:
 * fragmentId = sha256(intentId + ':' + canonicalize(op))
 */

import { createHash } from "node:crypto";
import type { IntentId } from "../domain/types.js";
import type { PatchOp } from "../domain/patch-fragment.js";
import { canonicalize } from "./canonicalize.js";
import type { JsonValue } from "../domain/types.js";

/**
 * Compute content-addressed fragment ID
 *
 * Identity Rule: fragmentId = sha256(intentId + ':' + canonicalize(op))
 *
 * @param intentId - Source intent identifier
 * @param op - Patch operation
 * @returns Content-addressed fragment ID (hex string)
 */
export function computeFragmentId(intentId: IntentId, op: PatchOp): string {
  // Convert PatchOp to JsonValue for canonicalization
  const opAsJson = patchOpToJson(op);
  const canonicalOp = canonicalize(opAsJson);
  const input = `${intentId}:${canonicalOp}`;

  return createHash("sha256").update(input).digest("hex");
}

/**
 * Convert PatchOp to JsonValue for canonicalization
 *
 * This handles the recursive structure of PatchOp, converting
 * ExprNode and other nested types to plain JSON.
 */
function patchOpToJson(op: PatchOp): JsonValue {
  // PatchOp is already JSON-serializable, but we need to ensure
  // proper handling of all nested structures
  return JSON.parse(JSON.stringify(op)) as JsonValue;
}

/**
 * Verify a fragment ID matches the expected value
 *
 * @param fragmentId - Fragment ID to verify
 * @param intentId - Source intent identifier
 * @param op - Patch operation
 * @returns true if the fragment ID matches
 */
export function verifyFragmentId(
  fragmentId: string,
  intentId: IntentId,
  op: PatchOp
): boolean {
  const computed = computeFragmentId(intentId, op);
  return fragmentId === computed;
}

/**
 * Generate a unique intent ID
 *
 * Uses crypto.randomUUID() for uniqueness.
 */
export function generateIntentId(): IntentId {
  return crypto.randomUUID();
}

/**
 * Generate a unique trace ID
 */
export function generateTraceId(): string {
  return `trace-${crypto.randomUUID()}`;
}

/**
 * Generate a unique report ID for ambiguity reports
 */
export function generateReportId(): string {
  return `report-${crypto.randomUUID()}`;
}

/**
 * Compute a hash of input text for trace deduplication
 */
export function computeInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").substring(0, 16);
}
