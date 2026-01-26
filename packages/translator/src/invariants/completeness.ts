/**
 * @fileoverview Conceptual Completeness Invariant (I3)
 *
 * I3: Missing args are explicitly recorded.
 *
 * Per SPEC Section 8.2:
 * INVARIANT: For all nodes n in graph G:
 *   - If required θ-role (from Lexicon's theta frame) is unbound:
 *     - n.resolution.missing MUST contain the role name
 *     - n.resolution.status MUST NOT be "Resolved"
 *
 * This module provides STRUCTURAL completeness checking (no Lexicon required).
 * Lexicon-based completeness is in validate/lexicon.ts.
 */

import type { IntentGraph, IntentNodeId } from "../types/index.js";

// =============================================================================
// CompletenessCheckResult
// =============================================================================

/**
 * Result of structural completeness check.
 */
export type CompletenessCheckResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly error: "COMPLETENESS_VIOLATION";
      readonly nodeId: IntentNodeId;
      readonly details: string;
    };

// =============================================================================
// checkCompleteness
// =============================================================================

/**
 * Check the I3 (Conceptual Completeness) invariant - STRUCTURAL check.
 *
 * This checks structural consistency:
 * - If missing is non-empty, status MUST NOT be "Resolved"
 *
 * Note: Full completeness checking (required roles from theta-frame)
 * requires Lexicon and is done in validate/lexicon.ts.
 *
 * @param graph - The Intent Graph to check
 * @returns Result with validity and optional error details
 */
export function checkCompleteness(graph: IntentGraph): CompletenessCheckResult {
  for (const node of graph.nodes) {
    // If missing is non-empty, status MUST NOT be "Resolved"
    if (
      node.resolution.missing &&
      node.resolution.missing.length > 0 &&
      node.resolution.status === "Resolved"
    ) {
      return {
        valid: false,
        error: "COMPLETENESS_VIOLATION",
        nodeId: node.id,
        details: `Node ${node.id} has missing roles [${node.resolution.missing.join(", ")}] but status is "Resolved"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Check if graph passes structural completeness check.
 *
 * Convenience wrapper that returns a boolean.
 */
export function isCompletenessValid(graph: IntentGraph): boolean {
  return checkCompleteness(graph).valid;
}
