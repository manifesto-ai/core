import { isExecutionStageStatus } from "../state-machine.js";
import type {
  ActorAuthorityBinding,
  ActorId,
  BranchId,
  DecisionId,
  DecisionRecord,
  GovernanceStore,
  Proposal,
  ProposalId,
} from "../types.js";

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

type InMemoryGovernanceStoreState = {
  proposals: Map<ProposalId, Proposal>;
  decisions: Map<DecisionId, DecisionRecord>;
  actorBindings: Map<ActorId, ActorAuthorityBinding>;
};

export class InMemoryGovernanceStore implements GovernanceStore {
  private readonly proposals = new Map<ProposalId, Proposal>();
  private readonly decisions = new Map<DecisionId, DecisionRecord>();
  private readonly actorBindings = new Map<ActorId, ActorAuthorityBinding>();

  putProposal(proposal: Proposal): void {
    this.proposals.set(proposal.proposalId, cloneValue(proposal));
  }

  getProposal(proposalId: ProposalId): Proposal | null {
    return cloneValue(this.proposals.get(proposalId) ?? null);
  }

  getProposalsByBranch(branchId: BranchId): readonly Proposal[] {
    return [...this.proposals.values()]
      .filter((proposal) => proposal.branchId === branchId)
      .sort((left, right) => {
        if (left.submittedAt !== right.submittedAt) {
          return left.submittedAt - right.submittedAt;
        }
        return left.proposalId.localeCompare(right.proposalId);
      })
      .map((proposal) => cloneValue(proposal));
  }

  getExecutionStageProposal(branchId: BranchId): Proposal | null {
    const matches = this.getProposalsByBranch(branchId).filter((proposal) =>
      isExecutionStageStatus(proposal.status)
    );
    if (matches.length > 1) {
      throw new Error(
        `GOV-STORE-4 violation: multiple execution-stage proposals found for branch ${branchId}`
      );
    }
    return matches[0] ?? null;
  }

  putDecisionRecord(record: DecisionRecord): void {
    this.decisions.set(record.decisionId, cloneValue(record));
  }

  getDecisionRecord(decisionId: DecisionId): DecisionRecord | null {
    return cloneValue(this.decisions.get(decisionId) ?? null);
  }

  putActorBinding(binding: ActorAuthorityBinding): void {
    this.actorBindings.set(binding.actorId, cloneValue(binding));
  }

  getActorBinding(actorId: ActorId): ActorAuthorityBinding | null {
    return cloneValue(this.actorBindings.get(actorId) ?? null);
  }

  getActorBindings(): readonly ActorAuthorityBinding[] {
    return [...this.actorBindings.values()]
      .sort((left, right) => left.actorId.localeCompare(right.actorId))
      .map((binding) => cloneValue(binding));
  }

  snapshotState(): InMemoryGovernanceStoreState {
    return {
      proposals: cloneValue(this.proposals),
      decisions: cloneValue(this.decisions),
      actorBindings: cloneValue(this.actorBindings),
    };
  }

  restoreState(state: InMemoryGovernanceStoreState): void {
    this.proposals.clear();
    for (const [proposalId, proposal] of state.proposals) {
      this.proposals.set(proposalId, cloneValue(proposal));
    }

    this.decisions.clear();
    for (const [decisionId, record] of state.decisions) {
      this.decisions.set(decisionId, cloneValue(record));
    }

    this.actorBindings.clear();
    for (const [actorId, binding] of state.actorBindings) {
      this.actorBindings.set(actorId, cloneValue(binding));
    }
  }
}

export function createInMemoryGovernanceStore(): InMemoryGovernanceStore {
  return new InMemoryGovernanceStore();
}
