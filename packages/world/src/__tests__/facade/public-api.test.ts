import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
} from "@manifesto-ai/governance";
import { createIntentInstance } from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import * as topLevelWorld from "../../index.js";
import * as facadeWorld from "../../facade.js";
import { createFacadeHarness } from "./helpers.js";

describe("@manifesto-ai/world facade public API", () => {
  it("exposes top-level world as the canonical facade surface", () => {
    const removedOrchestratorKey = ["create", "Mani", "festo", "World"].join("");
    const removedStoreFactoryKey = ["create", "Memory", "World", "Store"].join("");

    expect(typeof facadeWorld.createWorld).toBe("function");
    expect(typeof facadeWorld.createInMemoryWorldStore).toBe("function");
    expect(typeof topLevelWorld.createWorld).toBe("function");
    expect(typeof topLevelWorld.createInMemoryWorldStore).toBe("function");
    expect(typeof topLevelWorld.createIntentInstance).toBe("function");
    expect((topLevelWorld as Record<string, unknown>)[removedOrchestratorKey]).toBeUndefined();
    expect((topLevelWorld as Record<string, unknown>)[removedStoreFactoryKey]).toBeUndefined();
    expect(topLevelWorld.createWorld).toBe(facadeWorld.createWorld);
    expect(topLevelWorld.createInMemoryWorldStore).toBe(facadeWorld.createInMemoryWorldStore);
    expect(topLevelWorld.createIntentInstance).toBe(facadeWorld.createIntentInstance);
  });

  it("re-exports split-native service factories with pass-through identity", () => {
    expect(topLevelWorld.createLineageService).toBe(createLineageService);
    expect(topLevelWorld.createGovernanceService).toBe(createGovernanceService);
    expect(topLevelWorld.createGovernanceEventDispatcher).toBe(createGovernanceEventDispatcher);
    expect(topLevelWorld.createIntentInstance).toBe(createIntentInstance);
    expect(facadeWorld.createLineageService).toBe(topLevelWorld.createLineageService);
    expect(facadeWorld.createGovernanceService).toBe(topLevelWorld.createGovernanceService);
    expect(facadeWorld.createGovernanceEventDispatcher).toBe(topLevelWorld.createGovernanceEventDispatcher);
    expect(facadeWorld.createIntentInstance).toBe(topLevelWorld.createIntentInstance);
  });

  it("createWorld returns the provided instances without wrapping them", () => {
    const harness = createFacadeHarness();

    expect(harness.world.store).toBe(harness.store);
    expect(harness.world.lineage).toBe(harness.lineage);
    expect(harness.world.governance).toBe(harness.governance);
    expect(typeof harness.world.coordinator.sealNext).toBe("function");
    expect(typeof harness.world.coordinator.sealGenesis).toBe("function");
  });
});
