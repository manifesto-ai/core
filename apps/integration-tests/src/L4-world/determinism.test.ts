/**
 * L4: WorldId Determinism Tests
 *
 * Tests deterministic computation of WorldId.
 * Note: Convergent transition tests are in L5/L6 via Bridge since
 * ManifestoWorld uses submitProposal() which requires IntentInstance.
 */

import { describe, it, expect } from "vitest";
import { createManifestoWorld, type ManifestoWorld } from "@manifesto-ai/world";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const testSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// Helper Functions
// =============================================================================

async function createWorldWithData(
  data: Record<string, unknown>
): Promise<{ host: ManifestoHost; world: ManifestoWorld; worldId: string }> {
  const host = createHost(testSchema, { initialData: data });
  const world = createManifestoWorld({
    schemaHash: testSchema.hash,
    host,
  });

  world.registerActor(userActor, { mode: "auto_approve" });

  const snapshot = await host.getSnapshot();
  const genesis = await world.createGenesis(snapshot);

  return { host, world, worldId: genesis.worldId };
}

// =============================================================================
// L4: WorldId Determinism Tests
// =============================================================================

describe("L4: WorldId Determinism", () => {
  describe("Same data → same worldId", () => {
    it("should produce same worldId for same snapshot data", async () => {
      const data = { count: 42, lastIntent: "test" };

      const result1 = await createWorldWithData(data);
      const result2 = await createWorldWithData(data);

      expect(result1.worldId).toBe(result2.worldId);
    });

    it("should produce same worldId for identical initial state", async () => {
      const result1 = await createWorldWithData({ count: 0, lastIntent: null });
      const result2 = await createWorldWithData({ count: 0, lastIntent: null });

      expect(result1.worldId).toBe(result2.worldId);
    });
  });

  describe("Different data → different worldId", () => {
    it("should produce different worldId for different count", async () => {
      const result1 = await createWorldWithData({ count: 1, lastIntent: null });
      const result2 = await createWorldWithData({ count: 2, lastIntent: null });

      expect(result1.worldId).not.toBe(result2.worldId);
    });

    it("should produce different worldId for different lastIntent", async () => {
      const result1 = await createWorldWithData({ count: 0, lastIntent: "alice" });
      const result2 = await createWorldWithData({ count: 0, lastIntent: "bob" });

      expect(result1.worldId).not.toBe(result2.worldId);
    });
  });

  describe("Hash stability", () => {
    it("should produce consistent hash across multiple computations", async () => {
      const data = { count: 123, lastIntent: "stability-test" };
      const worldIds: string[] = [];

      for (let i = 0; i < 5; i++) {
        const result = await createWorldWithData(data);
        worldIds.push(result.worldId);
      }

      // All worldIds should be identical
      const uniqueIds = new Set(worldIds);
      expect(uniqueIds.size).toBe(1);
    });
  });
});

// =============================================================================
// L4: SnapshotHash Exclusions
// =============================================================================

describe("L4: SnapshotHash Computation", () => {
  it("should exclude timestamp from hash computation", async () => {
    // Create two worlds at different times
    const host1 = createHost(testSchema, { initialData: { count: 0, lastIntent: null } });
    const world1 = createManifestoWorld({ schemaHash: testSchema.hash, host: host1 });
    world1.registerActor(userActor, { mode: "auto_approve" });

    // Wait a bit to ensure different timestamps
    await new Promise((r) => setTimeout(r, 10));

    const host2 = createHost(testSchema, { initialData: { count: 0, lastIntent: null } });
    const world2 = createManifestoWorld({ schemaHash: testSchema.hash, host: host2 });
    world2.registerActor(userActor, { mode: "auto_approve" });

    const genesis1 = await world1.createGenesis(await host1.getSnapshot());
    const genesis2 = await world2.createGenesis(await host2.getSnapshot());

    // Despite different timestamps, worldIds should be same (data is same)
    expect(genesis1.worldId).toBe(genesis2.worldId);
  });
});
