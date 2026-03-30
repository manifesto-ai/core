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

  async putProposal(proposal: Proposal): Promise<void> {
    this.proposals.set(proposal.proposalId, cloneValue(proposal));
  }

  async getProposal(proposalId: ProposalId): Promise<Proposal | null> {
    return cloneValue(this.proposals.get(proposalId) ?? null);
  }

  async getProposalsByBranch(branchId: BranchId): Promise<readonly Proposal[]> {
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

  async getExecutionStageProposal(branchId: BranchId): Promise<Proposal | null> {
    const matches = (await this.getProposalsByBranch(branchId)).filter((proposal) =>
      isExecutionStageStatus(proposal.status)
    );
    if (matches.length > 1) {
      throw new Error(
        `GOV-STORE-4 violation: multiple execution-stage proposals found for branch ${branchId}`
      );
    }
    return matches[0] ?? null;
  }

  async putDecisionRecord(record: DecisionRecord): Promise<void> {
    this.decisions.set(record.decisionId, cloneValue(record));
  }

  async getDecisionRecord(decisionId: DecisionId): Promise<DecisionRecord | null> {
    return cloneValue(this.decisions.get(decisionId) ?? null);
  }

  async putActorBinding(binding: ActorAuthorityBinding): Promise<void> {
    this.actorBindings.set(binding.actorId, cloneValue(binding));
  }

  async getActorBinding(actorId: ActorId): Promise<ActorAuthorityBinding | null> {
    return cloneValue(this.actorBindings.get(actorId) ?? null);
  }

  async getActorBindings(): Promise<readonly ActorAuthorityBinding[]> {
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
