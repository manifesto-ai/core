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
      "Facade subpath re-exports split-native services with pass-through identity while leaving legacy top-level exports unchanged."
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
        && !("createWorld" in legacyExports);

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
            passMessage: "Facade subpath preserves pass-through identity for split-native factories and leaves legacy top-level exports unchanged.",
            failMessage: "Facade subpath wraps or collides with existing split-native export identity.",
          },
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
