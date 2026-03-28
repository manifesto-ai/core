import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import { createWorldFacadeComplianceAdapter } from "../wfcts-adapter.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { evaluateRule, expectAllCompliance } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Re-export Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.REEXPORTS_FACADE,
      "Top-level world is the canonical facade surface and /facade remains an exact alias."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const facadeExports = adapter.facadeExports();
      const topLevelExports = adapter.topLevelExports();
      const hasExpectedSurface = typeof topLevelExports.createWorld === "function"
        && typeof topLevelExports.createInMemoryWorldStore === "function"
        && typeof topLevelExports.createLineageService === "function"
        && typeof topLevelExports.createGovernanceService === "function"
        && typeof topLevelExports.createGovernanceEventDispatcher === "function"
        && typeof topLevelExports.createIntentInstance === "function";
      const passThroughIdentity = topLevelExports.createWorld === facadeExports.createWorld
        && topLevelExports.createInMemoryWorldStore === facadeExports.createInMemoryWorldStore
        && topLevelExports.createLineageService === createLineageService
        && topLevelExports.createGovernanceService === createGovernanceService
        && topLevelExports.createGovernanceEventDispatcher === createGovernanceEventDispatcher
        && topLevelExports.createIntentInstance === createIntentInstance
        && facadeExports.createLineageService === topLevelExports.createLineageService
        && facadeExports.createGovernanceService === topLevelExports.createGovernanceService
        && facadeExports.createGovernanceEventDispatcher === topLevelExports.createGovernanceEventDispatcher
        && facadeExports.createIntentInstance === topLevelExports.createIntentInstance;

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-REEXPORT-1"),
          hasExpectedSurface,
          {
            passMessage: "Top-level world exposes the exact facade-governed composition surface.",
            failMessage: "Top-level world is missing required facade exports.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-REEXPORT-3"),
          passThroughIdentity,
          {
            passMessage: "Top-level world and /facade are exact aliases with pass-through split-native factory identity.",
            failMessage: "Top-level world and /facade diverged or wrapped split-native exports.",
          },
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
