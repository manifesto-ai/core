/**
 * @fileoverview Intent Graph Types (SPEC Section 5.2)
 *
 * Intent Graph is a DAG of IntentNodes representing complex intent.
 * Each node wraps an IntentIR instance from @manifesto-ai/intent-ir.
 *
 * @module core/types/intent-graph
 */

import type { IntentIR, Role as IntentIRRole } from "@manifesto-ai/intent-ir";

// =============================================================================
// IntentNodeId (Branded Type)
// =============================================================================

/**
 * Unique identifier for a node within an Intent Graph.
 *
 * Branded type for type safety - prevents accidental string assignment.
 * Compatible with legacy types.
 */
export type IntentNodeId = string & { readonly __brand: "IntentNodeId" };

/**
 * Create an IntentNodeId from a string.
 */
export function createNodeId(id: string): IntentNodeId {
  return id as IntentNodeId;
}

// =============================================================================
// Re-export Role from intent-ir
// =============================================================================

/**
 * Semantic role in a relation.
 * Aligned with Intent IR v0.1.
 *
 * Per SPEC Section 5.2:
 * - TARGET: Object acted upon
 * - THEME: Theme of the action
 * - SOURCE: Origin
 * - DEST: Destination (not "DESTINATION")
 * - INSTRUMENT: Tool or means
 * - BENEFICIARY: Benefactor of action
 *
 * Note: TIME is modeled separately as IntentIR.time?: TimeSpec
 */
export type Role = IntentIRRole;

// =============================================================================
// ResolutionStatus
// =============================================================================

/**
 * Resolution status (semantic completeness).
 *
 * Per SPEC Section 5.2:
 * - "Resolved": All required roles are bound, no ambiguity
 * - "Ambiguous": Some aspects are unclear or require clarification
 * - "Abstract": Too vague or incomplete to execute
 */
export type ResolutionStatus = "Resolved" | "Ambiguous" | "Abstract";

// =============================================================================
// Resolution
// =============================================================================

/**
 * Resolution status (semantic completeness).
 *
 * Per SPEC Section 5.2:
 * This is an interface, not a discriminated union.
 * All fields are present; status determines interpretation.
 *
 * Invariants (R-INV-*):
 * - R-INV-1: status === "Resolved" => missing is absent or length 0
 * - R-INV-2: missing exists and length > 0 => status !== "Resolved"
 */
export interface Resolution {
  /** Resolution status (PascalCase) */
  readonly status: ResolutionStatus;

  /** Ambiguity score (0.0 = resolved, 1.0 = fully ambiguous) */
  readonly ambiguityScore: number;

  /** Missing semantic roles (for Ambiguous status) */
  readonly missing?: readonly Role[];

  /** Clarification questions (for Ambiguous status) */
  readonly questions?: readonly string[];
}

// =============================================================================
// IntentNode
// =============================================================================

/**
 * A single intent node wrapping an IntentIR.
 *
 * Per SPEC Section 5.2:
 * - id: Unique identifier within graph
 * - ir: The underlying Intent IR instance
 * - resolution: Semantic resolution status
 * - dependsOn: Dependency references (node IDs)
 *
 * Invariants (G-INV-*):
 * - G-INV-1: Node IDs are unique within graph
 * - G-INV-2: All dependsOn IDs exist in graph
 * - G-INV-3: Graph is a DAG (no cycles)
 * - G-INV-4: Non-abstract nodes SHALL NOT depend on abstract nodes (C-ABS-1)
 */
export interface IntentNode {
  /** Unique identifier within graph */
  readonly id: IntentNodeId;

  /** The underlying Intent IR instance */
  readonly ir: IntentIR;

  /** Semantic resolution status */
  readonly resolution: Resolution;

  /** Dependency references (node IDs) */
  readonly dependsOn: readonly IntentNodeId[];
}

// =============================================================================
// GraphMeta
// =============================================================================

/**
 * Metadata for an Intent Graph.
 * Compatible with legacy types.
 */
export interface GraphMeta {
  /** Original source text */
  readonly sourceText: string;

  /** ISO 8601 timestamp when translation occurred */
  readonly translatedAt: string;

  /** Chunk index when graph is part of decomposed set */
  readonly chunkIndex?: number;
}

// =============================================================================
// IntentGraph
// =============================================================================

/**
 * A directed acyclic graph of intent nodes.
 *
 * Per SPEC Section 5.2:
 * - nodes: All intent nodes in the graph
 * - Graph MUST be acyclic (topological sort is possible)
 * - Edge semantics: dependsOn[i] means "this node depends on node with id dependsOn[i]"
 */
export interface IntentGraph {
  readonly nodes: readonly IntentNode[];

  /** Optional metadata (for backward compatibility) */
  readonly meta?: GraphMeta;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Check if a resolution is semantically complete.
 */
export function isResolved(resolution: Resolution): boolean {
  return resolution.status === "Resolved";
}

/**
 * Check if a node is abstract.
 */
export function isAbstract(node: IntentNode): boolean {
  return node.resolution.status === "Abstract";
}

/**
 * Get all node IDs from a graph.
 */
export function getNodeIds(graph: IntentGraph): Set<IntentNodeId> {
  return new Set(graph.nodes.map((n) => n.id));
}

/**
 * Build a node lookup map from a graph.
 */
export function buildNodeMap(graph: IntentGraph): Map<IntentNodeId, IntentNode> {
  const map = new Map<IntentNodeId, IntentNode>();
  for (const node of graph.nodes) {
    map.set(node.id, node);
  }
  return map;
}
