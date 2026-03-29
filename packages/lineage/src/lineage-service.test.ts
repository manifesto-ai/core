import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
  createLineageService,
  createWorldRecord,
  type InMemoryLineageStore,
  type PersistedPatchDeltaV2,
} from "./index.js";

function createTestSnapshot(
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

function snapshotStoreState(store: InMemoryLineageStore): string {
  return JSON.stringify({
    worlds: store.listWorlds(),
    edges: store.listEdges(),
    branches: store.getBranches(),
    activeBranchId: store.getActiveBranchId(),
  });
}

describe("@manifesto-ai/lineage service", () => {
  it("prepareSealGenesis is pure and commitPrepared bootstraps the first branch", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const snapshot = createTestSnapshot({ count: 1 });
    const before = snapshotStoreState(store);

    const preparedA = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: snapshot,
      createdAt: 100,
    });
    const preparedB = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: snapshot,
      createdAt: 100,
    });

    expect(preparedA).toEqual(preparedB);
    expect(snapshotStoreState(store)).toBe(before);

    service.commitPrepared(preparedA);

    expect(store.getWorld(preparedA.worldId)).toEqual(preparedA.world);
    expect(service.getActiveBranch().head).toBe(preparedA.worldId);
    expect(service.getLatestHead()?.worldId).toBe(preparedA.worldId);
  });

  it("prepareSealNext rejects self-loops and existing world collisions", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesisSnapshot = createTestSnapshot({ count: 1 });
    const preparedGenesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: genesisSnapshot,
      createdAt: 10,
    });
    service.commitPrepared(preparedGenesis);

    expect(() => service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: genesisSnapshot,
      createdAt: 11,
    })).toThrow(/Prepared worldId equals baseWorldId|already exists/);

    const collidingSnapshot = createTestSnapshot({ count: 2 });
    const firstNext = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: collidingSnapshot,
      createdAt: 12,
    });
    service.commitPrepared(firstNext);

    const branch = service.getActiveBranch();
    expect(() => service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: branch.head,
      branchId: branch.id,
      terminalSnapshot: collidingSnapshot,
      createdAt: 12,
    })).toThrow();
  });

  it("head advances only for completed worlds and failed worlds remain queryable", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const patchDelta: PersistedPatchDeltaV2 = {
      _patchFormat: 2,
      patches: [],
    };
    const success = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
      patchDelta,
      proposalRef: "proposal-1",
      decisionRef: "decision-1",
    });
    service.commitPrepared(success);

    expect(service.getActiveBranch().head).toBe(success.worldId);
    expect(service.getBranch(success.branchId)?.epoch).toBe(1);
    expect(store.getPatchDelta(success.edge.from, success.edge.to)).toEqual(patchDelta);

    const failed = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: success.worldId,
      branchId: success.branchId,
      terminalSnapshot: createTestSnapshot(
        { count: 3 },
        {
          system: {
            status: "idle",
            lastError: {
              code: "ERR",
              message: "boom",
              source: { actionId: "a", nodePath: "/x" },
              timestamp: 0,
            },
            pendingRequirements: [],
            errors: [],
            currentAction: null,
          },
        }
      ),
      createdAt: 3,
    });
    service.commitPrepared(failed);

    expect(failed.branchChange.headAdvanced).toBe(false);
    expect(service.getActiveBranch().head).toBe(success.worldId);
    expect(service.getBranch(success.branchId)?.epoch).toBe(1);
    expect(service.getWorld(failed.worldId)?.terminalStatus).toBe("failed");
    expect(service.getLineage().worlds.has(failed.worldId)).toBe(true);
  });

  it("supports branch creation, branch switching, and snapshot restore", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const newBranchId = service.createBranch("experiment", genesis.worldId);
    const result = service.switchActiveBranch(newBranchId);

    expect(result.previousBranchId).toBe(genesis.branchId);
    expect(result.targetBranchId).toBe(newBranchId);
    expect(service.getActiveBranch().id).toBe(newBranchId);
    expect(service.restore(genesis.worldId)).toEqual(createTestSnapshot({ count: 1 }));
  });

  it("marks forkCreated only when sealing from a world that already has descendants", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const linear = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });
    expect(linear.forkCreated).toBe(false);
    service.commitPrepared(linear);

    const forkBranchId = service.createBranch("fork", genesis.worldId);
    service.switchActiveBranch(forkBranchId);

    const fork = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: forkBranchId,
      terminalSnapshot: createTestSnapshot({ count: 3 }),
      createdAt: 3,
    });

    expect(fork.forkCreated).toBe(true);
  });

  it("createWorldRecord includes terminal status in the stored world", () => {
    const snapshot = createTestSnapshot({ count: 1 });
    const record = createWorldRecord("schema-hash", snapshot, 10, null);

    expect(record.world.terminalStatus).toBe("completed");
    expect(record.world.createdAt).toBe(10);
  });

  it("prepareSealNext is read-only against existing store state", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const before = snapshotStoreState(store);

    const prepared = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });

    expect(prepared.branchChange.headAdvanced).toBe(true);
    expect(snapshotStoreState(store)).toBe(before);
  });
});
