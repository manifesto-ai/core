import { describe, expect, it } from "vitest";
import { createProposalId, createWorldId, type World } from "@manifesto-ai/world";
import type { Snapshot, WorldDelta } from "../types/index.js";
import { IncompatiblePatchFormatError } from "../errors/index.js";
import { createInMemoryWorldStore } from "../storage/world-store/index.js";
import { createSnapshotEnvelope } from "../storage/world-store/delta-generator.js";

function makeSnapshot(data: Record<string, unknown>): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: Date.now(),
      randomSeed: "seed",
      schemaHash: "schema-1",
    },
  };
}

function makeWorld(id: string, createdBy: string | null = null): World {
  return {
    worldId: createWorldId(id),
    schemaHash: "schema-1",
    snapshotHash: `hash-${id}`,
    createdAt: Date.now(),
    createdBy: createdBy ? createProposalId(createdBy) : null,
  };
}

describe("InMemoryWorldStore patch format boundary (ADR-009)", () => {
  it("RW-01: store() materializes _patchFormat:2 envelope", async () => {
    const store = createInMemoryWorldStore();
    const genesis = makeWorld("genesis");
    await store.initializeGenesis(genesis, makeSnapshot({ count: 0 }));

    const world2 = makeWorld("world-2", "proposal-1");
    const delta: WorldDelta = {
      fromWorld: genesis.worldId,
      toWorld: world2.worldId,
      createdAt: Date.now(),
      patches: [{ op: "set", path: [{ kind: "prop", name: "count" }], value: 1 }],
    };

    await store.store(world2, delta);

    const entry = (store as unknown as { _worlds: Map<string, { delta: WorldDelta }> })._worlds.get(
      String(world2.worldId)
    );

    expect(entry?.delta.patchEnvelope?._patchFormat).toBe(2);
    expect(entry?.delta.patchEnvelope?.patches).toEqual(delta.patches);
  });

  it("RW-02: restore() hard-rejects missing _patchFormat envelope", async () => {
    const store = createInMemoryWorldStore();
    const genesis = makeWorld("genesis");
    await store.initializeGenesis(genesis, makeSnapshot({ count: 0 }));

    const world2 = makeWorld("world-2", "proposal-1");
    const delta: WorldDelta = {
      fromWorld: genesis.worldId,
      toWorld: world2.worldId,
      createdAt: Date.now(),
      patches: [{ op: "set", path: [{ kind: "prop", name: "count" }], value: 1 }],
    };

    await store.store(world2, delta);

    const worlds = (store as unknown as {
      _worlds: Map<string, { delta: WorldDelta }>;
    })._worlds;
    const entry = worlds.get(String(world2.worldId));
    if (!entry) {
      throw new Error("missing world entry");
    }

    entry.delta = {
      ...entry.delta,
      patchEnvelope: undefined,
    };

    await expect(store.restore(world2.worldId)).rejects.toBeInstanceOf(IncompatiblePatchFormatError);
  });

  it("RW-02: restore() hard-rejects legacy _patchFormat:1", async () => {
    const store = createInMemoryWorldStore();
    const genesis = makeWorld("genesis");
    await store.initializeGenesis(genesis, makeSnapshot({ count: 0 }));

    const world2 = makeWorld("world-2", "proposal-1");
    const delta: WorldDelta = {
      fromWorld: genesis.worldId,
      toWorld: world2.worldId,
      createdAt: Date.now(),
      patches: [{ op: "set", path: [{ kind: "prop", name: "count" }], value: 1 }],
    };

    await store.store(world2, delta);

    const worlds = (store as unknown as {
      _worlds: Map<string, { delta: WorldDelta }>;
    })._worlds;
    const entry = worlds.get(String(world2.worldId));
    if (!entry) {
      throw new Error("missing world entry");
    }

    entry.delta = {
      ...entry.delta,
      patchEnvelope: {
        _patchFormat: 1,
        patches: entry.delta.patches,
      } as unknown as WorldDelta["patchEnvelope"],
    };

    await expect(store.restore(world2.worldId)).rejects.toBeInstanceOf(IncompatiblePatchFormatError);
  });

  it("RW-04: restore() preserves non-data transitions for delta-only entries", async () => {
    const store = createInMemoryWorldStore({ activeHorizon: 1 });
    const genesis = makeWorld("genesis");
    await store.initializeGenesis(genesis, makeSnapshot({ count: 0 }));

    const world2 = makeWorld("world-2", "proposal-1");
    const terminalSnapshot: Snapshot = {
      data: { count: 0 },
      computed: { "computed.synced": true },
      system: {
        status: "pending",
        lastError: null,
        errors: [],
        pendingRequirements: [],
        currentAction: "sync",
      },
      input: { requestId: "r-1" },
      meta: {
        version: 2,
        timestamp: 1700000000000,
        randomSeed: "seed-2",
        schemaHash: "schema-1",
      },
    };

    const delta: WorldDelta = {
      fromWorld: genesis.worldId,
      toWorld: world2.worldId,
      createdAt: Date.now(),
      patches: [],
      snapshotEnvelope: createSnapshotEnvelope(terminalSnapshot),
    };

    await store.store(world2, delta);

    const restored = await store.restore(world2.worldId);
    expect(restored.data).toEqual({ count: 0 });
    expect(restored.computed).toEqual(terminalSnapshot.computed);
    expect(restored.system).toEqual(terminalSnapshot.system);
    expect(restored.input).toEqual(terminalSnapshot.input);
    expect(restored.meta).toEqual(terminalSnapshot.meta);
  });
});
