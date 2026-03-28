import { assertLineage } from "../invariants.js";
import {
  buildWorldLineage,
  getBranchById,
  getHeadsFromStore,
  restoreSnapshot,
  selectLatestHead,
  toBranchInfo,
} from "../query.js";
import { createGenesisBranchEntry, createWorldEdge, createWorldRecord } from "../records.js";
import { computeHash } from "../hash.js";
import type {
  BranchId,
  BranchInfo,
  BranchSwitchResult,
  LineageService,
  LineageStore,
  PersistedBranchEntry,
  SealGenesisInput,
  SealNextInput,
  Snapshot,
  World,
  WorldHead,
  WorldId,
  WorldLineage,
} from "../types.js";

export class DefaultLineageService implements LineageService {
  public constructor(private readonly store: LineageStore) {}

  prepareSealGenesis(input: SealGenesisInput) {
    assertLineage(this.store.getBranches().length === 0, "LIN-GENESIS-3 violation: genesis requires empty branch state");

    const record = createWorldRecord(
      input.schemaHash,
      input.terminalSnapshot,
      input.createdAt,
      input.proposalRef ?? null,
      input.traceRef
    );

    assertLineage(
      record.world.terminalStatus === "completed",
      "LIN-GENESIS-1 violation: genesis snapshot must derive terminalStatus 'completed'"
    );
    assertLineage(
      this.store.getWorld(record.worldId) == null,
      `LIN-COLLISION-3 violation: genesis world ${record.worldId} already exists`
    );

    const branch = createGenesisBranchEntry(input, record.worldId);

    return {
      kind: "genesis" as const,
      branchId: branch.id,
      worldId: record.worldId,
      world: record.world,
      terminalSnapshot: input.terminalSnapshot,
      hashInput: record.hashInput,
      terminalStatus: "completed" as const,
      edge: null,
      patchDelta: null,
      branchChange: {
        kind: "bootstrap" as const,
        branch,
        activeBranchId: branch.id,
      },
    };
  }

  prepareSealNext(input: SealNextInput) {
    const branchHead = this.store.getBranchHead(input.branchId);
    assertLineage(branchHead != null, `LIN-BRANCH-SEAL-2 violation: unknown branch ${input.branchId}`);
    assertLineage(
      branchHead === input.baseWorldId,
      `LIN-BRANCH-SEAL-2 violation: branch ${input.branchId} head ${branchHead} does not match baseWorldId ${input.baseWorldId}`
    );

    const baseWorld = this.store.getWorld(input.baseWorldId);
    assertLineage(baseWorld != null, `LIN-BASE-1 violation: base world ${input.baseWorldId} does not exist`);
    assertLineage(
      baseWorld.schemaHash === input.schemaHash,
      `LIN-BASE-4 violation: base world schemaHash ${baseWorld.schemaHash} does not match input ${input.schemaHash}`
    );
    assertLineage(
      baseWorld.terminalStatus !== "failed",
      `LIN-BASE-3 violation: failed base world ${input.baseWorldId} cannot be used as base`
    );

    const baseSnapshot = this.store.getSnapshot(input.baseWorldId);
    assertLineage(baseSnapshot != null, `LIN-PERSIST-BASE-1 violation: missing snapshot for base world ${input.baseWorldId}`);
    assertLineage(
      baseSnapshot.system.pendingRequirements.length === 0,
      `LIN-BASE-2 violation: base world ${input.baseWorldId} has pending requirements`
    );

    if (input.patchDelta != null) {
      assertLineage(
        input.patchDelta._patchFormat === 2,
        "LIN-PERSIST-PATCH-2 violation: only _patchFormat: 2 is supported"
      );
    }

    const record = createWorldRecord(
      input.schemaHash,
      input.terminalSnapshot,
      input.createdAt,
      input.proposalRef ?? null,
      input.traceRef
    );

    assertLineage(
      this.store.getWorld(record.worldId) == null,
      `LIN-COLLISION-1 violation: world ${record.worldId} already exists`
    );
    assertLineage(
      record.worldId !== input.baseWorldId,
      `LIN-COLLISION-2 violation: computed world ${record.worldId} equals base world ${input.baseWorldId}`
    );

    const expectedEpoch = this.store.getBranchEpoch(input.branchId);
    const headAdvanced = record.world.terminalStatus === "completed";
    const edge = createWorldEdge(
      input.baseWorldId,
      record.worldId,
      input.createdAt,
      input.proposalRef,
      input.decisionRef
    );

    return {
      kind: "next" as const,
      branchId: input.branchId,
      worldId: record.worldId,
      world: record.world,
      terminalSnapshot: input.terminalSnapshot,
      hashInput: record.hashInput,
      terminalStatus: record.world.terminalStatus,
      edge,
      patchDelta: input.patchDelta ?? null,
      branchChange: {
        kind: "advance" as const,
        branchId: input.branchId,
        expectedHead: input.baseWorldId,
        nextHead: headAdvanced ? record.worldId : input.baseWorldId,
        headAdvanced,
        expectedEpoch,
        nextEpoch: headAdvanced ? expectedEpoch + 1 : expectedEpoch,
      },
    };
  }

  commitPrepared(prepared: Parameters<LineageService["commitPrepared"]>[0]): void {
    this.store.commitPrepared(prepared);
  }

  createBranch(name: string, headWorldId: WorldId): BranchId {
    const world = this.store.getWorld(headWorldId);
    assertLineage(world != null, `LIN-BRANCH-CREATE-1 violation: head world ${headWorldId} does not exist`);
    assertLineage(
      world.terminalStatus === "completed",
      `LIN-BRANCH-CREATE-2 violation: head world ${headWorldId} must be completed`
    );

    const branches = this.store.getBranches();
    const branchId = computeHash({ kind: "branch", name, headWorldId, ordinal: branches.length });

    const parentBranch = inferParentBranch(branches, headWorldId, this.store.getActiveBranchId());
    const branch: PersistedBranchEntry = {
      id: branchId,
      name,
      head: headWorldId,
      epoch: 0,
      schemaHash: world.schemaHash,
      createdAt: world.createdAt,
      parentBranch: parentBranch?.id,
      lineage: parentBranch ? [...parentBranch.lineage, branchId] : [branchId],
    };

    this.store.putBranch(branch);
    return branchId;
  }

  getBranch(branchId: BranchId): BranchInfo | null {
    const branch = getBranchById(this.store.getBranches(), branchId);
    return branch ? toBranchInfo(branch) : null;
  }

  getBranches(): readonly BranchInfo[] {
    return this.store.getBranches().map(toBranchInfo);
  }

  getActiveBranch(): BranchInfo {
    const activeBranchId = this.store.getActiveBranchId();
    assertLineage(activeBranchId != null, "LIN-BRANCH-PERSIST-3 violation: active branch is not set");
    const branch = this.getBranch(activeBranchId);
    assertLineage(branch != null, `LIN-BRANCH-PERSIST-1 violation: missing active branch ${activeBranchId}`);
    return branch;
  }

  switchActiveBranch(targetBranchId: BranchId): BranchSwitchResult {
    const previousBranchId = this.store.getActiveBranchId();
    assertLineage(previousBranchId != null, "LIN-SWITCH-1 violation: active branch is not set");
    this.store.switchActiveBranch(previousBranchId, targetBranchId);
    return {
      previousBranchId,
      targetBranchId,
      sourceBranchEpochAfter: this.store.getBranchEpoch(previousBranchId),
    };
  }

  getWorld(worldId: WorldId): World | null {
    return this.store.getWorld(worldId);
  }

  getSnapshot(worldId: WorldId): Snapshot | null {
    return this.store.getSnapshot(worldId);
  }

  getLineage(): WorldLineage {
    return buildWorldLineage(this.store);
  }

  getHeads(): readonly WorldHead[] {
    return getHeadsFromStore(this.store);
  }

  getLatestHead(): WorldHead | null {
    return selectLatestHead(this.getHeads());
  }

  restore(worldId: WorldId): Snapshot {
    return restoreSnapshot(this.store, worldId);
  }
}

function inferParentBranch(
  branches: readonly PersistedBranchEntry[],
  headWorldId: WorldId,
  activeBranchId: BranchId | null
): PersistedBranchEntry | null {
  if (activeBranchId != null) {
    const activeBranch = branches.find((branch) => branch.id === activeBranchId);
    if (activeBranch?.head === headWorldId) {
      return activeBranch;
    }
  }

  return branches.find((branch) => branch.head === headWorldId) ?? null;
}

export function createLineageService(store: LineageStore): LineageService {
  return new DefaultLineageService(store);
}
