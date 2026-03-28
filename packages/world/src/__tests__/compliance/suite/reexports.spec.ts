import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
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
      "Facade subpath re-exports split-native services with pass-through identity while top-level world adds non-conflicting governed entrypoints."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const facadeExports = adapter.facadeExports();
      const legacyExports = adapter.legacyExports();
      const hasExpectedSurface = typeof facadeExports.createWorld === "function"
        && typeof facadeExports.createInMemoryWorldStore === "function"
        && typeof facadeExports.createLineageService === "function"
        && typeof facadeExports.createGovernanceService === "function"
        && typeof facadeExports.createGovernanceEventDispatcher === "function";
      const passThroughIdentity = facadeExports.createLineageService === createLineageService
        && facadeExports.createGovernanceService === createGovernanceService
        && facadeExports.createGovernanceEventDispatcher === createGovernanceEventDispatcher
        && typeof legacyExports.createManifestoWorld === "function"
        && typeof legacyExports.createMemoryWorldStore === "function"
        && typeof legacyExports.createWorld === "function"
        && typeof legacyExports.createInMemoryWorldStore === "function";

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-REEXPORT-1"),
          hasExpectedSurface,
          {
            passMessage: "Facade subpath exposes split-native world, governance, and lineage assembly entrypoints.",
            failMessage: "Facade subpath is missing required re-exported services or factories.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-REEXPORT-3"),
          passThroughIdentity,
          {
            passMessage: "Facade subpath preserves pass-through identity for split-native factories while top-level world exposes additive governed entrypoints.",
            failMessage: "Facade subpath wraps split-native identity or top-level world lost additive governed entrypoints.",
          },
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
