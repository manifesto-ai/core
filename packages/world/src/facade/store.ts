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
  type PersistedPatchDeltaV2,
  type PreparedBranchMutation,
  type Snapshot,
  type SnapshotHashInput,
  type World,
  type WorldEdge,
  type WorldId,
} from "@manifesto-ai/lineage";
import { wrapCommitSealError } from "./internal/errors.js";
import type { CommitCapableWorldStore, WriteSet } from "./types.js";

export class InMemoryCommitCapableWorldStore implements CommitCapableWorldStore {
  private readonly lineageStore: LineageStore;
  private readonly governanceStore: GovernanceStore;

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

  putPatchDelta(from: WorldId, to: WorldId, delta: PersistedPatchDeltaV2): void {
    this.lineageStore.putPatchDelta(from, to, delta);
  }

  getPatchDelta(from: WorldId, to: WorldId): PersistedPatchDeltaV2 | null {
    return this.lineageStore.getPatchDelta(from, to);
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
    if (writeSet.kind === "full") {
      if (!writeSet.governance.hasLineageRecords) {
        throw new Error("FACADE-WS-2 violation: full write set requires governance.hasLineageRecords=true");
      }

      try {
        this.lineageStore.commitPrepared(writeSet.lineage);
      } catch (error) {
        wrapCommitSealError(error);
      }
    } else if (writeSet.governance.hasLineageRecords) {
      throw new Error("FACADE-WS-3 violation: govOnly write set requires governance.hasLineageRecords=false");
    }

    this.governanceStore.putProposal(writeSet.governance.proposal);
    this.governanceStore.putDecisionRecord(writeSet.governance.decisionRecord);
  }
}

export function createInMemoryWorldStore(): CommitCapableWorldStore {
  return new InMemoryCommitCapableWorldStore();
}
