import { assertLineage } from "../invariants.js";
import { cloneValue } from "../internal/clone.js";
import type {
  BranchId,
  LineageStore,
  PersistedBranchEntry,
  PersistedPatchDeltaV2,
  PreparedBranchMutation,
  PreparedLineageCommit,
  Snapshot,
  SnapshotHashInput,
  World,
  WorldEdge,
  WorldId,
} from "../types.js";

function patchDeltaKey(from: WorldId, to: WorldId): string {
  return `${from}->${to}`;
}

function cloneBranch(branch: PersistedBranchEntry): PersistedBranchEntry {
  return cloneValue(branch);
}

export class InMemoryLineageStore implements LineageStore {
  private readonly worlds = new Map<WorldId, World>();
  private readonly snapshots = new Map<WorldId, Snapshot>();
  private readonly patchDeltas = new Map<string, PersistedPatchDeltaV2>();
  private readonly hashInputs = new Map<string, SnapshotHashInput>();
  private readonly edges = new Map<string, WorldEdge>();
  private readonly edgesByWorld = new Map<WorldId, Set<string>>();
  private readonly branches = new Map<BranchId, PersistedBranchEntry>();
  private activeBranchId: BranchId | null = null;

  putWorld(world: World): void {
    this.worlds.set(world.worldId, cloneValue(world));
  }

  getWorld(worldId: WorldId): World | null {
    return cloneValue(this.worlds.get(worldId) ?? null);
  }

  putSnapshot(worldId: WorldId, snapshot: Snapshot): void {
    this.snapshots.set(worldId, cloneValue(snapshot));
  }

  getSnapshot(worldId: WorldId): Snapshot | null {
    return cloneValue(this.snapshots.get(worldId) ?? null);
  }

  putPatchDelta(from: WorldId, to: WorldId, delta: PersistedPatchDeltaV2): void {
    assertLineage(delta._patchFormat === 2, "LIN-PERSIST-PATCH-2 violation: only _patchFormat: 2 is supported");
    this.patchDeltas.set(patchDeltaKey(from, to), cloneValue(delta));
  }

  getPatchDelta(from: WorldId, to: WorldId): PersistedPatchDeltaV2 | null {
    return cloneValue(this.patchDeltas.get(patchDeltaKey(from, to)) ?? null);
  }

  putHashInput(snapshotHash: string, input: SnapshotHashInput): void {
    this.hashInputs.set(snapshotHash, cloneValue(input));
  }

  getHashInput(snapshotHash: string): SnapshotHashInput | null {
    return cloneValue(this.hashInputs.get(snapshotHash) ?? null);
  }

  putEdge(edge: WorldEdge): void {
    this.edges.set(edge.edgeId, cloneValue(edge));
    this.indexEdge(edge.from, edge.edgeId);
    this.indexEdge(edge.to, edge.edgeId);
  }

  getEdges(worldId: WorldId): readonly WorldEdge[] {
    const edgeIds = [...(this.edgesByWorld.get(worldId) ?? new Set<string>())].sort();
    return edgeIds
      .map((edgeId) => this.edges.get(edgeId))
      .filter((edge): edge is WorldEdge => edge != null)
      .map((edge) => cloneValue(edge));
  }

  getBranchHead(branchId: BranchId): WorldId | null {
    return this.branches.get(branchId)?.head ?? null;
  }

  getBranchEpoch(branchId: BranchId): number {
    const branch = this.branches.get(branchId);
    assertLineage(branch != null, `LIN-EPOCH-6 violation: unknown branch ${branchId}`);
    return branch.epoch;
  }

  mutateBranch(mutation: PreparedBranchMutation): void {
    const branch = this.branches.get(mutation.branchId);
    assertLineage(branch != null, `LIN-STORE-4 violation: unknown branch ${mutation.branchId}`);
    assertLineage(
      branch.head === mutation.expectedHead && branch.epoch === mutation.expectedEpoch,
      `LIN-STORE-4 violation: branch ${mutation.branchId} CAS mismatch`
    );

    this.branches.set(mutation.branchId, {
      ...branch,
      head: mutation.nextHead,
      epoch: mutation.nextEpoch,
    });
  }

  putBranch(branch: PersistedBranchEntry): void {
    this.branches.set(branch.id, cloneBranch(branch));
  }

  getBranches(): readonly PersistedBranchEntry[] {
    return [...this.branches.values()]
      .sort((left, right) => {
        if (left.createdAt !== right.createdAt) {
          return left.createdAt - right.createdAt;
        }
        if (left.id === right.id) {
          return 0;
        }
        return left.id < right.id ? -1 : 1;
      })
      .map((branch) => cloneBranch(branch));
  }

  getActiveBranchId(): BranchId | null {
    return this.activeBranchId;
  }

  switchActiveBranch(sourceBranchId: BranchId, targetBranchId: BranchId): void {
    assertLineage(sourceBranchId !== targetBranchId, "LIN-SWITCH-5 violation: self-switch is not allowed");
    assertLineage(this.activeBranchId === sourceBranchId, "LIN-SWITCH-1 violation: source branch is not active");

    const sourceBranch = this.branches.get(sourceBranchId);
    const targetBranch = this.branches.get(targetBranchId);
    assertLineage(sourceBranch != null, `LIN-SWITCH-3 violation: missing source branch ${sourceBranchId}`);
    assertLineage(targetBranch != null, `LIN-SWITCH-3 violation: missing target branch ${targetBranchId}`);

    this.branches.set(sourceBranchId, {
      ...sourceBranch,
      epoch: sourceBranch.epoch + 1,
    });
    this.activeBranchId = targetBranchId;
  }

  commitPrepared(prepared: PreparedLineageCommit): void {
    assertLineage(!this.worlds.has(prepared.worldId), `LIN-STORE-9 violation: world ${prepared.worldId} already exists`);

    const nextBranches = new Map(this.branches);
    let nextActiveBranchId = this.activeBranchId;

    if (prepared.branchChange.kind === "bootstrap") {
      assertLineage(nextBranches.size === 0, "LIN-GENESIS-3 violation: genesis requires an empty branch store");
      assertLineage(
        nextActiveBranchId == null,
        "LIN-GENESIS-3 violation: active branch must be empty before genesis bootstrap"
      );
      assertLineage(
        !nextBranches.has(prepared.branchChange.branch.id),
        `LIN-GENESIS-3 violation: branch ${prepared.branchChange.branch.id} already exists`
      );
      nextBranches.set(prepared.branchChange.branch.id, cloneBranch(prepared.branchChange.branch));
      nextActiveBranchId = prepared.branchChange.activeBranchId;
    } else {
      const branch = nextBranches.get(prepared.branchChange.branchId);
      assertLineage(
        branch != null,
        `LIN-STORE-7 violation: missing branch ${prepared.branchChange.branchId} for prepared commit`
      );
      assertLineage(
        branch.head === prepared.branchChange.expectedHead && branch.epoch === prepared.branchChange.expectedEpoch,
        `LIN-STORE-4 violation: branch ${prepared.branchChange.branchId} CAS mismatch`
      );
      nextBranches.set(prepared.branchChange.branchId, {
        ...branch,
        head: prepared.branchChange.nextHead,
        epoch: prepared.branchChange.nextEpoch,
      });
    }

    if (prepared.kind === "next" && prepared.patchDelta != null) {
      assertLineage(
        prepared.patchDelta._patchFormat === 2,
        "LIN-PERSIST-PATCH-2 violation: only _patchFormat: 2 is supported"
      );
    }

    this.putWorld(prepared.world);
    this.putSnapshot(prepared.worldId, prepared.terminalSnapshot);
    this.putHashInput?.(prepared.world.snapshotHash, prepared.hashInput);

    if (prepared.kind === "next") {
      this.putEdge(prepared.edge);
      if (prepared.patchDelta != null) {
        this.putPatchDelta(prepared.edge.from, prepared.edge.to, prepared.patchDelta);
      }
    }

    this.branches.clear();
    for (const [branchId, branch] of nextBranches) {
      this.branches.set(branchId, cloneBranch(branch));
    }
    this.activeBranchId = nextActiveBranchId;
  }

  listWorlds(): readonly World[] {
    return [...this.worlds.values()].map((world) => cloneValue(world));
  }

  listEdges(): readonly WorldEdge[] {
    return [...this.edges.values()].map((edge) => cloneValue(edge));
  }

  private indexEdge(worldId: WorldId, edgeId: string): void {
    const current = this.edgesByWorld.get(worldId) ?? new Set<string>();
    current.add(edgeId);
    this.edgesByWorld.set(worldId, current);
  }
}

export function createInMemoryLineageStore(): InMemoryLineageStore {
  return new InMemoryLineageStore();
}
