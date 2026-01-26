/**
 * @fileoverview IntentNode Types (SPEC Section 7.1-7.3)
 *
 * Core node types for Intent Graph representation.
 */

import type { IntentIR, Role } from "@manifesto-ai/intent-ir";

// =============================================================================
// IntentNodeId
// =============================================================================

/**
 * Unique identifier for a node within an Intent Graph.
 *
 * Branded type for type safety - prevents accidental string assignment.
 */
export type IntentNodeId = string & { readonly __brand: "IntentNodeId" };

/**
 * Create an IntentNodeId from a string.
 */
export function createNodeId(id: string): IntentNodeId {
  return id as IntentNodeId;
}

// =============================================================================
// ResolutionStatus
// =============================================================================

/**
 * Resolution status - semantic completeness.
 *
 * - "Resolved": All required roles are bound, no ambiguity
 * - "Ambiguous": Some aspects are unclear or require clarification
 * - "Abstract": Too vague or incomplete to execute
 */
export type ResolutionStatus = "Resolved" | "Ambiguous" | "Abstract";

// =============================================================================
// Resolution
// =============================================================================

/**
 * Resolution state and ambiguity measurement.
 *
 * Per SPEC Section 7.2, Resolution captures:
 * - Semantic completeness status
 * - Numerical ambiguity score (0..1)
 * - Missing required theta-roles (if any)
 * - Suggested clarifying questions
 */
export type Resolution = {
  /** Semantic completeness status */
  readonly status: ResolutionStatus;

  /**
   * Ambiguity score (0..1).
   * 0 = fully unambiguous, 1 = maximally ambiguous.
   */
  readonly ambiguityScore: number;

  /**
   * Missing required θ-roles (role names only).
   *
   * Values MUST be from Role enum: TARGET, THEME, SOURCE, DEST, INSTRUMENT, BENEFICIARY.
   * MUST be empty if status is "Resolved".
   *
   * Note: Detailed information (e.g., "ref not resolved") goes in:
   * - lowering.status="deferred" with reason, OR
   * - questions[] for user clarification
   */
  readonly missing?: readonly Role[];

  /** Suggested clarifying questions for the user */
  readonly questions?: readonly string[];
};

// =============================================================================
// IntentNode
// =============================================================================

/**
 * A single node in an Intent Graph.
 *
 * Each node wraps an IntentIR instance and adds:
 * - Unique identifier within the graph
 * - Dependencies to other nodes
 * - Resolution state
 *
 * Per SPEC Section 7.3
 */
export type IntentNode = {
  /** Unique node identifier */
  readonly id: IntentNodeId;

  /** Wrapped IntentIR instance (v0.1) */
  readonly ir: IntentIR;

  /** Dependencies (node IDs this node depends on) */
  readonly dependsOn: readonly IntentNodeId[];

  /** Resolution state */
  readonly resolution: Resolution;
};
