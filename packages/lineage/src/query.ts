import { assertLineage } from "./invariants.js";
import { cloneValue } from "./internal/clone.js";
import type {
  BranchInfo,
  LineageStore,
  PersistedBranchEntry,
  Snapshot,
  World,
  WorldEdge,
  WorldHead,
  WorldId,
  WorldLineage,
} from "./types.js";

type EnumerableLineageStore = LineageStore & {
  listWorlds?(): readonly World[];
  listEdges?(): readonly WorldEdge[];
};

export function toBranchInfo(entry: PersistedBranchEntry): BranchInfo {
  return {
    id: entry.id,
    name: entry.name,
    head: entry.head,
    epoch: entry.epoch,
    schemaHash: entry.schemaHash,
    createdAt: entry.createdAt,
  };
}

export function toWorldHead(branch: PersistedBranchEntry, world: World): WorldHead {
  return {
    worldId: world.worldId,
    branchId: branch.id,
    branchName: branch.name,
    createdAt: world.createdAt,
    schemaHash: branch.schemaHash,
  };
}

export function getBranchById(
  branches: readonly PersistedBranchEntry[],
  branchId: string
): PersistedBranchEntry | null {
  return branches.find((branch) => branch.id === branchId) ?? null;
}

export function getHeadsFromStore(store: LineageStore): readonly WorldHead[] {
  const branches = store.getBranches();

  return branches.map((branch) => {
    const world = store.getWorld(branch.head);
    assertLineage(world != null, `LIN-HEAD-6 violation: missing head world ${branch.head} for branch ${branch.id}`);
    assertLineage(
      world.terminalStatus === "completed",
      `LIN-HEAD-3 violation: head world ${branch.head} for branch ${branch.id} must be completed`
    );
    return toWorldHead(branch, world);
  });
}

export function selectLatestHead(heads: readonly WorldHead[]): WorldHead | null {
  if (heads.length === 0) {
    return null;
  }

  const sorted = [...heads].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return right.createdAt - left.createdAt;
    }
    if (left.worldId !== right.worldId) {
      return left.worldId < right.worldId ? -1 : 1;
    }
    if (left.branchId === right.branchId) {
      return 0;
    }
    return left.branchId < right.branchId ? -1 : 1;
  });

  return sorted[0];
}

export function restoreSnapshot(store: LineageStore, worldId: WorldId): Snapshot {
  const snapshot = store.getSnapshot(worldId);
  assertLineage(snapshot != null, `LIN-RESUME-2 violation: missing snapshot for world ${worldId}`);
  return cloneValue(snapshot);
}

export function buildWorldLineage(store: LineageStore): WorldLineage {
  const enumerable = store as EnumerableLineageStore;
  const worlds = enumerable.listWorlds?.() ?? collectWorldsFromBranches(store);
  const edges = enumerable.listEdges?.() ?? collectEdgesFromWorlds(store, worlds);

  assertLineage(worlds.length > 0, "LIN-RESUME-1 violation: lineage is empty");

  const incoming = new Set(edges.map((edge) => edge.to));
  const genesisCandidates = worlds
    .filter((world) => !incoming.has(world.worldId))
    .sort((left, right) => {
      if (left.createdAt !== right.createdAt) {
        return left.createdAt - right.createdAt;
      }
      if (left.worldId === right.worldId) {
        return 0;
      }
      return left.worldId < right.worldId ? -1 : 1;
    });

  const genesis = genesisCandidates[0]?.worldId ?? worlds[0].worldId;

  return {
    genesis,
    worlds: new Map(worlds.map((world) => [world.worldId, cloneValue(world)])),
    edges: new Map(edges.map((edge) => [edge.edgeId, cloneValue(edge)])),
  };
}

function collectWorldsFromBranches(store: LineageStore): readonly World[] {
  const worlds = new Map<WorldId, World>();
  const queue = store.getBranches().map((branch) => branch.head);

  while (queue.length > 0) {
    const nextWorldId = queue.pop()!;
    if (worlds.has(nextWorldId)) {
      continue;
    }

    const world = store.getWorld(nextWorldId);
    if (world == null) {
      continue;
    }
    worlds.set(nextWorldId, world);

    for (const edge of store.getEdges(nextWorldId)) {
      if (edge.to === nextWorldId && !worlds.has(edge.from)) {
        queue.push(edge.from);
      }
    }
  }

  return [...worlds.values()];
}

function collectEdgesFromWorlds(store: LineageStore, worlds: readonly World[]): readonly WorldEdge[] {
  const edges = new Map<string, WorldEdge>();

  for (const world of worlds) {
    for (const edge of store.getEdges(world.worldId)) {
      edges.set(edge.edgeId, edge);
    }
  }

  return [...edges.values()];
}
