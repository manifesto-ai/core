/**
 * @fileoverview Intent Statefulness Invariant (I4)
 *
 * I4: Every node has resolution.status.
 *
 * Per SPEC Section 8.2:
 * INVARIANT: For all nodes n in graph G:
 *   - n.resolution.status ∈ {"Resolved", "Ambiguous", "Abstract"}
 *   - n.resolution.ambiguityScore ∈ [0, 1]
 *
 * Also enforces Resolution Consistency Rules (SPEC Section 8.3):
 * - R1: status = "Resolved" → missing MUST be empty or undefined
 * - R2: missing is non-empty → status MUST be "Ambiguous" or "Abstract"
 * - R3: ambiguityScore = 0 → status SHOULD be "Resolved" (warning)
 */

import type { IntentGraph, IntentNodeId, ResolutionStatus } from "../types/index.js";

// =============================================================================
// StatefulnessCheckResult
// =============================================================================

/**
 * Result of statefulness check.
 */
export type StatefulnessCheckResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly error:
        | "INVALID_STATUS"
        | "INVALID_SCORE"
        | "R1_VIOLATION"
        | "MISSING_WITHOUT_STATUS";
      readonly nodeId: IntentNodeId;
      readonly details?: string;
    };

// =============================================================================
// StatefulnessWarning
// =============================================================================

/**
 * Warning from statefulness check.
 */
export type StatefulnessWarning = {
  readonly code: "ZERO_SCORE_NOT_RESOLVED";
  readonly nodeId: IntentNodeId;
  readonly message: string;
};

// =============================================================================
// checkStatefulness
// =============================================================================

const VALID_STATUSES: readonly ResolutionStatus[] = [
  "Resolved",
  "Ambiguous",
  "Abstract",
];

/**
 * Check the I4 (Intent Statefulness) invariant.
 *
 * Verifies that every node has valid resolution.status and ambiguityScore.
 *
 * @param graph - The Intent Graph to check
 * @returns Result with validity and optional error details
 */
export function checkStatefulness(graph: IntentGraph): {
  result: StatefulnessCheckResult;
  warnings: readonly StatefulnessWarning[];
} {
  const warnings: StatefulnessWarning[] = [];

  for (const node of graph.nodes) {
    // Check status is valid
    if (!VALID_STATUSES.includes(node.resolution.status)) {
      return {
        result: {
          valid: false,
          error: "INVALID_STATUS",
          nodeId: node.id,
          details: `Invalid resolution status: ${node.resolution.status}`,
        },
        warnings,
      };
    }

    // Check ambiguityScore is valid (0..1)
    const score = node.resolution.ambiguityScore;
    if (typeof score !== "number" || isNaN(score) || score < 0 || score > 1) {
      return {
        result: {
          valid: false,
          error: "INVALID_SCORE",
          nodeId: node.id,
          details: `Invalid ambiguityScore: ${score} (must be in [0, 1])`,
        },
        warnings,
      };
    }

    // R1: status = "Resolved" → missing MUST be empty or undefined
    if (
      node.resolution.status === "Resolved" &&
      node.resolution.missing &&
      node.resolution.missing.length > 0
    ) {
      return {
        result: {
          valid: false,
          error: "R1_VIOLATION",
          nodeId: node.id,
          details: `Resolved node has missing roles: ${node.resolution.missing.join(", ")}`,
        },
        warnings,
      };
    }

    // R2: missing is non-empty → status MUST be "Ambiguous" or "Abstract"
    if (
      node.resolution.missing &&
      node.resolution.missing.length > 0 &&
      node.resolution.status === "Resolved"
    ) {
      return {
        result: {
          valid: false,
          error: "MISSING_WITHOUT_STATUS",
          nodeId: node.id,
          details: `Node has missing roles but status is Resolved`,
        },
        warnings,
      };
    }

    // R3: ambiguityScore = 0 → status SHOULD be "Resolved" (warning, not error)
    if (score === 0 && node.resolution.status !== "Resolved") {
      warnings.push({
        code: "ZERO_SCORE_NOT_RESOLVED",
        nodeId: node.id,
        message: `Node has ambiguityScore=0 but status is "${node.resolution.status}" (expected "Resolved")`,
      });
    }
  }

  return { result: { valid: true }, warnings };
}

/**
 * Check if all nodes have valid statefulness.
 *
 * Convenience wrapper that returns a boolean.
 */
export function isStatefulnessValid(graph: IntentGraph): boolean {
  return checkStatefulness(graph).result.valid;
}
