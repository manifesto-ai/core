import type { BranchInfo, LineageService, PreparedLineageCommit, World, WorldId } from "@manifesto-ai/lineage";
import {
  getValidTransitions,
  isExecutionStageStatus,
  isIngressStatus,
  isValidTransition,
  transitionCreatesDecisionRecord,
} from "../state-machine.js";
import {
  createDecisionId,
  createProposalId,
  type AuthorityResponse,
  type BranchId,
  type CreateProposalInput,
  type DecisionRecord,
  type GovernanceService,
  type GovernanceStore,
  type ExecutionSealRejectedEvent,
  type ExecutionCompletedEvent,
  type ExecutionFailedEvent,
  type PreparedAuthorityResult,
  type PrepareAuthorityResultOptions,
  type PreparedGovernanceCommit,
  type Proposal,
  type ProposalDecidedEvent,
  type ProposalEvaluatingEvent,
  type ProposalId,
  type ProposalSubmittedEvent,
  type ProposalSupersededEvent,
  type WorldCreatedEvent,
  type WorldForkedEvent,
  type SealRejectionReason,
  type Snapshot,
  type SupersedeReason,
  type ErrorInfo,
} from "../types.js";

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

export interface GovernanceServiceOptions {
  readonly lineageService?: Pick<LineageService, "getBranch">;
}

export class DefaultGovernanceService implements GovernanceService {
  public constructor(
    private readonly store: GovernanceStore,
    private readonly options: GovernanceServiceOptions = {}
  ) {}

  createProposal(input: CreateProposalInput): Proposal {
    return freeze({
      proposalId: input.proposalId ?? createProposalId(),
      baseWorld: input.baseWorld,
      branchId: input.branchId,
      actorId: input.actorId,
      authorityId: input.authorityId,
      intent: freeze({ ...input.intent }),
      status: "submitted" as const,
      executionKey: input.executionKey,
      submittedAt: input.submittedAt,
      epoch: input.epoch,
    });
  }

  prepareAuthorityResult(
    proposal: Proposal,
    response: Extract<AuthorityResponse, { kind: "approved" | "rejected" }>,
    options: PrepareAuthorityResultOptions
  ): PreparedAuthorityResult {
    if (proposal.status !== "submitted" && proposal.status !== "evaluating") {
      throw new Error(
        `GOV-TRANS-1 violation: authority result requires ingress proposal, received ${proposal.status}`
      );
    }

    const branchInfo = this.resolveBranchInfo(proposal.branchId);
    const currentEpoch = options.currentEpoch ?? branchInfo?.epoch ?? proposal.epoch;
    const currentHead = options.currentBranchHead ?? branchInfo?.head ?? proposal.baseWorld;

    if (this.shouldDiscardAuthorityResult(proposal, currentEpoch)) {
      return {
        proposal: this.prepareSupersede(proposal, "head_advance"),
        discarded: true,
      };
    }

    if (response.kind === "approved") {
      this.assertBranchGateAvailable(proposal);
      if (currentHead !== proposal.baseWorld) {
        return {
          proposal: this.prepareSupersede(proposal, "head_advance"),
          discarded: true,
        };
      }

      const decisionRecord = freeze({
        decisionId: options.decisionId ?? createDecisionId(),
        proposalId: proposal.proposalId,
        authorityId: proposal.authorityId,
        decision: freeze({ kind: "approved" as const }),
        decidedAt: options.decidedAt,
      });

      return {
        proposal: this.transitionProposal(proposal, "approved", {
          decisionId: decisionRecord.decisionId,
          decidedAt: decisionRecord.decidedAt,
          approvedScope: response.approvedScope,
        }),
        decisionRecord,
        discarded: false,
      };
    }

    const decisionRecord = freeze({
      decisionId: options.decisionId ?? createDecisionId(),
      proposalId: proposal.proposalId,
      authorityId: proposal.authorityId,
      decision: freeze({
        kind: "rejected" as const,
        ...(response.reason ? { reason: response.reason } : {}),
      }),
      decidedAt: options.decidedAt,
    });

    return {
      proposal: this.transitionProposal(proposal, "rejected", {
        decisionId: decisionRecord.decisionId,
        decidedAt: decisionRecord.decidedAt,
      }),
      decisionRecord,
      discarded: false,
    };
  }

  prepareSupersede(proposal: Proposal, reason: SupersedeReason): Proposal {
    return this.transitionProposal(proposal, "superseded", {
      supersededReason: reason,
    });
  }

  invalidateStaleIngress(
    branchId: string,
    currentEpoch?: number
  ): readonly Proposal[] {
    const branchInfo = this.resolveBranchInfo(branchId);
    const nextEpoch = currentEpoch ?? branchInfo?.epoch;
    if (nextEpoch == null) {
      throw new Error(`Cannot invalidate stale ingress without branch epoch for ${branchId}`);
    }

    return this.store
      .getProposalsByBranch(branchId)
      .filter((proposal) => isIngressStatus(proposal.status) && proposal.epoch < nextEpoch)
      .map((proposal) => this.prepareSupersede(proposal, "head_advance"));
  }

  shouldDiscardAuthorityResult(
    proposal: Proposal,
    currentEpoch: number
  ): boolean {
    return proposal.epoch < currentEpoch;
  }

  deriveOutcome(terminalSnapshot: Snapshot): "completed" | "failed" {
    if (terminalSnapshot.system.lastError != null) {
      return "failed";
    }
    if (terminalSnapshot.system.pendingRequirements.length > 0) {
      return "failed";
    }
    return "completed";
  }

  finalize(
    executingProposal: Proposal,
    lineageCommit: PreparedLineageCommit,
    completedAt: number
  ): PreparedGovernanceCommit {
    if (executingProposal.status !== "executing") {
      throw new Error(
        `GOV-SEAL-6 violation: finalize() requires executing proposal, received ${executingProposal.status}`
      );
    }
    if (!executingProposal.decisionId) {
      throw new Error("GOV-SEAL-6 violation: executing proposal is missing decisionId");
    }

    const decisionRecord = this.store.getDecisionRecord(executingProposal.decisionId);
    if (!decisionRecord) {
      throw new Error(
        `GOV-SEAL-6 violation: decision record ${executingProposal.decisionId} not found`
      );
    }

    const derivedOutcome = this.deriveOutcome(lineageCommit.terminalSnapshot);
    if (derivedOutcome !== lineageCommit.terminalStatus) {
      throw new Error(
        `GOV-SEAL-1 violation: deriveOutcome=${derivedOutcome} but lineageCommit.terminalStatus=${lineageCommit.terminalStatus}`
      );
    }

    const proposal = this.transitionProposal(executingProposal, derivedOutcome, {
      resultWorld: lineageCommit.worldId,
      completedAt,
    });

    return freeze({
      proposal,
      decisionRecord,
      hasLineageRecords: true,
    });
  }

  finalizeOnSealRejection(
    executingProposal: Proposal,
    rejection: SealRejectionReason,
    completedAt: number
  ): PreparedGovernanceCommit {
    if (executingProposal.status !== "executing") {
      throw new Error(
        `GOV-SEAL-6 violation: finalizeOnSealRejection() requires executing proposal, received ${executingProposal.status}`
      );
    }
    if (!executingProposal.decisionId) {
      throw new Error("GOV-SEAL-6 violation: executing proposal is missing decisionId");
    }

    const decisionRecord = this.store.getDecisionRecord(executingProposal.decisionId);
    if (!decisionRecord) {
      throw new Error(
        `GOV-SEAL-6 violation: decision record ${executingProposal.decisionId} not found`
      );
    }

    void rejection;

    return freeze({
      proposal: this.transitionProposal(executingProposal, "failed", {
        completedAt,
      }),
      decisionRecord,
      hasLineageRecords: false,
    });
  }

  createProposalSubmittedEvent(
    proposal: Proposal,
    timestamp = Date.now()
  ): ProposalSubmittedEvent {
    return freeze({
      type: "proposal:submitted",
      timestamp,
      proposalId: proposal.proposalId,
      actorId: proposal.actorId,
      baseWorld: proposal.baseWorld,
      branchId: proposal.branchId,
      intent: freeze({
        type: proposal.intent.type,
        intentId: proposal.intent.intentId,
        ...(proposal.intent.input !== undefined ? { input: proposal.intent.input } : {}),
      }),
      executionKey: proposal.executionKey,
      epoch: proposal.epoch,
    });
  }

  createProposalEvaluatingEvent(
    proposal: Proposal,
    timestamp = Date.now()
  ): ProposalEvaluatingEvent {
    return freeze({
      type: "proposal:evaluating",
      timestamp,
      proposalId: proposal.proposalId,
    });
  }

  createProposalDecidedEvent(
    proposal: Proposal,
    decisionRecord: DecisionRecord,
    timestamp = Date.now()
  ): ProposalDecidedEvent {
    return freeze({
      type: "proposal:decided",
      timestamp,
      proposalId: proposal.proposalId,
      decisionId: decisionRecord.decisionId,
      decision: decisionRecord.decision.kind,
      ...(decisionRecord.decision.kind === "rejected" && decisionRecord.decision.reason
        ? { reason: decisionRecord.decision.reason }
        : {}),
    });
  }

  createProposalSupersededEvent(
    proposal: Proposal,
    currentEpoch: number,
    timestamp = Date.now()
  ): ProposalSupersededEvent {
    if (proposal.status !== "superseded" || !proposal.supersededReason) {
      throw new Error(
        "GOV-EPOCH-5 violation: superseded event requires proposal.status='superseded' with supersededReason"
      );
    }

    return freeze({
      type: "proposal:superseded",
      timestamp,
      proposalId: proposal.proposalId,
      currentEpoch,
      proposalEpoch: proposal.epoch,
      reason: proposal.supersededReason,
    });
  }

  createExecutionSealRejectedEvent(
    proposal: Proposal,
    rejection: SealRejectionReason,
    timestamp = Date.now()
  ): ExecutionSealRejectedEvent {
    return freeze({
      type: "execution:seal_rejected",
      timestamp,
      proposalId: proposal.proposalId,
      executionKey: proposal.executionKey,
      rejection,
    });
  }

  createExecutionCompletedEvent(
    proposal: Proposal,
    timestamp = Date.now()
  ): ExecutionCompletedEvent {
    if (!proposal.resultWorld) {
      throw new Error(
        "GOV-EVT-6 violation: execution:completed requires proposal.resultWorld"
      );
    }

    return freeze({
      type: "execution:completed",
      timestamp,
      proposalId: proposal.proposalId,
      executionKey: proposal.executionKey,
      resultWorld: proposal.resultWorld,
    });
  }

  createExecutionFailedEvent(
    proposal: Proposal,
    error: ErrorInfo,
    timestamp = Date.now()
  ): ExecutionFailedEvent {
    if (!proposal.resultWorld) {
      throw new Error(
        "GOV-EVT-7 violation: execution:failed requires proposal.resultWorld"
      );
    }

    return freeze({
      type: "execution:failed",
      timestamp,
      proposalId: proposal.proposalId,
      executionKey: proposal.executionKey,
      resultWorld: proposal.resultWorld,
      error: freeze({
        summary: error.summary,
        ...(error.details !== undefined ? { details: error.details } : {}),
        ...(error.pendingRequirements !== undefined
          ? { pendingRequirements: error.pendingRequirements }
          : {}),
      }),
    });
  }

  createWorldCreatedEvent(
    world: World,
    proposalId: ProposalId,
    from: WorldId,
    outcome: "completed" | "failed",
    timestamp = Date.now()
  ): WorldCreatedEvent {
    return freeze({
      type: "world:created",
      timestamp,
      world,
      from,
      proposalId,
      outcome,
    });
  }

  createWorldForkedEvent(
    branchId: BranchId,
    forkPoint: WorldId,
    timestamp = Date.now()
  ): WorldForkedEvent {
    return freeze({
      type: "world:forked",
      timestamp,
      branchId,
      forkPoint,
    });
  }

  private resolveBranchInfo(branchId: string): BranchInfo | null {
    return this.options.lineageService?.getBranch(branchId) ?? null;
  }

  private assertBranchGateAvailable(proposal: Proposal): void {
    const occupant = this.store.getExecutionStageProposal(proposal.branchId);
    if (occupant && occupant.proposalId !== proposal.proposalId) {
      throw new Error(
        `GOV-BRANCH-GATE-1 violation: branch ${proposal.branchId} already occupied by ${occupant.proposalId}`
      );
    }
  }

  private transitionProposal(
    proposal: Proposal,
    to: Proposal["status"],
    updates: {
      decisionId?: string;
      decidedAt?: number;
      completedAt?: number;
      resultWorld?: WorldId;
      supersededReason?: SupersedeReason;
      approvedScope?: unknown;
    } = {}
  ): Proposal {
    if (!isValidTransition(proposal.status, to)) {
      throw new Error(
        `GOV-TRANS-1 violation: invalid transition ${proposal.status} -> ${to}; valid targets are ${getValidTransitions(proposal.status).join(", ")}`
      );
    }

    if (to === "superseded") {
      if (updates.decisionId != null) {
        throw new Error("GOV-TRANS-3 violation: superseded transition must not create DecisionRecord");
      }
      if (!updates.supersededReason) {
        throw new Error("GOV-STAGE-7 violation: superseded proposal must record supersededReason");
      }
    }

    if (
      transitionCreatesDecisionRecord(proposal.status, to) &&
      updates.decisionId == null
    ) {
      throw new Error(
        `GOV-TRANS-2 violation: transition ${proposal.status} -> ${to} requires decisionId`
      );
    }

    if (to !== "superseded" && updates.supersededReason != null) {
      throw new Error("GOV-TRANS-4 violation: supersededReason is only valid on superseded proposals");
    }

    if (isExecutionStageStatus(proposal.status) && to === "superseded") {
      throw new Error("GOV-STAGE-4 violation: execution-stage proposals must not be superseded");
    }

    return freeze({
      ...proposal,
      status: to,
      ...(updates.decisionId !== undefined ? { decisionId: updates.decisionId } : {}),
      ...(updates.decidedAt !== undefined ? { decidedAt: updates.decidedAt } : {}),
      ...(updates.completedAt !== undefined ? { completedAt: updates.completedAt } : {}),
      ...(updates.resultWorld !== undefined ? { resultWorld: updates.resultWorld } : {}),
      ...(updates.approvedScope !== undefined ? { approvedScope: updates.approvedScope } : {}),
      ...(updates.supersededReason !== undefined
        ? { supersededReason: updates.supersededReason }
        : {}),
      ...(to !== "superseded" ? { supersededReason: undefined } : {}),
    });
  }
}

export function createGovernanceService(
  store: GovernanceStore,
  options?: GovernanceServiceOptions
): DefaultGovernanceService {
  return new DefaultGovernanceService(store, options);
}
