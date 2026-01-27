/**
 * @fileoverview Output Types (SPEC Section 11)
 *
 * ManifestoBundle and related output artifacts.
 */

import type { IntentIR } from "@manifesto-ai/intent-ir";
import type { IntentNodeId, ResolutionStatus } from "./node.js";
import type { InvocationStep, LoweringFailureReason } from "./lowering.js";

// =============================================================================
// DependencyEdge
// =============================================================================

/**
 * Represents a dependency relationship between nodes.
 *
 * Per SPEC Section 11.2:
 * - Convention: from=dependency (must complete first), to=dependent (executes after)
 * - Edge direction: from → to means "from must complete before to"
 * - Example: If n2 depends on n1, edge is { from: "n1", to: "n2" }
 */
export type DependencyEdge = {
  /** The dependency node (must complete first) */
  readonly from: IntentNodeId;
  /** The dependent node (executes after from) */
  readonly to: IntentNodeId;
};

// =============================================================================
// InvocationPlan
// =============================================================================

/**
 * A sequence of executable steps derived from the Intent Graph.
 *
 * Per SPEC Section 11.2:
 * - Steps are in topologically-sorted order
 * - INVARIANT: steps[i] depends on steps[j] implies i > j
 */
export type InvocationPlan = {
  /**
   * Execution steps in topologically-sorted order.
   * MUST: steps[i] depends on steps[j] implies i > j.
   */
  readonly steps: readonly InvocationStep[];

  /**
   * Dependency edges among steps (C-EDGES-1 compliant).
   *
   * Per SPEC Section 11.2:
   * - MUST contain only edges where BOTH from and to are nodeIds in steps[]
   * - Convention: from=dependency (must complete first), to=dependent (executes after)
   * - Edge direction: from → to means "from must complete before to"
   */
  readonly dependencyEdges?: readonly DependencyEdge[];
};

// =============================================================================
// MelCandidate
// =============================================================================

/**
 * Suggested schema extension for intents that cannot be lowered.
 *
 * Per SPEC Section 11.4:
 * - Generated ONLY when lowering fails
 * - NOT generated for Abstract nodes
 */
export type MelCandidate = {
  /** Original node ID */
  readonly nodeId: IntentNodeId;

  /** Original IntentIR (for reference) */
  readonly ir: IntentIR;

  /** Suggested MEL code */
  readonly suggestedMel: string;

  /** Why lowering failed */
  readonly reason: LoweringFailureReason;

  /** Nodes that would become lowerable if this MEL is applied */
  readonly wouldEnable?: readonly IntentNodeId[];
};

// =============================================================================
// BundleMeta
// =============================================================================

/**
 * Metadata for a ManifestoBundle.
 */
export type BundleMeta = {
  /** Original source text */
  readonly sourceText: string;

  /** ISO 8601 timestamp when translation occurred */
  readonly translatedAt: string;

  /** ISO 8601 timestamp when emission occurred */
  readonly emittedAt: string;

  /** Total nodes in the original graph */
  readonly graphNodeCount: number;

  /** Count of nodes with status "Resolved" */
  readonly resolvedCount: number;

  /** Count of nodes with status "Ambiguous" */
  readonly ambiguousCount: number;

  /** Count of nodes with status "Abstract" */
  readonly abstractCount: number;

  /** Count of steps with lowering.status "deferred" */
  readonly deferredCount: number;
};

// =============================================================================
// ManifestoBundle
// =============================================================================

/**
 * The primary output of emitForManifesto().
 *
 * Per SPEC Section 11.1:
 * - Contains executable invocation plan
 * - Contains schema extension candidates for unsupported intents
 * - Contains emission metadata
 */
export type ManifestoBundle = {
  /** Executable invocation plan */
  readonly invocationPlan: InvocationPlan;

  /** Schema extension candidates for unsupported intents */
  readonly melCandidates: readonly MelCandidate[];

  /** Emission metadata */
  readonly meta: BundleMeta;
};
