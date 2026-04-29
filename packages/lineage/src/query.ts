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
    tip: entry.tip,
    headAdvancedAt: entry.headAdvancedAt,
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
    createdAt: branch.headAdvancedAt,
    schemaHash: branch.schemaHash,
  };
}

export function getBranchById(
  branches: readonly PersistedBranchEntry[],
  branchId: string
): PersistedBranchEntry | null {
  return branches.find((branch) => branch.id === branchId) ?? null;
}

export async function getHeadsFromStore(
  store: LineageStore
): Promise<readonly WorldHead[]> {
  const branches = await store.getBranches();

  return Promise.all(branches.map(async (branch) => {
    const world = await store.getWorld(branch.head);
    assertLineage(world != null, `LIN-HEAD-6 violation: missing head world ${branch.head} for branch ${branch.id}`);
    assertLineage(
      world.terminalStatus === "completed",
      `LIN-HEAD-3 violation: head world ${branch.head} for branch ${branch.id} must be completed`
    );
    return toWorldHead(branch, world);
  }));
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

function normalizeNamespaces(namespaces: Snapshot["namespaces"] | null | undefined): Snapshot["namespaces"] {
  const normalized: Record<string, unknown> = {};

  for (const key of Object.keys(namespaces ?? {})) {
    normalized[key] = key === "mel"
      ? { guards: { intent: {} } }
      : {};
  }

  normalized.host = {};
  normalized.mel = { guards: { intent: {} } };
  return normalized;
}

export async function restoreSnapshot(
  store: LineageStore,
  worldId: WorldId
): Promise<Snapshot> {
  const snapshot = await store.getSnapshot(worldId);
  assertLineage(snapshot != null, `LIN-RESUME-2 violation: missing snapshot for world ${worldId}`);

  return {
    state: cloneValue(snapshot.state),
    computed: cloneValue(snapshot.computed),
    system: {
      status: snapshot.system.status,
      lastError: cloneValue(snapshot.system.lastError),
      pendingRequirements: cloneValue(snapshot.system.pendingRequirements),
      currentAction: null,
    },
    input: null,
    meta: {
      version: snapshot.meta.version,
      timestamp: 0,
      randomSeed: "",
      schemaHash: snapshot.meta.schemaHash,
    },
    namespaces: normalizeNamespaces(snapshot.namespaces),
  };
}

export async function buildWorldLineage(store: LineageStore): Promise<WorldLineage> {
  const enumerable = store as EnumerableLineageStore;
  const worlds = enumerable.listWorlds?.() ?? await collectWorldsFromBranches(store);
  const edges = enumerable.listEdges?.() ?? await collectEdgesFromWorlds(store, worlds);

  assertLineage(worlds.length > 0, "LIN-RESUME-1 violation: lineage is empty");

  const incoming = new Set(edges.map((edge) => edge.to));
  const genesisCandidates = worlds
    .filter((world) => !incoming.has(world.worldId))
    .sort((left, right) => {
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

async function collectWorldsFromBranches(store: LineageStore): Promise<readonly World[]> {
  const worlds = new Map<WorldId, World>();
  const queue = (await store.getBranches()).flatMap((branch) => [branch.head, branch.tip]);

  while (queue.length > 0) {
    const nextWorldId = queue.pop()!;
    if (worlds.has(nextWorldId)) {
      continue;
    }

    const world = await store.getWorld(nextWorldId);
    if (world == null) {
      continue;
    }
    worlds.set(nextWorldId, world);

    if (world.parentWorldId != null && !worlds.has(world.parentWorldId)) {
      queue.push(world.parentWorldId);
    }
  }

  return [...worlds.values()];
}

async function collectEdgesFromWorlds(
  store: LineageStore,
  worlds: readonly World[]
): Promise<readonly WorldEdge[]> {
  const edges = new Map<string, WorldEdge>();

  for (const world of worlds) {
    for (const edge of await store.getEdges(world.worldId)) {
      edges.set(edge.edgeId, edge);
    }
  }

  return [...edges.values()];
}
