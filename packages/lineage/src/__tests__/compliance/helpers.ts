import type { Snapshot } from "../../index.js";
import { createLineageComplianceAdapter } from "./lcts-adapter.js";

export function createTestSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    ...overrides,
  };
}

export function snapshotStoreState(store: {
  getBranches(): unknown;
  getActiveBranchId(): unknown;
  getWorld(worldId: string): unknown;
}): string {
  return JSON.stringify({
    branches: store.getBranches(),
    activeBranchId: store.getActiveBranchId(),
    world: store.getWorld("missing"),
  });
}

export function createBootstrappedLineage() {
  const adapter = createLineageComplianceAdapter();
  const store = adapter.createMemoryStore();
  const service = adapter.createService(store);
  const genesis = service.prepareSealGenesis({
    schemaHash: "schema-hash",
    terminalSnapshot: createTestSnapshot({ count: 1 }),
    createdAt: 1,
  });
  service.commitPrepared(genesis);

  return {
    adapter,
    store,
    service,
    genesis,
  };
}
