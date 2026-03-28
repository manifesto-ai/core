import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import * as legacyWorld from "../../index.js";
import * as facadeWorld from "../../facade.js";
import { createFacadeHarness } from "./helpers.js";

describe("@manifesto-ai/world facade public API", () => {
  it("exports the new facade surface without mutating the legacy top-level surface", () => {
    expect(typeof facadeWorld.createWorld).toBe("function");
    expect(typeof facadeWorld.createInMemoryWorldStore).toBe("function");
    expect(typeof legacyWorld.createManifestoWorld).toBe("function");
    expect(typeof legacyWorld.createMemoryWorldStore).toBe("function");
    expect("createWorld" in legacyWorld).toBe(false);
  });

  it("re-exports split-native service factories with pass-through identity", () => {
    expect(facadeWorld.createLineageService).toBe(createLineageService);
    expect(facadeWorld.createGovernanceService).toBe(createGovernanceService);
    expect(facadeWorld.createGovernanceEventDispatcher).toBe(createGovernanceEventDispatcher);
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
