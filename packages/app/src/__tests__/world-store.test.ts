import { describe, it, expect } from "vitest";
import {
  createInMemoryWorldStore,
  WorldNotFoundError,
} from "../storage/world-store/index.js";
import type { Snapshot, WorldDelta } from "../core/types/index.js";
import { createWorldId, createProposalId, type World } from "@manifesto-ai/world";

function createSnapshot(
  data: Record<string, unknown>,
  schemaHash = "schema-1",
  version = 0
): Snapshot {
  return {
    data,
    computed: {},
    input: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash,
    },
  };
}

function createWorld(
  worldId: string,
  schemaHash: string,
  snapshotHash: string,
  createdAt: number,
  createdBy: string | null
): World {
  return {
    worldId: createWorldId(worldId),
    schemaHash,
    snapshotHash,
    createdAt,
    createdBy: createdBy ? createProposalId(createdBy) : null,
  };
}

describe("WorldStore (FDR-APP-INTEGRATION-001)", () => {
  it("STORE-2/3/8: restore returns reconstructed snapshot without data.$host", async () => {
    const schemaHash = "schema-1";
    const genesisWorld = createWorld("world-genesis", schemaHash, "snap-0", 0, null);
    const genesisSnapshot = createSnapshot(
      { count: 0, $host: { internal: true } },
      schemaHash,
      0
    );

    const store = createInMemoryWorldStore({
      genesisWorld,
      genesisSnapshot,
      activeHorizon: 0,
    });

    const childWorld = createWorld("world-1", schemaHash, "snap-1", 1, "prop-1");
    const delta: WorldDelta = {
      fromWorld: genesisWorld.worldId,
      toWorld: childWorld.worldId,
      patches: [{ op: "set", path: "data.count", value: 1 }],
      createdAt: 1,
    };

    await store.store(childWorld, delta);

    const restored = await store.restore(childWorld.worldId);
    expect(restored.data).toEqual({ count: 1 });
    expect(restored.data).not.toHaveProperty("$host");
    expect(restored.meta.schemaHash).toBe(schemaHash);

    const restoredGenesis = await store.restore(genesisWorld.worldId);
    expect(restoredGenesis.data).toEqual({ count: 0 });
  });

  it("STORE-2: restore throws for unknown world", async () => {
    const store = createInMemoryWorldStore();
    const missingId = createWorldId("world-missing");

    await expect(store.restore(missingId)).rejects.toThrow(WorldNotFoundError);
  });
});
