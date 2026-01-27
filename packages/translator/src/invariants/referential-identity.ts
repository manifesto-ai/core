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
      readonly error: "BROKEN_EDGE" | "SELF_DEPENDENCY";
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
          error: "SELF_DEPENDENCY",
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

// =============================================================================
// Entity Type Consistency (I2-S)
// =============================================================================

/**
 * Entity type conflict information.
 */
export type EntityTypeConflict = {
  readonly entityId: string;
  readonly firstType: string;
  readonly firstNode: IntentNodeId;
  readonly secondType: string;
  readonly secondNode: IntentNodeId;
};

/**
 * Result of entity type consistency check.
 */
export type EntityTypeConsistencyResult = {
  readonly valid: boolean;
  readonly conflicts: readonly EntityTypeConflict[];
};

/**
 * Check entity type consistency (I2-S invariant).
 *
 * Per SPEC Invariant I2-S:
 * Same entity ID MUST have the same entityType across all nodes.
 *
 * @param graph - The Intent Graph to check
 * @returns Result with validity and any conflicts found
 */
export function checkEntityTypeConsistency(
  graph: IntentGraph
): EntityTypeConsistencyResult {
  const entityTypes = new Map<string, { type: string; nodeId: IntentNodeId }>();
  const conflicts: EntityTypeConflict[] = [];

  for (const node of graph.nodes) {
    // Check args for EntityTerms
    for (const [_role, term] of Object.entries(node.ir.args)) {
      if (term.kind === "entity") {
        const entityTerm = term as { kind: "entity"; entityId?: string; entityType: string };
        if (entityTerm.entityId) {
          const existing = entityTypes.get(entityTerm.entityId);
          if (existing && existing.type !== entityTerm.entityType) {
            conflicts.push({
              entityId: entityTerm.entityId,
              firstType: existing.type,
              firstNode: existing.nodeId,
              secondType: entityTerm.entityType,
              secondNode: node.id,
            });
          } else if (!existing) {
            entityTypes.set(entityTerm.entityId, {
              type: entityTerm.entityType,
              nodeId: node.id,
            });
          }
        }
      }
    }
  }

  return { valid: conflicts.length === 0, conflicts };
}
