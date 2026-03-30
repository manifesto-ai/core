import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
  createLineageService,
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

describe("@manifesto-ai/lineage in-memory store", () => {
  it("commitPrepared persists world, snapshot, edge, hash input, attempt, and branch advance together", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);

    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const next = await service.prepareSealNext({
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

    await service.commitPrepared(next);

    expect(await store.getWorld(next.worldId)).toEqual(next.world);
    expect(await store.getSnapshot(next.worldId)).toEqual(next.terminalSnapshot);
    expect(await store.getHashInput?.(next.world.snapshotHash)).toEqual(next.hashInput);
    expect(await store.getAttempts(next.worldId)).toEqual([
      {
        ...next.attempt,
        reused: false,
      },
    ]);
    expect(await store.getBranchHead(next.branchId)).toBe(next.worldId);
    expect(await store.getBranchTip(next.branchId)).toBe(next.worldId);
    expect(await store.getBranchEpoch(next.branchId)).toBe(1);
  });

  it("commitPrepared rejects stale CAS without mutating branch state", async () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);

    const genesis = await service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    await service.commitPrepared(genesis);

    const stale = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });
    const winner = await service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 3 }),
      createdAt: 3,
    });
    await service.commitPrepared(winner);

    const beforeHead = await store.getBranchHead(genesis.branchId);
    const beforeTip = await store.getBranchTip(genesis.branchId);
    const beforeEpoch = await store.getBranchEpoch(genesis.branchId);
    await expect(store.commitPrepared(stale)).rejects.toThrow();
    expect(await store.getBranchHead(genesis.branchId)).toBe(beforeHead);
    expect(await store.getBranchTip(genesis.branchId)).toBe(beforeTip);
    expect(await store.getBranchEpoch(genesis.branchId)).toBe(beforeEpoch);
  });
});
