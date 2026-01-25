/**
 * HITL Controller
 *
 * Manages Human-in-the-Loop decisions for Lab experiments.
 * Per SPEC Section 10 and FDR-N013.
 *
 * Key principles:
 * - HITL decisions flow through Authority, not direct modification
 * - Auto-approve conditions can bypass human intervention
 * - Timeouts trigger configured behavior (approve/reject/abort)
 */

import type {
  ManifestoWorld,
  Proposal,
  ProposalDecidedEvent,
} from "@manifesto-ai/world";
import type {
  HITLOptions,
  HITLController,
  HITLContext,
  ApproveOptions,
  ProposalModification,
  Unsubscribe,
  AutoApproveCondition,
} from "../types.js";

/**
 * Internal pending proposal state.
 */
interface PendingProposal {
  proposal: Proposal;
  startedAt: number;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Create a HITL controller.
 *
 * @param options - HITL options
 * @param world - ManifestoWorld instance for processing decisions
 * @returns HITLController instance
 */
export function createHITLController(
  options: HITLOptions | undefined,
  world: ManifestoWorld
): HITLController {
  // Internal state
  const pendingProposals = new Map<string, PendingProposal>();
  const pendingHandlers = new Set<(proposal: Proposal) => void>();

  /**
   * Check if a proposal matches any auto-approve condition.
   */
  function checkAutoApprove(proposal: Proposal): boolean {
    if (!options?.autoApprove || options.autoApprove.length === 0) {
      return false;
    }

    return options.autoApprove.some((condition) =>
      evaluateAutoApproveCondition(condition, proposal)
    );
  }

  /**
   * Evaluate a single auto-approve condition.
   */
  function evaluateAutoApproveCondition(
    condition: AutoApproveCondition,
    proposal: Proposal
  ): boolean {
    switch (condition.type) {
      case "confidence_above": {
        // Extract confidence from proposal metadata if available
        const confidence =
          (proposal.intent.body.input as Record<string, unknown>)?.confidence ??
          (proposal.intent.meta as Record<string, unknown>)?.confidence ??
          0;
        return typeof confidence === "number" && confidence >= condition.threshold;
      }

      case "intent_type": {
        const intentType = proposal.intent.body.type;
        return condition.patterns.some((pattern) => intentType.includes(pattern));
      }

      case "actor": {
        return condition.actorIds.includes(proposal.actor.actorId);
      }

      case "custom": {
        try {
          return condition.predicate(proposal);
        } catch {
          return false;
        }
      }

      default:
        return false;
    }
  }

  /**
   * Set up timeout for a pending proposal.
   */
  function setupTimeout(proposalId: string): NodeJS.Timeout | undefined {
    if (!options?.timeout) {
      return undefined;
    }

    return setTimeout(async () => {
      const pending = pendingProposals.get(proposalId);
      if (!pending) return;

      pendingProposals.delete(proposalId);

      const timeoutBehavior = options.onTimeout ?? "reject";

      switch (timeoutBehavior) {
        case "approve":
          await world.processHITLDecision(
            proposalId,
            "approved",
            "Timeout: auto-approved"
          );
          break;
        case "abort":
          // Abort is handled at the Lab level
          break;
        case "reject":
        default:
          await world.processHITLDecision(
            proposalId,
            "rejected",
            "Timeout: rejected"
          );
          break;
      }
    }, options.timeout);
  }

  /**
   * Notify handlers of a pending proposal.
   */
  function notifyHandlers(proposal: Proposal): void {
    for (const handler of pendingHandlers) {
      try {
        handler(proposal);
      } catch (error) {
        console.error("[HITLController] Handler error:", error);
      }
    }
  }

  // Create the controller
  const controller: HITLController = {
    get pending(): Proposal[] {
      return Array.from(pendingProposals.values()).map((p) => p.proposal);
    },

    get isWaiting(): boolean {
      return pendingProposals.size > 0;
    },

    async approve(proposalId: string, approveOptions?: ApproveOptions): Promise<void> {
      const debug = process.env.DEBUG === "true";
      const pending = pendingProposals.get(proposalId);

      if (debug) {
        console.log(`[HITLController.approve] proposalId=${proposalId}, hasPending=${!!pending}, pendingCount=${pendingProposals.size}`);
        console.log(`[HITLController.approve] pendingIds:`, Array.from(pendingProposals.keys()));
      }

      if (!pending) {
        throw new Error(`No pending proposal: ${proposalId}`);
      }

      // Clear timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Remove from pending
      pendingProposals.delete(proposalId);

      if (debug) {
        console.log(`[HITLController.approve] Calling world.processHITLDecision...`);
      }

      // Process through World's HITL decision mechanism
      await world.processHITLDecision(
        proposalId,
        "approved",
        approveOptions?.note,
        approveOptions?.scope
      );

      if (debug) {
        console.log(`[HITLController.approve] world.processHITLDecision completed`);
      }
    },

    async reject(proposalId: string, reason: string): Promise<void> {
      const pending = pendingProposals.get(proposalId);
      if (!pending) {
        throw new Error(`No pending proposal: ${proposalId}`);
      }

      // Clear timeout
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Remove from pending
      pendingProposals.delete(proposalId);

      // Process through World's HITL decision mechanism
      await world.processHITLDecision(proposalId, "rejected", reason);
    },

    async requestInfo(proposalId: string, question: string): Promise<unknown> {
      // This would require additional infrastructure to handle
      // For now, it's a placeholder
      throw new Error("requestInfo not implemented");
    },

    async approveWithModification(
      proposalId: string,
      modifications: ProposalModification
    ): Promise<void> {
      await this.approve(proposalId, {
        scope: modifications.scope,
        note: "Approved with modifications",
      });
    },

    async delegate(proposalId: string, authorityId: string): Promise<void> {
      // Delegation would require additional infrastructure
      throw new Error("delegate not implemented");
    },

    onPending(handler: (proposal: Proposal) => void): Unsubscribe {
      pendingHandlers.add(handler);
      return () => {
        pendingHandlers.delete(handler);
      };
    },
  };

  // Add internal method for handling pending events (accessed via closure)
  // Returns true if proposal was added to pending, false otherwise
  const handlePending = async (event: ProposalDecidedEvent): Promise<boolean> => {
    const debug = process.env.DEBUG === "true";

    if (debug) {
      console.log(`[HITLController.handlePending] proposalId=${event.proposalId}, enabled=${options?.enabled}`);
    }

    if (!options?.enabled) return false;

    // Fetch full proposal from World
    const proposal = await world.getProposal(event.proposalId);
    if (!proposal) {
      console.warn(`[HITLController] Proposal not found: ${event.proposalId}`);
      return false;
    }

    // Check auto-approve conditions first
    if (checkAutoApprove(proposal)) {
      if (debug) {
        console.log(`[HITLController.handlePending] Auto-approving proposal ${event.proposalId}`);
      }
      await controller.approve(event.proposalId, {
        note: "Auto-approved by condition",
      });
      return false;
    }

    // Add to pending
    const timeoutId = setupTimeout(event.proposalId);
    pendingProposals.set(event.proposalId, {
      proposal,
      startedAt: Date.now(),
      timeoutId,
    });

    if (debug) {
      console.log(`[HITLController.handlePending] Added to pending, count=${pendingProposals.size}`);
    }

    // Notify handlers
    notifyHandlers(proposal);

    // Call external callback
    if (options.onPending) {
      const context: HITLContext = {
        proposalId: event.proposalId,
        timestamp: event.timestamp,
      };

      try {
        await Promise.resolve(options.onPending(proposal, context));
      } catch (error) {
        console.error("[HITLController] onPending callback error:", error);
      }
    }

    return true;
  };

  // Attach handlePending to controller (for internal use by Lab)
  (controller as HITLController & { handlePending: typeof handlePending }).handlePending =
    handlePending;

  return controller;
}

/**
 * Extended HITL controller with internal handlePending method.
 */
export interface HITLControllerInternal extends HITLController {
  /** Returns true if proposal was added to pending, false otherwise */
  handlePending(event: ProposalDecidedEvent): Promise<boolean>;
}
