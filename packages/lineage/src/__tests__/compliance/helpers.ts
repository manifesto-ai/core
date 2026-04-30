import type { Snapshot } from "../../index.js";
import { createLineageComplianceAdapter } from "./lcts-adapter.js";

export function createTestSnapshot(
  state: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    state,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    namespaces: {
      host: {},
      mel: { guards: { intent: {} } },
    },
    ...overrides,
  };
}

export function snapshotStoreState(store: {
  getBranches(): Promise<unknown>;
  getActiveBranchId(): Promise<unknown>;
  getWorld(worldId: string): Promise<unknown>;
}): Promise<string> {
  return (async () => JSON.stringify({
    branches: await store.getBranches(),
    activeBranchId: await store.getActiveBranchId(),
    world: await store.getWorld("missing"),
  }))();
}

export async function createBootstrappedLineage() {
  const adapter = createLineageComplianceAdapter();
  const store = adapter.createMemoryStore();
  const service = adapter.createService(store);
  const genesis = await service.prepareSealGenesis({
    schemaHash: "schema-hash",
    terminalSnapshot: createTestSnapshot({ count: 1 }),
    createdAt: 1,
  });
  await service.commitPrepared(genesis);

  return {
    adapter,
    store,
    service,
    genesis,
  };
}
