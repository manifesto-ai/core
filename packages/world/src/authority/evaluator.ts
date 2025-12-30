/**
 * Authority Evaluator
 *
 * Main entry point for evaluating proposals against their actor's authority.
 * Routes proposals to the appropriate handler based on policy mode.
 */
import type { Proposal } from "../schema/proposal.js";
import type { ActorAuthorityBinding } from "../schema/binding.js";
import type { AuthorityKind, AuthorityResponse } from "../schema/authority.js";
import type { IntentScope } from "../schema/intent.js";
import type { AuthorityHandler } from "./types.js";
import { AutoApproveHandler, createAutoApproveHandler } from "./auto.js";
import { PolicyRulesHandler, createPolicyRulesHandler } from "./policy.js";
import { HITLHandler, createHITLHandler } from "./hitl.js";
import { TribunalHandler, createTribunalHandler } from "./tribunal.js";
import { createWorldError } from "../errors.js";

/**
 * Policy mode to authority kind mapping
 */
const POLICY_MODE_TO_KIND: Record<string, AuthorityKind> = {
  auto_approve: "auto",
  hitl: "human",
  policy_rules: "policy",
  tribunal: "tribunal",
};

/**
 * Authority Evaluator
 *
 * Routes proposals to appropriate handlers based on their binding's policy mode.
 */
export class AuthorityEvaluator {
  private handlers: Map<string, AuthorityHandler> = new Map();

  // Default handlers
  private autoHandler: AutoApproveHandler;
  private policyHandler: PolicyRulesHandler;
  private hitlHandler: HITLHandler;
  private tribunalHandler: TribunalHandler;

  constructor() {
    // Create default handlers
    this.autoHandler = createAutoApproveHandler();
    this.policyHandler = createPolicyRulesHandler();
    this.hitlHandler = createHITLHandler();
    this.tribunalHandler = createTribunalHandler();

    // Register default handlers
    this.handlers.set("auto_approve", this.autoHandler);
    this.handlers.set("hitl", this.hitlHandler);
    this.handlers.set("policy_rules", this.policyHandler);
    this.handlers.set("tribunal", this.tribunalHandler);
  }

  /**
   * Evaluate a proposal against its actor's authority
   *
   * @param proposal - The proposal to evaluate
   * @param binding - The actor-authority binding
   * @returns Authority response
   */
  async evaluate(
    proposal: Proposal,
    binding: ActorAuthorityBinding
  ): Promise<AuthorityResponse> {
    const policyMode = binding.policy.mode;
    const handler = this.handlers.get(policyMode);

    if (!handler) {
      throw createWorldError(
        "UNKNOWN_AUTHORITY_KIND",
        `Unknown policy mode: ${policyMode}`,
        { policyMode }
      );
    }

    try {
      return await handler.evaluate(proposal, binding);
    } catch (error) {
      if (error instanceof Error && error.name === "WorldError") {
        throw error;
      }
      throw createWorldError(
        "AUTHORITY_EVALUATION_ERROR",
        `Authority evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
        { proposalId: proposal.proposalId, policyMode }
      );
    }
  }

  /**
   * Register a custom handler for a policy mode
   */
  registerHandler(policyMode: string, handler: AuthorityHandler): void {
    this.handlers.set(policyMode, handler);
  }

  /**
   * Get the auto-approve handler
   */
  getAutoHandler(): AutoApproveHandler {
    return this.autoHandler;
  }

  /**
   * Get the policy rules handler
   */
  getPolicyHandler(): PolicyRulesHandler {
    return this.policyHandler;
  }

  /**
   * Get the HITL handler
   */
  getHITLHandler(): HITLHandler {
    return this.hitlHandler;
  }

  /**
   * Get the tribunal handler
   */
  getTribunalHandler(): TribunalHandler {
    return this.tribunalHandler;
  }

  /**
   * Submit an HITL decision
   *
   * @param proposalId - The proposal to decide
   * @param decision - The decision
   * @param reasoning - Optional reasoning
   * @param approvedScope - Optional approved scope (for approved decisions)
   */
  submitHITLDecision(
    proposalId: string,
    decision: "approved" | "rejected",
    reasoning?: string,
    approvedScope?: IntentScope | null
  ): void {
    this.hitlHandler.submitDecision(proposalId, decision, reasoning, approvedScope);
  }

  /**
   * Submit a tribunal vote
   *
   * @param proposalId - The proposal being voted on
   * @param voter - The voting actor
   * @param decision - The vote
   * @param reasoning - Optional reasoning
   */
  submitTribunalVote(
    proposalId: string,
    voter: { actorId: string; kind: "human" | "agent" | "system"; name?: string },
    decision: "approve" | "reject" | "abstain",
    reasoning?: string
  ): void {
    this.tribunalHandler.submitVote(proposalId, voter, decision, reasoning);
  }

  /**
   * Check if there are pending HITL decisions
   */
  hasPendingHITL(): boolean {
    return this.hitlHandler.getPendingIds().length > 0;
  }

  /**
   * Check if there are pending tribunals
   */
  hasPendingTribunal(): boolean {
    return this.tribunalHandler.getPendingIds().length > 0;
  }

  /**
   * Get all pending HITL proposal IDs
   */
  getPendingHITLIds(): string[] {
    return this.hitlHandler.getPendingIds();
  }

  /**
   * Get all pending tribunal proposal IDs
   */
  getPendingTribunalIds(): string[] {
    return this.tribunalHandler.getPendingIds();
  }

  /**
   * Clear all pending decisions
   */
  clearAllPending(): void {
    this.hitlHandler.clearAllPending();
    this.tribunalHandler.clearAllPending();
  }
}

/**
 * Create an authority evaluator
 */
export function createAuthorityEvaluator(): AuthorityEvaluator {
  return new AuthorityEvaluator();
}
