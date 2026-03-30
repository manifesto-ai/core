import { assertLineage } from "../invariants.js";
import { cloneValue } from "../internal/clone.js";
import type {
  BranchId,
  LineageStore,
  PersistedBranchEntry,
  PreparedBranchMutation,
  PreparedLineageCommit,
  SealAttempt,
  Snapshot,
  SnapshotHashInput,
  World,
  WorldEdge,
  WorldId,
} from "../types.js";

function cloneBranch(branch: PersistedBranchEntry): PersistedBranchEntry {
  return cloneValue(branch);
}

function sortAttempts(attempts: readonly SealAttempt[]): readonly SealAttempt[] {
  return [...attempts]
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      if (left.attemptId === right.attemptId) {
        return 0;
      }
      return left.attemptId < right.attemptId ? -1 : 1;
    })
    .map((attempt) => cloneValue(attempt));
}

type InMemoryLineageStoreState = {
  worlds: Map<WorldId, World>;
  snapshots: Map<WorldId, Snapshot>;
  hashInputs: Map<string, SnapshotHashInput>;
  edges: Map<string, WorldEdge>;
  edgesByWorld: Map<WorldId, Set<string>>;
  attempts: Map<string, SealAttempt>;
  attemptsByWorld: Map<WorldId, string[]>;
  attemptsByBranch: Map<BranchId, string[]>;
  branches: Map<BranchId, PersistedBranchEntry>;
  activeBranchId: BranchId | null;
};

export class InMemoryLineageStore implements LineageStore {
  private readonly worlds = new Map<WorldId, World>();
  private readonly snapshots = new Map<WorldId, Snapshot>();
  private readonly hashInputs = new Map<string, SnapshotHashInput>();
  private readonly edges = new Map<string, WorldEdge>();
  private readonly edgesByWorld = new Map<WorldId, Set<string>>();
  private readonly attempts = new Map<string, SealAttempt>();
  private readonly attemptsByWorld = new Map<WorldId, string[]>();
  private readonly attemptsByBranch = new Map<BranchId, string[]>();
  private readonly branches = new Map<BranchId, PersistedBranchEntry>();
  private activeBranchId: BranchId | null = null;

  async putWorld(world: World): Promise<void> {
    this.worlds.set(world.worldId, cloneValue(world));
  }

  async getWorld(worldId: WorldId): Promise<World | null> {
    return cloneValue(this.worlds.get(worldId) ?? null);
  }

  async putSnapshot(worldId: WorldId, snapshot: Snapshot): Promise<void> {
    this.snapshots.set(worldId, cloneValue(snapshot));
  }

  async getSnapshot(worldId: WorldId): Promise<Snapshot | null> {
    return cloneValue(this.snapshots.get(worldId) ?? null);
  }

  async putAttempt(attempt: SealAttempt): Promise<void> {
    this.attempts.set(attempt.attemptId, cloneValue(attempt));
    this.indexAttempt(this.attemptsByWorld, attempt.worldId, attempt.attemptId);
    this.indexAttempt(this.attemptsByBranch, attempt.branchId, attempt.attemptId);
  }

  async getAttempts(worldId: WorldId): Promise<readonly SealAttempt[]> {
    const attemptIds = this.attemptsByWorld.get(worldId) ?? [];
    return sortAttempts(
      attemptIds
        .map((attemptId) => this.attempts.get(attemptId))
        .filter((attempt): attempt is SealAttempt => attempt != null)
    );
  }

  async getAttemptsByBranch(branchId: BranchId): Promise<readonly SealAttempt[]> {
    const attemptIds = this.attemptsByBranch.get(branchId) ?? [];
    return sortAttempts(
      attemptIds
        .map((attemptId) => this.attempts.get(attemptId))
        .filter((attempt): attempt is SealAttempt => attempt != null)
    );
  }

  async putHashInput(snapshotHash: string, input: SnapshotHashInput): Promise<void> {
    this.hashInputs.set(snapshotHash, cloneValue(input));
  }

  async getHashInput(snapshotHash: string): Promise<SnapshotHashInput | null> {
    return cloneValue(this.hashInputs.get(snapshotHash) ?? null);
  }

  async putEdge(edge: WorldEdge): Promise<void> {
    this.edges.set(edge.edgeId, cloneValue(edge));
    this.indexEdge(edge.from, edge.edgeId);
    this.indexEdge(edge.to, edge.edgeId);
  }

  async getEdges(worldId: WorldId): Promise<readonly WorldEdge[]> {
    const edgeIds = [...(this.edgesByWorld.get(worldId) ?? new Set<string>())].sort();
    return edgeIds
      .map((edgeId) => this.edges.get(edgeId))
      .filter((edge): edge is WorldEdge => edge != null)
      .map((edge) => cloneValue(edge));
  }

  async getBranchHead(branchId: BranchId): Promise<WorldId | null> {
    return this.branches.get(branchId)?.head ?? null;
  }

  async getBranchTip(branchId: BranchId): Promise<WorldId | null> {
    return this.branches.get(branchId)?.tip ?? null;
  }

  async getBranchEpoch(branchId: BranchId): Promise<number> {
    const branch = this.branches.get(branchId);
    assertLineage(branch != null, `LIN-EPOCH-6 violation: unknown branch ${branchId}`);
    return branch.epoch;
  }

  async mutateBranch(mutation: PreparedBranchMutation): Promise<void> {
    const branch = this.branches.get(mutation.branchId);
    assertLineage(branch != null, `LIN-STORE-4 violation: unknown branch ${mutation.branchId}`);
    assertLineage(
      branch.head === mutation.expectedHead
        && branch.tip === mutation.expectedTip
        && branch.epoch === mutation.expectedEpoch,
      `LIN-STORE-4 violation: branch ${mutation.branchId} CAS mismatch`
    );

    this.branches.set(mutation.branchId, {
      ...branch,
      head: mutation.nextHead,
      tip: mutation.nextTip,
      headAdvancedAt: mutation.headAdvancedAt ?? branch.headAdvancedAt,
      epoch: mutation.nextEpoch,
    });
  }

  async putBranch(branch: PersistedBranchEntry): Promise<void> {
    this.branches.set(branch.id, cloneBranch(branch));
  }

  async getBranches(): Promise<readonly PersistedBranchEntry[]> {
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

  async getActiveBranchId(): Promise<BranchId | null> {
    return this.activeBranchId;
  }

  async switchActiveBranch(
    sourceBranchId: BranchId,
    targetBranchId: BranchId
  ): Promise<void> {
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

  async commitPrepared(prepared: PreparedLineageCommit): Promise<void> {
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
        branch.head === prepared.branchChange.expectedHead
          && branch.tip === prepared.branchChange.expectedTip
          && branch.epoch === prepared.branchChange.expectedEpoch,
        `LIN-STORE-4 violation: branch ${prepared.branchChange.branchId} CAS mismatch`
      );
      nextBranches.set(prepared.branchChange.branchId, {
        ...branch,
        head: prepared.branchChange.nextHead,
        tip: prepared.branchChange.nextTip,
        headAdvancedAt: prepared.branchChange.headAdvancedAt ?? branch.headAdvancedAt,
        epoch: prepared.branchChange.nextEpoch,
      });
    }

    const existingWorld = this.worlds.get(prepared.worldId) ?? null;
    const reused = existingWorld != null;

    if (reused) {
      assertLineage(
        existingWorld.parentWorldId === prepared.world.parentWorldId,
        `LIN-STORE-9 violation: world ${prepared.worldId} exists with a different parent`
      );
      if (prepared.kind === "next") {
        assertLineage(
          this.edges.has(prepared.edge.edgeId),
          `LIN-STORE-9 violation: reuse world ${prepared.worldId} is missing edge ${prepared.edge.edgeId}`
        );
      }
    } else {
      await this.putWorld(prepared.world);
      await this.putSnapshot(prepared.worldId, prepared.terminalSnapshot);
      await this.putHashInput?.(prepared.world.snapshotHash, prepared.hashInput);

      if (prepared.kind === "next") {
        await this.putEdge(prepared.edge);
      }
    }

    await this.putAttempt({
      ...prepared.attempt,
      reused,
    });

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

  snapshotState(): InMemoryLineageStoreState {
    return {
      worlds: cloneValue(this.worlds),
      snapshots: cloneValue(this.snapshots),
      hashInputs: cloneValue(this.hashInputs),
      edges: cloneValue(this.edges),
      edgesByWorld: cloneValue(this.edgesByWorld),
      attempts: cloneValue(this.attempts),
      attemptsByWorld: cloneValue(this.attemptsByWorld),
      attemptsByBranch: cloneValue(this.attemptsByBranch),
      branches: cloneValue(this.branches),
      activeBranchId: this.activeBranchId,
    };
  }

  restoreState(state: InMemoryLineageStoreState): void {
    this.worlds.clear();
    for (const [worldId, world] of state.worlds) {
      this.worlds.set(worldId, cloneValue(world));
    }

    this.snapshots.clear();
    for (const [worldId, snapshot] of state.snapshots) {
      this.snapshots.set(worldId, cloneValue(snapshot));
    }

    this.hashInputs.clear();
    for (const [snapshotHash, input] of state.hashInputs) {
      this.hashInputs.set(snapshotHash, cloneValue(input));
    }

    this.edges.clear();
    for (const [edgeId, edge] of state.edges) {
      this.edges.set(edgeId, cloneValue(edge));
    }

    this.edgesByWorld.clear();
    for (const [worldId, edgeIds] of state.edgesByWorld) {
      this.edgesByWorld.set(worldId, new Set(edgeIds));
    }

    this.attempts.clear();
    for (const [attemptId, attempt] of state.attempts) {
      this.attempts.set(attemptId, cloneValue(attempt));
    }

    this.attemptsByWorld.clear();
    for (const [worldId, attemptIds] of state.attemptsByWorld) {
      this.attemptsByWorld.set(worldId, [...attemptIds]);
    }

    this.attemptsByBranch.clear();
    for (const [branchId, attemptIds] of state.attemptsByBranch) {
      this.attemptsByBranch.set(branchId, [...attemptIds]);
    }

    this.branches.clear();
    for (const [branchId, branch] of state.branches) {
      this.branches.set(branchId, cloneBranch(branch));
    }

    this.activeBranchId = state.activeBranchId;
  }

  private indexEdge(worldId: WorldId, edgeId: string): void {
    const current = this.edgesByWorld.get(worldId) ?? new Set<string>();
    current.add(edgeId);
    this.edgesByWorld.set(worldId, current);
  }

  private indexAttempt(index: Map<string, string[]>, key: string, attemptId: string): void {
    const current = index.get(key) ?? [];
    current.push(attemptId);
    index.set(key, current);
  }
}

export function createInMemoryLineageStore(): InMemoryLineageStore {
  return new InMemoryLineageStore();
}
