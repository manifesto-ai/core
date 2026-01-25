/**
 * Proposal Queue
 *
 * Manages the lifecycle of Proposals through the state machine.
 *
 * Per Intent & Projection Specification v1.0:
 * - Proposals use IntentInstance (not simple Intent)
 * - approvedScope is tracked during transitions
 *
 * Proposal Rules (MUST):
 * - P-1: Proposals MUST reference exactly one existing baseWorld
 * - P-2: Proposals MUST include valid actor reference
 * - P-3: Proposals MUST include valid IntentInstance with intentId and intentKey
 * - P-4: Proposal readonly fields MUST NOT be modified after submission
 * - P-5: proposalId MUST be unique within the World Protocol instance
 * - P-6: Proposals MUST be created by registered Actors only
 */
import type { ActorRef } from "../schema/actor.js";
import type { WorldId, DecisionId, ProposalId } from "../schema/world.js";
import type { Proposal, ProposalStatus, ProposalTrace } from "../schema/proposal.js";
import type { IntentInstance, IntentScope } from "../schema/intent.js";
import type { ExecutionKey } from "../types/index.js";
import {
  isValidTransition,
  isTerminalStatus,
  requiresDecision,
} from "./state-machine.js";
import {
  proposalNotFound,
  invalidStateTransition,
  createWorldError,
} from "../errors.js";

/**
 * Filter options for querying proposals
 */
export interface ProposalFilter {
  status?: ProposalStatus | ProposalStatus[];
  actorId?: string;
  baseWorld?: WorldId;
}

/**
 * Updates allowed during state transitions
 */
export interface TransitionUpdates {
  decisionId?: DecisionId;
  resultWorld?: WorldId;
  decidedAt?: number;
  completedAt?: number;
  /** Approved scope (set when approved) */
  approvedScope?: IntentScope | null;
}

/**
 * ProposalQueue - manages proposal lifecycle
 */
export class ProposalQueue {
  private proposals: Map<string, Proposal> = new Map();

  /**
   * Submit a new proposal (status: submitted)
   *
   * Per spec: Proposal.intent is IntentInstance
   * Per EPOCH-1: Proposal carries epoch at submission
   *
   * @param proposalId - Pre-generated proposal ID
   * @param executionKey - ExecutionKey fixed at submission
   * @param actor - Who is proposing
   * @param intent - IntentInstance with body, intentId, intentKey, and meta
   * @param baseWorld - Which world to base this on
   * @param trace - Optional reasoning for audit
   * @param epoch - Current epoch at submission (default: 0)
   * @returns The created proposal
   */
  submit(
    proposalId: ProposalId,
    executionKey: ExecutionKey,
    actor: ActorRef,
    intent: IntentInstance,
    baseWorld: WorldId,
    trace?: ProposalTrace,
    epoch = 0
  ): Proposal {
    const proposal: Proposal = {
      proposalId,
      actor,
      intent,
      baseWorld,
      status: "submitted",
      epoch,
      executionKey,
      trace,
      submittedAt: Date.now(),
    };

    this.proposals.set(proposal.proposalId as string, proposal);
    return proposal;
  }

  /**
   * Transition a proposal to a new status
   *
   * @param proposalId - The proposal to transition
   * @param to - Target status
   * @param updates - Optional field updates (decisionId, resultWorld, approvedScope, etc.)
   * @returns The updated proposal
   * @throws WorldError if proposal not found or transition is invalid
   */
  transition(
    proposalId: string | ProposalId,
    to: ProposalStatus,
    updates?: TransitionUpdates
  ): Proposal {
    const proposal = this.proposals.get(proposalId as string);
    if (!proposal) {
      throw proposalNotFound(proposalId as string);
    }

    const from = proposal.status;

    // Check if transition is valid
    if (!isValidTransition(from, to)) {
      throw invalidStateTransition(proposalId as string, from, to);
    }

    // Check if decision is required but not provided
    if (
      requiresDecision(to) &&
      !updates?.decisionId &&
      !proposal.decisionId
    ) {
      throw createWorldError(
        "INVALID_ARGUMENT",
        `Transition to '${to}' requires a decisionId`,
        { proposalId, to }
      );
    }

    // Create updated proposal
    const updatedProposal: Proposal = {
      ...proposal,
      status: to,
      ...(updates?.decisionId && { decisionId: updates.decisionId }),
      ...(updates?.resultWorld && { resultWorld: updates.resultWorld }),
      ...(updates?.decidedAt && { decidedAt: updates.decidedAt }),
      ...(updates?.completedAt && { completedAt: updates.completedAt }),
      // approvedScope: only set if explicitly provided (undefined = not set, null = no restriction)
      ...(updates?.approvedScope !== undefined && { approvedScope: updates.approvedScope }),
    };

    this.proposals.set(proposalId as string, updatedProposal);
    return updatedProposal;
  }

  /**
   * Get a proposal by ID
   *
   * @param proposalId - The proposal ID
   * @returns The proposal or undefined
   */
  get(proposalId: string | ProposalId): Proposal | undefined {
    return this.proposals.get(proposalId as string);
  }

  /**
   * Get a proposal by ID, throwing if not found
   *
   * @param proposalId - The proposal ID
   * @returns The proposal
   * @throws WorldError if not found
   */
  getOrThrow(proposalId: string | ProposalId): Proposal {
    const proposal = this.proposals.get(proposalId as string);
    if (!proposal) {
      throw proposalNotFound(proposalId as string);
    }
    return proposal;
  }

  /**
   * Check if a proposal exists
   *
   * @param proposalId - The proposal ID
   * @returns true if exists
   */
  has(proposalId: string | ProposalId): boolean {
    return this.proposals.has(proposalId as string);
  }

  /**
   * Get proposals by status
   *
   * @param status - Status to filter by
   * @returns Proposals with this status
   */
  getByStatus(status: ProposalStatus): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === status
    );
  }

  /**
   * Get proposals by base world
   *
   * @param worldId - World ID to filter by
   * @returns Proposals based on this world
   */
  getByBaseWorld(worldId: WorldId): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.baseWorld === worldId
    );
  }

  /**
   * Get proposals by actor
   *
   * @param actorId - Actor ID to filter by
   * @returns Proposals from this actor
   */
  getByActor(actorId: string): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.actor.actorId === actorId
    );
  }

  /**
   * Get all evaluating proposals (waiting for Authority decision)
   */
  getEvaluating(): Proposal[] {
    return this.getByStatus("evaluating");
  }

  /**
   * Get all executing proposals
   */
  getExecuting(): Proposal[] {
    return this.getByStatus("executing");
  }

  /**
   * Get all terminal proposals
   */
  getTerminal(): Proposal[] {
    return Array.from(this.proposals.values()).filter((p) =>
      isTerminalStatus(p.status)
    );
  }

  /**
   * Get all non-terminal proposals
   */
  getActive(): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => !isTerminalStatus(p.status)
    );
  }

  /**
   * Get all ingress-stage proposals (submitted or evaluating)
   *
   * Per EPOCH-3: These proposals can be dropped on branch switch
   */
  getIngressStage(): Proposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === "submitted" || p.status === "evaluating"
    );
  }

  /**
   * Query proposals with filter
   *
   * @param filter - Filter criteria
   * @returns Matching proposals
   */
  query(filter: ProposalFilter): Proposal[] {
    return Array.from(this.proposals.values()).filter((p) => {
      if (filter.status !== undefined) {
        const statuses = Array.isArray(filter.status)
          ? filter.status
          : [filter.status];
        if (!statuses.includes(p.status)) {
          return false;
        }
      }
      if (filter.actorId !== undefined && p.actor.actorId !== filter.actorId) {
        return false;
      }
      if (filter.baseWorld !== undefined && p.baseWorld !== filter.baseWorld) {
        return false;
      }
      return true;
    });
  }

  /**
   * List all proposals
   */
  list(): Proposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Get the number of proposals
   */
  get size(): number {
    return this.proposals.size;
  }

  /**
   * Clear all proposals
   */
  clear(): void {
    this.proposals.clear();
  }

  /**
   * Remove a specific proposal (for cleanup)
   *
   * @param proposalId - The proposal to remove
   * @returns true if removed
   */
  remove(proposalId: string | ProposalId): boolean {
    return this.proposals.delete(proposalId as string);
  }
}

/**
 * Create a new ProposalQueue
 */
export function createProposalQueue(): ProposalQueue {
  return new ProposalQueue();
}
