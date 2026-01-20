/**
 * DefaultPolicyService
 *
 * Default implementation of PolicyService with auto-approve behavior.
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
} from "../types/index.js";
import type { DefaultPolicyServiceOptions, AuthorityHandler } from "./types.js";
import { defaultPolicy } from "./execution-key.js";
import {
  validateProposalScope,
  validateResultScope,
  createPermissiveScope,
} from "./approved-scope.js";

/**
 * DefaultPolicyService: Auto-approve with warning policy.
 *
 * This is the default PolicyService implementation that:
 * - Uses unique ExecutionKey per proposal
 * - Auto-approves all proposals (with warning log)
 * - Optionally validates scope constraints
 *
 * Use this for development and testing.
 * Production systems should provide custom PolicyService.
 *
 * @see SPEC v2.0.0 §10 POLICY-1~6
 */
export class DefaultPolicyService implements PolicyService {
  private _executionKeyPolicy: ExecutionKeyPolicy;
  private _authorityHandler: AuthorityHandler;
  private _warnOnAutoApprove: boolean;
  private _validateScope: boolean;

  constructor(options?: DefaultPolicyServiceOptions) {
    this._executionKeyPolicy = options?.executionKeyPolicy ?? defaultPolicy;
    this._authorityHandler = options?.authorityHandler ?? this._defaultAuthorityHandler.bind(this);
    this._warnOnAutoApprove = options?.warnOnAutoApprove ?? true;
    this._validateScope = options?.validateScope ?? false;
  }

  /**
   * Derive ExecutionKey for a Proposal.
   *
   * @see SPEC v2.0.0 §10 POLICY-1
   */
  deriveExecutionKey(proposal: Proposal): string {
    return this._executionKeyPolicy(proposal);
  }

  /**
   * Route Proposal to Authority and get decision.
   *
   * @see SPEC v2.0.0 §10 POLICY-2
   */
  async requestApproval(proposal: Proposal): Promise<AuthorityDecision> {
    return this._authorityHandler(proposal);
  }

  /**
   * Validate Proposal against ApprovedScope (pre-execution).
   *
   * @see SPEC v2.0.0 §10 POLICY-3
   */
  validateScope(proposal: Proposal, scope: ApprovedScope): ValidationResult {
    if (!this._validateScope) {
      return { valid: true };
    }
    return validateProposalScope(proposal, scope);
  }

  /**
   * Validate execution result against ApprovedScope (post-execution).
   *
   * @see SPEC v2.0.0 §10 POLICY-4
   */
  validateResultScope(
    baseSnapshot: Snapshot,
    terminalSnapshot: Snapshot,
    scope: ApprovedScope
  ): ValidationResult {
    if (!this._validateScope) {
      return { valid: true };
    }
    return validateResultScope(baseSnapshot, terminalSnapshot, scope);
  }

  // ===========================================================================
  // Internal Methods
  // ===========================================================================

  /**
   * Default authority handler: auto-approve with warning.
   */
  private async _defaultAuthorityHandler(
    proposal: Proposal
  ): Promise<AuthorityDecision> {
    // Log warning if enabled
    if (this._warnOnAutoApprove) {
      console.warn(
        `[Manifesto] Auto-approving proposal: ${proposal.proposalId} ` +
        `(intent: ${proposal.intentType}, actor: ${proposal.actorId}). ` +
        `Configure PolicyService for production use.`
      );
    }

    return {
      approved: true,
      reason: "auto-approved (development mode)",
      scope: createPermissiveScope(),
      timestamp: Date.now(),
    };
  }
}

/**
 * Create a DefaultPolicyService.
 */
export function createDefaultPolicyService(
  options?: DefaultPolicyServiceOptions
): DefaultPolicyService {
  return new DefaultPolicyService(options);
}

/**
 * Create a silent auto-approve PolicyService (no warnings).
 */
export function createSilentPolicyService(
  executionKeyPolicy?: ExecutionKeyPolicy
): DefaultPolicyService {
  return new DefaultPolicyService({
    executionKeyPolicy,
    warnOnAutoApprove: false,
  });
}

/**
 * Create a strict PolicyService that validates scopes.
 */
export function createStrictPolicyService(
  executionKeyPolicy?: ExecutionKeyPolicy,
  authorityHandler?: AuthorityHandler
): DefaultPolicyService {
  return new DefaultPolicyService({
    executionKeyPolicy,
    authorityHandler,
    validateScope: true,
    warnOnAutoApprove: false,
  });
}
