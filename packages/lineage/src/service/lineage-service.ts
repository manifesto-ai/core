import { assertLineage } from "../invariants.js";
import {
  buildWorldLineage,
  getBranchById,
  getHeadsFromStore,
  restoreSnapshot,
  selectLatestHead,
  toBranchInfo,
} from "../query.js";
import {
  createGenesisBranchEntry,
  createSealGenesisAttempt,
  createSealNextAttempt,
  createWorldEdge,
  createWorldRecord,
} from "../records.js";
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

  async prepareSealGenesis(input: SealGenesisInput) {
    assertLineage(
      (await this.store.getBranches()).length === 0,
      "LIN-GENESIS-3 violation: genesis requires empty branch state"
    );

    const record = createWorldRecord(
      input.schemaHash,
      input.terminalSnapshot,
      null
    );

    assertLineage(
      record.world.terminalStatus === "completed",
      "LIN-GENESIS-1 violation: genesis snapshot must derive terminalStatus 'completed'"
    );
    assertLineage(
      (await this.store.getWorld(record.worldId)) == null,
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
      attempt: createSealGenesisAttempt(branch.id, record.worldId, input),
      terminalStatus: "completed" as const,
      edge: null,
      branchChange: {
        kind: "bootstrap" as const,
        branch,
        activeBranchId: branch.id,
      },
    };
  }

  async prepareSealNext(input: SealNextInput) {
    const branchHead = await this.store.getBranchHead(input.branchId);
    assertLineage(branchHead != null, `LIN-BRANCH-SEAL-2 violation: unknown branch ${input.branchId}`);
    assertLineage(
      branchHead === input.baseWorldId,
      `LIN-BRANCH-SEAL-2 violation: branch ${input.branchId} head ${branchHead} does not match baseWorldId ${input.baseWorldId}`
    );

    const branchTip = await this.store.getBranchTip(input.branchId);
    assertLineage(branchTip != null, `LIN-EPOCH-5 violation: branch ${input.branchId} tip is not set`);

    const baseWorld = await this.store.getWorld(input.baseWorldId);
    assertLineage(baseWorld != null, `LIN-BASE-1 violation: base world ${input.baseWorldId} does not exist`);
    assertLineage(
      baseWorld.schemaHash === input.schemaHash,
      `LIN-BASE-4 violation: base world schemaHash ${baseWorld.schemaHash} does not match input ${input.schemaHash}`
    );
    assertLineage(
      baseWorld.terminalStatus !== "failed",
      `LIN-BASE-3 violation: failed base world ${input.baseWorldId} cannot be used as base`
    );

    const baseSnapshot = await this.store.getSnapshot(input.baseWorldId);
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
      branchTip
    );

    const expectedEpoch = await this.store.getBranchEpoch(input.branchId);
    const headAdvanced = record.world.terminalStatus === "completed";
    const forkCreated = (await this.store.getEdges(branchTip))
      .some((candidate) => candidate.from === branchTip);
    const edge = createWorldEdge(branchTip, record.worldId);

    return {
      kind: "next" as const,
      branchId: input.branchId,
      worldId: record.worldId,
      world: record.world,
      terminalSnapshot: input.terminalSnapshot,
      hashInput: record.hashInput,
      attempt: createSealNextAttempt(input.branchId, record.worldId, branchTip, input),
      terminalStatus: record.world.terminalStatus,
      edge,
      forkCreated,
      branchChange: {
        kind: "advance" as const,
        branchId: input.branchId,
        expectedHead: input.baseWorldId,
        nextHead: headAdvanced ? record.worldId : input.baseWorldId,
        headAdvanced,
        expectedTip: branchTip,
        nextTip: record.worldId,
        headAdvancedAt: headAdvanced ? input.createdAt : null,
        expectedEpoch,
        nextEpoch: headAdvanced ? expectedEpoch + 1 : expectedEpoch,
      },
    };
  }

  async commitPrepared(
    prepared: Parameters<LineageService["commitPrepared"]>[0]
  ): Promise<void> {
    await this.store.commitPrepared(prepared);
  }

  async createBranch(name: string, headWorldId: WorldId): Promise<BranchId> {
    const world = await this.store.getWorld(headWorldId);
    assertLineage(world != null, `LIN-BRANCH-CREATE-1 violation: head world ${headWorldId} does not exist`);
    assertLineage(
      world.terminalStatus === "completed",
      `LIN-BRANCH-CREATE-2 violation: head world ${headWorldId} must be completed`
    );

    const branches = await this.store.getBranches();
    const branchId = computeHash({ kind: "branch", name, headWorldId, ordinal: branches.length });
    const branchCreatedAt = branches.reduce((latest, branch) => {
      return Math.max(latest, branch.createdAt, branch.headAdvancedAt);
    }, 0) + 1;

    const branch: PersistedBranchEntry = {
      id: branchId,
      name,
      head: headWorldId,
      tip: headWorldId,
      headAdvancedAt: branchCreatedAt,
      epoch: 0,
      schemaHash: world.schemaHash,
      createdAt: branchCreatedAt,
    };

    await this.store.putBranch(branch);
    return branchId;
  }

  async getBranch(branchId: BranchId): Promise<BranchInfo | null> {
    const branch = getBranchById(await this.store.getBranches(), branchId);
    return branch ? toBranchInfo(branch) : null;
  }

  async getBranches(): Promise<readonly BranchInfo[]> {
    return (await this.store.getBranches()).map(toBranchInfo);
  }

  async getActiveBranch(): Promise<BranchInfo> {
    const activeBranchId = await this.store.getActiveBranchId();
    assertLineage(activeBranchId != null, "LIN-BRANCH-PERSIST-3 violation: active branch is not set");
    const branch = await this.getBranch(activeBranchId);
    assertLineage(branch != null, `LIN-BRANCH-PERSIST-1 violation: missing active branch ${activeBranchId}`);
    return branch;
  }

  async switchActiveBranch(
    targetBranchId: BranchId
  ): Promise<BranchSwitchResult> {
    const previousBranchId = await this.store.getActiveBranchId();
    assertLineage(previousBranchId != null, "LIN-SWITCH-1 violation: active branch is not set");
    await this.store.switchActiveBranch(previousBranchId, targetBranchId);
    return {
      previousBranchId,
      targetBranchId,
      sourceBranchEpochAfter: await this.store.getBranchEpoch(previousBranchId),
    };
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    return this.store.getWorld(worldId);
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return this.store.getSnapshot(worldId);
  }

  async getAttempts(worldId: WorldId) {
    return this.store.getAttempts(worldId);
  }

  async getAttemptsByBranch(branchId: BranchId) {
    return this.store.getAttemptsByBranch(branchId);
  }

  async getLineage(): Promise<WorldLineage> {
    return buildWorldLineage(this.store);
  }

  async getHeads(): Promise<readonly WorldHead[]> {
    return getHeadsFromStore(this.store);
  }

  async getLatestHead(): Promise<WorldHead | null> {
    return selectLatestHead(await this.getHeads());
  }

  async restore(worldId: WorldId): Promise<Snapshot> {
    return restoreSnapshot(this.store, worldId);
  }
}

export function createLineageService(store: LineageStore): LineageService {
  return new DefaultLineageService(store);
}
