/**
 * Manifesto App — Authority & Policy Types
 *
 * @see SPEC v2.0.0 §5.6-5.8, §10
 * @see ADR-004 Phase 1
 * @module
 */

import type { Snapshot } from "@manifesto-ai/core";
import type { WorldId } from "@manifesto-ai/world";
import type { ExecutionKey, ProposalId, ActorId, BranchId } from "./identifiers.js";

// =============================================================================
// v2.0.0 Authority Types
// =============================================================================

/**
 * Authority kind.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityKind = "auto" | "human" | "policy" | "tribunal";

/**
 * Authority reference.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityRef = {
  readonly kind: AuthorityKind;
  readonly id: string;
  readonly meta?: Record<string, unknown>;
};

/**
 * Approved scope for execution constraints.
 *
 * @see SPEC v2.0.0 §5.7
 */
export type ApprovedScope = {
  readonly allowedPaths: readonly string[];
  readonly maxPatchCount?: number;
  readonly constraints?: Record<string, unknown>;
};

/**
 * Authority decision result.
 *
 * @see SPEC v2.0.0 §5.6
 */
export type AuthorityDecision = {
  readonly approved: boolean;
  readonly reason?: string;
  readonly scope?: ApprovedScope;
  readonly timestamp: number;
};

/**
 * Validation result from policy service.
 */
export type ValidationResult = {
  readonly valid: boolean;
  readonly errors?: readonly string[];
};

// =============================================================================
// v2.0.0 Execution Policy
// =============================================================================

/**
 * Proposal for action execution.
 *
 * @see SPEC v2.0.0 §10
 */
export type Proposal = {
  readonly proposalId: ProposalId;
  readonly actorId: ActorId;
  readonly intentType: string;
  readonly intentBody: unknown;
  readonly baseWorld: WorldId;
  readonly branchId?: BranchId;
  readonly createdAt: number;
};

/**
 * Execution key derivation policy.
 *
 * @see SPEC v2.0.0 §5.8
 */
export type ExecutionKeyPolicy = (proposal: Proposal) => ExecutionKey;

/**
 * Execution policy configuration.
 *
 * @see SPEC v2.0.0 §5.8
 */
export type ExecutionPolicyConfig = {
  readonly executionKeyPolicy: ExecutionKeyPolicy;
  readonly intentTypeOverrides?: Record<string, ExecutionKeyPolicy>;
  readonly actorKindOverrides?: Record<string, ExecutionKeyPolicy>;
};

// =============================================================================
// v2.0.0 PolicyService Interface
// =============================================================================

/**
 * PolicyService: Policy decisions for execution.
 *
 * @see SPEC v2.0.0 §10.1
 */
export interface PolicyService {
  /**
   * Derive ExecutionKey for a Proposal.
   */
  deriveExecutionKey(proposal: Proposal): ExecutionKey;

  /**
   * Route Proposal to Authority and get decision.
   */
  requestApproval(proposal: Proposal): Promise<AuthorityDecision>;

  /**
   * Validate Proposal against ApprovedScope (pre-execution).
   */
  validateScope(proposal: Proposal, scope: ApprovedScope): ValidationResult;

  /**
   * Validate execution result against ApprovedScope (post-execution).
   */
  validateResultScope?(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ValidationResult;
}
