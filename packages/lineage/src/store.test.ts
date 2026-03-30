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
  it("commitPrepared persists world, snapshot, edge, hash input, attempt, and branch advance together", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);

    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const next = service.prepareSealNext({
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

    service.commitPrepared(next);

    expect(store.getWorld(next.worldId)).toEqual(next.world);
    expect(store.getSnapshot(next.worldId)).toEqual(next.terminalSnapshot);
    expect(store.getHashInput?.(next.world.snapshotHash)).toEqual(next.hashInput);
    expect(store.getAttempts(next.worldId)).toEqual([
      {
        ...next.attempt,
        reused: false,
      },
    ]);
    expect(store.getBranchHead(next.branchId)).toBe(next.worldId);
    expect(store.getBranchTip(next.branchId)).toBe(next.worldId);
    expect(store.getBranchEpoch(next.branchId)).toBe(1);
  });

  it("commitPrepared rejects stale CAS without mutating branch state", () => {
    const store = createInMemoryLineageStore();
    const service = createLineageService(store);

    const genesis = service.prepareSealGenesis({
      schemaHash: "schema-hash",
      terminalSnapshot: createTestSnapshot({ count: 1 }),
      createdAt: 1,
    });
    service.commitPrepared(genesis);

    const stale = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 2 }),
      createdAt: 2,
    });
    const winner = service.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: genesis.worldId,
      branchId: genesis.branchId,
      terminalSnapshot: createTestSnapshot({ count: 3 }),
      createdAt: 3,
    });
    service.commitPrepared(winner);

    const beforeHead = store.getBranchHead(genesis.branchId);
    const beforeTip = store.getBranchTip(genesis.branchId);
    const beforeEpoch = store.getBranchEpoch(genesis.branchId);
    expect(() => store.commitPrepared(stale)).toThrow();
    expect(store.getBranchHead(genesis.branchId)).toBe(beforeHead);
    expect(store.getBranchTip(genesis.branchId)).toBe(beforeTip);
    expect(store.getBranchEpoch(genesis.branchId)).toBe(beforeEpoch);
  });
});
