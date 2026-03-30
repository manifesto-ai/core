import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
  createLineageService,
  createWorldRecord,
  type InMemoryLineageStore,
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
  it("prepareSealGenesis is pure and commitPrepared bootstraps head, tip, and first attempt", () => {
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
    expect(service.getActiveBranch().tip).toBe(preparedA.worldId);
    expect(service.getActiveBranch().headAdvancedAt).toBe(100);
    expect(service.getAttempts(preparedA.worldId)).toHaveLength(1);
    expect(service.getLatestHead()?.worldId).toBe(preparedA.worldId);
  });

  it("repeated identical failed seals on the same branch produce different worlds because tip changes", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesisSnapshot = createTestSnapshot({ count: 1 });
    const preparedGenesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: genesisSnapshot,
      createdAt: 10,
    });
    service.commitPrepared(preparedGenesis);

    const failingSnapshot = createTestSnapshot(
      { count: 2 },
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
    );

    const firstFailure = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: failingSnapshot,
      createdAt: 11,
    });
    service.commitPrepared(firstFailure);

    const secondFailure = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: failingSnapshot,
      createdAt: 12,
    });

    expect(firstFailure.worldId).not.toBe(secondFailure.worldId);
    expect(secondFailure.world.parentWorldId).toBe(firstFailure.worldId);
  });

  it("head advances only for completed worlds, failed worlds remain queryable, and attempts are stored", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const success = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
      patchDelta: {
        _patchFormat: 2,
        patches: [],
      },
      proposalRef: "proposal-1",
      decisionRef: "decision-1",
    });
    service.commitPrepared(success);

    expect(service.getActiveBranch().head).toBe(success.worldId);
    expect(service.getActiveBranch().tip).toBe(success.worldId);
    expect(service.getBranch(success.branchId)?.epoch).toBe(1);
    expect(service.getAttempts(success.worldId)[0]?.patchDelta).toEqual({
      _patchFormat: 2,
      patches: [],
    });

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
    expect(service.getActiveBranch().tip).toBe(failed.worldId);
    expect(service.getActiveBranch().headAdvancedAt).toBe(2);
    expect(service.getBranch(success.branchId)?.epoch).toBe(1);
    expect(service.getWorld(failed.worldId)?.terminalStatus).toBe("failed");
    expect(service.getLineage().worlds.has(failed.worldId)).toBe(true);
    expect(service.getAttempts(failed.worldId)).toHaveLength(1);
  });

  it("supports branch creation, branch switching, idempotent reuse, and snapshot restore normalization", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const canonical = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot(
        { count: 2, $host: { trace: "first" } },
        {
          computed: { derived: 1 },
          input: { transient: true },
          meta: {
            version: 3,
            timestamp: 10,
            randomSeed: "seed-a",
            schemaHash: "schema-hash",
          },
        }
      ),
      createdAt: 2,
    });
    service.commitPrepared(canonical);

    const newBranchId = service.createBranch("experiment", genesis.worldId);
    const result = service.switchActiveBranch(newBranchId);
    expect(result.previousBranchId).toBe(genesis.branchId);
    expect(result.targetBranchId).toBe(newBranchId);
    expect(service.getActiveBranch().id).toBe(newBranchId);

    const reused = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: newBranchId,
      terminalSnapshot: createTestSnapshot(
        { count: 2, $host: { trace: "second" } },
        {
          computed: { derived: 999 },
          input: { transient: "different" },
          meta: {
            version: 30,
            timestamp: 99,
            randomSeed: "seed-b",
            schemaHash: "schema-hash",
          },
        }
      ),
      createdAt: 3,
    });
    service.commitPrepared(reused);

    expect(reused.worldId).toBe(canonical.worldId);
    expect(service.getAttempts(canonical.worldId)).toHaveLength(2);
    expect(service.getAttempts(canonical.worldId)[1]?.reused).toBe(true);

    const restored = service.restore(canonical.worldId);
    expect(restored).toEqual({
      data: {
        count: 2,
        $host: {},
        $mel: { guards: { intent: {} } },
      },
      computed: { derived: 1 },
      system: {
        status: "idle",
        lastError: null,
        pendingRequirements: [],
        errors: [],
        currentAction: null,
      },
      input: null,
      meta: {
        version: 3,
        timestamp: 0,
        randomSeed: "",
        schemaHash: "schema-hash",
      },
    });
  });

  it("marks forkCreated only when sealing from a tip that already has descendants", () => {
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

  it("createWorldRecord stores positional identity and terminal status on the world record", () => {
    const snapshot = createTestSnapshot({ count: 1 });
    const record = createWorldRecord("schema-hash", snapshot, null);

    expect(record.world.terminalStatus).toBe("completed");
    expect(record.world.parentWorldId).toBeNull();
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
