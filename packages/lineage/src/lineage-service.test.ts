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

async function snapshotStoreState(store: InMemoryLineageStore): Promise<string> {
  return JSON.stringify({
    worlds: store.listWorlds(),
    edges: store.listEdges(),
    branches: await store.getBranches(),
    activeBranchId: await store.getActiveBranchId(),
  });
}

describe("@manifesto-ai/lineage service", () => {
  it("prepareSealGenesis is pure and commitPrepared bootstraps head, tip, and first attempt", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const snapshot = createTestSnapshot({ count: 1 });
    const before = await snapshotStoreState(store);

    const preparedA = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: snapshot,
      createdAt: 100,
    });
    const preparedB = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: snapshot,
      createdAt: 100,
    });

    expect(preparedA).toEqual(preparedB);
    expect(await snapshotStoreState(store)).toBe(before);

    await service.commitPrepared(preparedA);

    expect(await store.getWorld(preparedA.worldId)).toEqual(preparedA.world);
    expect((await service.getActiveBranch()).head).toBe(preparedA.worldId);
    expect((await service.getActiveBranch()).tip).toBe(preparedA.worldId);
    expect((await service.getActiveBranch()).headAdvancedAt).toBe(100);
    expect(await service.getAttempts(preparedA.worldId)).toHaveLength(1);
    expect((await service.getLatestHead())?.worldId).toBe(preparedA.worldId);
  });

  it("repeated identical failed seals on the same branch produce different worlds because tip changes", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesisSnapshot = createTestSnapshot({ count: 1 });
    const preparedGenesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: genesisSnapshot,
      createdAt: 10,
    });
    await service.commitPrepared(preparedGenesis);

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
          currentAction: null,
        },
      }
    );

    const firstFailure = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: failingSnapshot,
      createdAt: 11,
    });
    await service.commitPrepared(firstFailure);

    const secondFailure = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: preparedGenesis.worldId,
      branchId: preparedGenesis.branchId,
      terminalSnapshot: failingSnapshot,
      createdAt: 12,
    });

    expect(firstFailure.worldId).not.toBe(secondFailure.worldId);
    expect(secondFailure.world.parentWorldId).toBe(firstFailure.worldId);
  });

  it("head advances only for completed worlds, failed worlds remain queryable, and attempts are stored", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const success = await service.prepareSealNext({
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
    await service.commitPrepared(success);

    expect((await service.getActiveBranch()).head).toBe(success.worldId);
    expect((await service.getActiveBranch()).tip).toBe(success.worldId);
    expect((await service.getBranch(success.branchId))?.epoch).toBe(1);
    expect((await service.getAttempts(success.worldId))[0]?.patchDelta).toEqual({
      _patchFormat: 2,
      patches: [],
    });

    const failed = await service.prepareSealNext({
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
            currentAction: null,
          },
        }
      ),
      createdAt: 3,
    });
    await service.commitPrepared(failed);

    expect(failed.branchChange.headAdvanced).toBe(false);
    expect((await service.getActiveBranch()).head).toBe(success.worldId);
    expect((await service.getActiveBranch()).tip).toBe(failed.worldId);
    expect((await service.getActiveBranch()).headAdvancedAt).toBe(2);
    expect((await service.getBranch(success.branchId))?.epoch).toBe(1);
    expect((await service.getWorld(failed.worldId))?.terminalStatus).toBe("failed");
    expect((await service.getLineage()).worlds.has(failed.worldId)).toBe(true);
    expect(await service.getAttempts(failed.worldId)).toHaveLength(1);
  });

  it("supports branch creation, branch switching, idempotent reuse, and snapshot restore normalization", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const canonical = await service.prepareSealNext({
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
    await service.commitPrepared(canonical);

    const newBranchId = await service.createBranch("experiment", genesis.worldId);
    const result = await service.switchActiveBranch(newBranchId);
    expect(result.previousBranchId).toBe(genesis.branchId);
    expect(result.targetBranchId).toBe(newBranchId);
    expect((await service.getActiveBranch()).id).toBe(newBranchId);

    const reused = await service.prepareSealNext({
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
    await service.commitPrepared(reused);

    expect(reused.worldId).toBe(canonical.worldId);
    expect(await service.getAttempts(canonical.worldId)).toHaveLength(2);
    expect((await service.getAttempts(canonical.worldId))[1]?.reused).toBe(true);

    const restored = await service.restore(canonical.worldId);
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

  it("marks forkCreated only when sealing from a tip that already has descendants", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const linear = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });
    expect(linear.forkCreated).toBe(false);
    await service.commitPrepared(linear);

    const forkBranchId = await service.createBranch("fork", genesis.worldId);
    await service.switchActiveBranch(forkBranchId);

    const fork = await service.prepareSealNext({
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

  it("prepareSealNext is read-only against existing store state", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);
    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const before = await snapshotStoreState(store);

    const prepared = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });

    expect(prepared.branchChange.headAdvanced).toBe(true);
    expect(await snapshotStoreState(store)).toBe(before);
  });
});
