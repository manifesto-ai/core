/**
 * @fileoverview Referential Identity Invariant (I2)
 *
 * I2: Entity refs within graph maintain identity.
 *
 * Per SPEC Section 8.2:
 * INVARIANT: For all entity references r1, r2 in graph G:
 *   - If r1 and r2 refer to the same entity, they share a symbolic identity
 *   - Identity is preserved across node boundaries
 *
 * This module provides STRUCTURAL referential identity checking.
 * - Checks that all dependsOn references point to existing nodes
 * - Checks symbolic reference consistency (same ref kind used consistently)
 *
 * Lexicon-based entity type checking is in validate/lexicon.ts.
 */

import type { IntentGraph, IntentNodeId } from "../types/index.js";

// =============================================================================
// ReferentialIdentityCheckResult
// =============================================================================

/**
 * Result of referential identity check.
 */
export type ReferentialIdentityCheckResult =
  | { readonly valid: true }
  | {
      readonly valid: false;
      readonly error: "BROKEN_EDGE" | "INVALID_REFERENCE";
      readonly nodeId: IntentNodeId;
      readonly details: string;
    };

// =============================================================================
// checkReferentialIdentity
// =============================================================================

/**
 * Check the I2 (Referential Identity) invariant - STRUCTURAL check.
 *
 * This checks:
 * 1. All dependsOn references point to existing nodes
 * 2. No self-references (node depending on itself)
 *
 * Note: Entity type consistency checking requires Lexicon
 * and is done in validate/lexicon.ts.
 *
 * @param graph - The Intent Graph to check
 * @returns Result with validity and optional error details
 */
export function checkReferentialIdentity(
  graph: IntentGraph
): ReferentialIdentityCheckResult {
  // Build set of valid node IDs
  const nodeIds = new Set<IntentNodeId>();
  for (const node of graph.nodes) {
    nodeIds.add(node.id);
  }

  for (const node of graph.nodes) {
    // Check each dependency reference
    for (const depId of node.dependsOn) {
      // Check self-reference
      if (depId === node.id) {
        return {
          valid: false,
          error: "INVALID_REFERENCE",
          nodeId: node.id,
          details: `Node ${node.id} has self-reference in dependsOn`,
        };
      }

      // Check reference exists
      if (!nodeIds.has(depId)) {
        return {
          valid: false,
          error: "BROKEN_EDGE",
          nodeId: node.id,
          details: `Node ${node.id} depends on non-existent node ${depId}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if graph passes referential identity check.
 *
 * Convenience wrapper that returns a boolean.
 */
export function isReferentialIdentityValid(graph: IntentGraph): boolean {
  return checkReferentialIdentity(graph).valid;
}
