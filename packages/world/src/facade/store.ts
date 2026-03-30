import {
  InMemoryGovernanceStore,
  type ActorAuthorityBinding,
  type ActorId,
  type BranchId,
  type DecisionId,
  type DecisionRecord,
  type GovernanceStore,
  type Proposal,
  type ProposalId,
} from "@manifesto-ai/governance";
import {
  InMemoryLineageStore,
  type LineageStore,
  type PersistedBranchEntry,
  type PreparedBranchMutation,
  type SealAttempt,
  type Snapshot,
  type SnapshotHashInput,
  type World,
  type WorldEdge,
  type WorldId,
} from "@manifesto-ai/lineage";
import { wrapCommitSealError } from "./internal/errors.js";
import type { CommitCapableWorldStore, WriteSet } from "./types.js";

export class InMemoryCommitCapableWorldStore implements CommitCapableWorldStore {
  private readonly lineageStore: InMemoryLineageStore;
  private readonly governanceStore: InMemoryGovernanceStore;

  public constructor() {
    this.lineageStore = new InMemoryLineageStore();
    this.governanceStore = new InMemoryGovernanceStore();
  }

  putWorld(world: World): void {
    this.lineageStore.putWorld(world);
  }

  getWorld(worldId: WorldId): World | null {
    return this.lineageStore.getWorld(worldId);
  }

  putSnapshot(worldId: WorldId, snapshot: Snapshot): void {
    this.lineageStore.putSnapshot(worldId, snapshot);
  }

  getSnapshot(worldId: WorldId): Snapshot | null {
    return this.lineageStore.getSnapshot(worldId);
  }

  putAttempt(attempt: SealAttempt): void {
    this.lineageStore.putAttempt(attempt);
  }

  getAttempts(worldId: WorldId): readonly SealAttempt[] {
    return this.lineageStore.getAttempts(worldId);
  }

  getAttemptsByBranch(branchId: BranchId): readonly SealAttempt[] {
    return this.lineageStore.getAttemptsByBranch(branchId);
  }

  putHashInput(snapshotHash: string, input: SnapshotHashInput): void {
    this.lineageStore.putHashInput?.(snapshotHash, input);
  }

  getHashInput(snapshotHash: string): SnapshotHashInput | null {
    return this.lineageStore.getHashInput?.(snapshotHash) ?? null;
  }

  putEdge(edge: WorldEdge): void {
    this.lineageStore.putEdge(edge);
  }

  getEdges(worldId: WorldId): readonly WorldEdge[] {
    return this.lineageStore.getEdges(worldId);
  }

  getBranchHead(branchId: BranchId): WorldId | null {
    return this.lineageStore.getBranchHead(branchId);
  }

  getBranchTip(branchId: BranchId): WorldId | null {
    return this.lineageStore.getBranchTip(branchId);
  }

  getBranchEpoch(branchId: BranchId): number {
    return this.lineageStore.getBranchEpoch(branchId);
  }

  mutateBranch(mutation: PreparedBranchMutation): void {
    this.lineageStore.mutateBranch(mutation);
  }

  putBranch(branch: PersistedBranchEntry): void {
    this.lineageStore.putBranch(branch);
  }

  getBranches(): readonly PersistedBranchEntry[] {
    return this.lineageStore.getBranches();
  }

  getActiveBranchId(): BranchId | null {
    return this.lineageStore.getActiveBranchId();
  }

  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): void {
    this.lineageStore.switchActiveBranch(sourceBranchId, targetBranchId);
  }

  commitPrepared(prepared: Parameters<LineageStore["commitPrepared"]>[0]): void {
    this.lineageStore.commitPrepared(prepared);
  }

  putProposal(proposal: Proposal): void {
    this.governanceStore.putProposal(proposal);
  }

  getProposal(proposalId: ProposalId): Proposal | null {
    return this.governanceStore.getProposal(proposalId);
  }

  getProposalsByBranch(branchId: BranchId): readonly Proposal[] {
    return this.governanceStore.getProposalsByBranch(branchId);
  }

  getExecutionStageProposal(branchId: BranchId): Proposal | null {
    return this.governanceStore.getExecutionStageProposal(branchId);
  }

  putDecisionRecord(record: DecisionRecord): void {
    this.governanceStore.putDecisionRecord(record);
  }

  getDecisionRecord(decisionId: DecisionId): DecisionRecord | null {
    return this.governanceStore.getDecisionRecord(decisionId);
  }

  putActorBinding(binding: ActorAuthorityBinding): void {
    this.governanceStore.putActorBinding(binding);
  }

  getActorBinding(actorId: ActorId): ActorAuthorityBinding | null {
    return this.governanceStore.getActorBinding(actorId);
  }

  getActorBindings(): readonly ActorAuthorityBinding[] {
    return this.governanceStore.getActorBindings();
  }

  commitSeal(writeSet: WriteSet): void {
    const lineageState = this.lineageStore.snapshotState();
    const governanceState = this.governanceStore.snapshotState();

    try {
      this.lineageStore.commitPrepared(writeSet.lineage);
      this.governanceStore.putProposal(writeSet.governance.proposal);
      this.governanceStore.putDecisionRecord(writeSet.governance.decisionRecord);
    } catch (error) {
      this.lineageStore.restoreState(lineageState);
      this.governanceStore.restoreState(governanceState);
      wrapCommitSealError(error);
    }
  }
}

export function createInMemoryWorldStore(): CommitCapableWorldStore {
  return new InMemoryCommitCapableWorldStore();
}
