import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
} from "@manifesto-ai/governance";
import { createIntentInstance } from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import * as topLevelWorld from "../../index.js";
import { createFacadeHarness } from "./helpers.js";

describe("@manifesto-ai/world facade public API", () => {
  it("exposes top-level world as the canonical facade surface", () => {
    const removedOrchestratorKey = ["create", "Mani", "festo", "World"].join("");
    const removedStoreFactoryKey = ["create", "Memory", "World", "Store"].join("");

    expect(typeof topLevelWorld.createWorld).toBe("function");
    expect(typeof topLevelWorld.createInMemoryWorldStore).toBe("function");
    expect(typeof topLevelWorld.createIntentInstance).toBe("function");
    expect((topLevelWorld as Record<string, unknown>)[removedOrchestratorKey]).toBeUndefined();
    expect((topLevelWorld as Record<string, unknown>)[removedStoreFactoryKey]).toBeUndefined();
  });

  it("re-exports split-native service factories with pass-through identity", () => {
    expect(topLevelWorld.createLineageService).toBe(createLineageService);
    expect(topLevelWorld.createGovernanceService).toBe(createGovernanceService);
    expect(topLevelWorld.createGovernanceEventDispatcher).toBe(createGovernanceEventDispatcher);
    expect(topLevelWorld.createIntentInstance).toBe(createIntentInstance);
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
