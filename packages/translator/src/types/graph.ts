/**
 * @fileoverview IntentGraph Types (SPEC Section 6, 7.4)
 *
 * Intent Graph is a DAG of IntentNodes representing complex intent.
 */

import type { IntentNode } from "./node.js";

// =============================================================================
// GraphMeta
// =============================================================================

/**
 * Metadata for an Intent Graph.
 */
export type GraphMeta = {
  /** Original source text */
  readonly sourceText: string;

  /** ISO 8601 timestamp when translation occurred */
  readonly translatedAt: string;
};

// =============================================================================
// IntentGraph
// =============================================================================

/**
 * A Directed Acyclic Graph (DAG) of IntentNodes.
 *
 * Per SPEC Section 6:
 * - Nodes represent individual intents (wrapping IntentIR)
 * - Edges represent logical dependencies (not temporal order)
 * - Graph MUST be acyclic (topological sort is possible)
 *
 * Edge semantics (SPEC Section 6.5):
 * - dependsOn[i] means "this node depends on node with id dependsOn[i]"
 * - Execution order: dependency must complete before dependent
 */
export type IntentGraph = {
  /** All nodes in the graph */
  readonly nodes: readonly IntentNode[];

  /** Optional metadata */
  readonly meta?: GraphMeta;
};
