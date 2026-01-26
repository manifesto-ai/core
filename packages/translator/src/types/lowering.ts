/**
 * @fileoverview Lowering Types (SPEC Section 7.5, 11.2-11.3)
 *
 * Types for lowering IntentIR to IntentBody.
 */

import type { IntentIR, IntentBody, Role, ResolvedIntentIR } from "@manifesto-ai/intent-ir";
import type { IntentNodeId, Resolution } from "./node.js";

// =============================================================================
// LoweringStatus
// =============================================================================

/**
 * Lowering status - execution readiness.
 *
 * - "ready": IntentBody available, can execute immediately
 * - "deferred": Needs runtime resolution (e.g., discourse refs)
 * - "failed": Cannot lower to IntentBody
 *
 * Per SPEC Section 3.3, lowering status is ORTHOGONAL to resolution status.
 */
export type LoweringStatus = "ready" | "deferred" | "failed";

// =============================================================================
// LoweringFailureReason
// =============================================================================

/**
 * Reason why lowering failed.
 */
export type LoweringFailureReason = {
  readonly kind: "action_not_found" | "role_mapping_failed" | "type_mismatch";
  readonly details: string;
};

// =============================================================================
// LoweringResult
// =============================================================================

/**
 * Result of lowering an IntentIR to IntentBody.
 *
 * Per SPEC Section 11.3:
 * - "ready": IntentBody is available for execution
 * - "deferred": IR is preserved, lowering happens at execution time
 * - "failed": Lowering not possible, MelCandidate may be generated
 */
export type LoweringResult =
  | {
      readonly status: "ready";
      readonly intentBody: IntentBody;
      readonly resolvedIR?: ResolvedIntentIR;
    }
  | {
      readonly status: "deferred";
      readonly reason: string;
    }
  | {
      readonly status: "failed";
      readonly reason: LoweringFailureReason;
    };

// =============================================================================
// InvocationStep
// =============================================================================

/**
 * A single step in an InvocationPlan.
 *
 * Per SPEC Section 11.2:
 * - Always includes original IntentIR for re-lowering and debugging
 * - Lowering result indicates execution readiness
 * - Resolution state copied from original node
 */
export type InvocationStep = {
  /** Original node ID */
  readonly nodeId: IntentNodeId;

  /**
   * Original IntentIR (always included).
   * Enables re-lowering, debugging, and standalone plan serialization.
   */
  readonly ir: IntentIR;

  /** Lowering result */
  readonly lowering: LoweringResult;

  /** Resolution state (copied from node) */
  readonly resolution: {
    readonly status: Resolution["status"];
    readonly ambiguityScore: number;
    readonly missing?: readonly Role[];
  };
};
