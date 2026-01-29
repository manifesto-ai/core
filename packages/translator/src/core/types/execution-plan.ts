/**
 * @fileoverview ExecutionPlan Types (SPEC Section 5.3)
 *
 * Core execution plan types. Contains topologically sorted steps
 * and dependency graph. Does NOT contain lowering information
 * (that's target-specific).
 *
 * Per SPEC Section 11.4 (E-INV-*):
 * - E-INV-1: steps contains no abstract nodes
 * - E-INV-2: dependencyEdges references only nodes in steps
 * - E-INV-3: from is dependency (executes first), to is dependent (executes after)
 *
 * @module core/types/execution-plan
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";
import type { Resolution, IntentNodeId } from "./intent-graph.js";

// =============================================================================
// ExecutionStep
// =============================================================================

/**
 * Execution step (Core, no lowering).
 *
 * Per SPEC Section 5.3:
 * Note: No lowering field - that's target-specific.
 */
export interface ExecutionStep {
  readonly nodeId: IntentNodeId;
  readonly ir: IntentIR;
  readonly resolution: Resolution;
}

// =============================================================================
// DependencyEdge
// =============================================================================

/**
 * Dependency edge.
 *
 * Per SPEC Section 5.3:
 * - Direction: dependency -> dependent
 * - Topological sort: `from` executes before `to`
 */
export interface DependencyEdge {
  /** Dependency node (executes first) */
  readonly from: IntentNodeId;

  /** Dependent node (executes after) */
  readonly to: IntentNodeId;
}

// =============================================================================
// ExecutionPlan
// =============================================================================

/**
 * Core execution plan.
 *
 * Per SPEC Section 5.3:
 * Contains topologically sorted steps and dependency graph.
 * Does NOT contain lowering information (target-specific).
 *
 * Invariants (E-INV-*):
 * - E-INV-1: steps contains no abstract nodes
 * - E-INV-2: dependencyEdges references only nodes in steps
 * - E-INV-3: from is dependency (executes first), to is dependent (executes after)
 */
export interface ExecutionPlan {
  /** Execution steps (Abstract nodes excluded, topologically sorted) */
  readonly steps: readonly ExecutionStep[];

  /** Dependency edges (within steps only) */
  readonly dependencyEdges: readonly DependencyEdge[];

  /** Abstract nodes (excluded from execution) */
  readonly abstractNodes: readonly IntentNodeId[];
}
