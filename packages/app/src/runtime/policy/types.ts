/**
 * Policy Types
 *
 * @see SPEC v2.0.0 §10
 * @module
 */

import type {
  PolicyService,
  ExecutionKeyPolicy,
  Proposal,
  ApprovedScope,
  AuthorityDecision,
  ValidationResult,
  Snapshot,
} from "../../core/types/index.js";

// Re-export types
export type {
  PolicyService,
  ExecutionKeyPolicy,
  Proposal,
  ApprovedScope,
  AuthorityDecision,
  ValidationResult,
};

/**
 * Authority handler for routing proposals to decision makers.
 */
export type AuthorityHandler = (
  proposal: Proposal
) => Promise<AuthorityDecision>;

/**
 * Scope validator for pre/post execution validation.
 */
export type ScopeValidator = (
  proposal: Proposal,
  scope: ApprovedScope
) => ValidationResult;

/**
 * Result scope validator for post-execution validation.
 */
export type ResultScopeValidator = (
  baseSnapshot: Snapshot,
  terminalSnapshot: Snapshot,
  scope: ApprovedScope
) => ValidationResult;

/**
 * Default PolicyService options.
 */
export type DefaultPolicyServiceOptions = {
  /**
   * Execution key policy (default: unique per proposal).
   */
  readonly executionKeyPolicy?: ExecutionKeyPolicy;

  /**
   * Authority handler (default: auto-approve with warning).
   */
  readonly authorityHandler?: AuthorityHandler;

  /**
   * Enable auto-approve with warning log.
   * @default true
   */
  readonly warnOnAutoApprove?: boolean;

  /**
   * Enable scope validation.
   * @default false
   */
  readonly validateScope?: boolean;
};
