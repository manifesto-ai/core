/**
 * L4: Genesis World Creation Tests
 *
 * Tests World genesis creation and lineage.
 * Note: Dispatch testing is done in L5 via Bridge since ManifestoWorld
 * uses submitProposal() which requires IntentInstance, not simple intents.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createManifestoWorld, type ManifestoWorld } from "@manifesto-ai/world";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { userActor } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const testSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// L4: Genesis Tests
// =============================================================================

describe("L4: Genesis World Creation", () => {
  let host: ManifestoHost;
  let world: ManifestoWorld;

  beforeEach(async () => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    world = createManifestoWorld({
      schemaHash: testSchema.hash,
      host,
    });

    // Register actor with auto-approve for testing
    world.registerActor(userActor, { mode: "auto_approve" });
  });

  describe("createGenesis", () => {
    it("should create genesis world with initial snapshot", async () => {
      const snapshot = await host.getSnapshot();
      const genesisWorld = await world.createGenesis(snapshot);

      expect(genesisWorld).toBeDefined();
      expect(genesisWorld.worldId).toBeDefined();
      expect(genesisWorld.worldId.length).toBeGreaterThan(0);
    });

    it("should add genesis to lineage as root", async () => {
      const snapshot = await host.getSnapshot();
      const genesisWorld = await world.createGenesis(snapshot);

      const lineage = world.getLineage();
      expect(lineage).toBeDefined();

      // Genesis should be in the lineage
      const genesisNode = lineage.getWorld(genesisWorld.worldId);
      expect(genesisNode).toBeDefined();
    });

    it("should allow getting snapshot after genesis", async () => {
      const initialSnapshot = await host.getSnapshot();
      const genesis = await world.createGenesis(initialSnapshot);

      // Should be able to get snapshot for genesis world
      const snapshot = await world.getSnapshot(genesis.worldId);
      expect(snapshot).toBeDefined();
      expect(snapshot?.data).toEqual({ count: 0, lastIntent: null });
    });

    it("should make genesis world retrievable via getGenesis", async () => {
      const snapshot = await host.getSnapshot();
      const genesis = await world.createGenesis(snapshot);

      // After creation, genesis should be retrievable
      const retrievedGenesis = await world.getGenesis();
      expect(retrievedGenesis).toBeDefined();
      expect(retrievedGenesis?.worldId).toBe(genesis.worldId);
    });
  });
});

// =============================================================================
// L4: Lineage Structure Tests
// =============================================================================

describe("L4: Lineage Structure", () => {
  let host: ManifestoHost;
  let world: ManifestoWorld;

  beforeEach(async () => {
    host = createHost(testSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    world = createManifestoWorld({
      schemaHash: testSchema.hash,
      host,
    });

    world.registerActor(userActor, { mode: "auto_approve" });
  });

  it("should provide lineage API", async () => {
    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot);

    const lineage = world.getLineage();
    expect(lineage).toBeDefined();
    expect(typeof lineage.getWorld).toBe("function");
    expect(typeof lineage.getAllWorlds).toBe("function");
  });

  it("should have genesis as only world initially", async () => {
    const snapshot = await host.getSnapshot();
    await world.createGenesis(snapshot);

    const lineage = world.getLineage();
    const allWorlds = lineage.getAllWorlds();

    expect(allWorlds.length).toBe(1);
  });

  it("should provide getGenesis method", async () => {
    const snapshot = await host.getSnapshot();
    const createdGenesis = await world.createGenesis(snapshot);

    const retrievedGenesis = await world.getGenesis();
    expect(retrievedGenesis).toBeDefined();
    expect(retrievedGenesis?.worldId).toBe(createdGenesis.worldId);
  });
});
