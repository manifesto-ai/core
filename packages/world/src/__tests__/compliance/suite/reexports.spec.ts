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
      "Top-level world is the canonical facade surface and preserves split-native pass-through identity."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const topLevelExports = adapter.topLevelExports();
      const hasExpectedSurface = typeof topLevelExports.createWorld === "function"
        && typeof topLevelExports.createInMemoryWorldStore === "function"
        && typeof topLevelExports.createLineageService === "function"
        && typeof topLevelExports.createGovernanceService === "function"
        && typeof topLevelExports.createGovernanceEventDispatcher === "function"
        && typeof topLevelExports.createIntentInstance === "function";
      const passThroughIdentity = topLevelExports.createLineageService === createLineageService
        && topLevelExports.createGovernanceService === createGovernanceService
        && topLevelExports.createGovernanceEventDispatcher === createGovernanceEventDispatcher
        && topLevelExports.createIntentInstance === createIntentInstance;

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
            passMessage: "Top-level world preserves pass-through identity for split-native service factories and helpers.",
            failMessage: "Top-level world wrapped or replaced split-native service factories or helpers.",
          },
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
