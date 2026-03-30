import { describe, expect, it } from "vitest";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createIntentInstance,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import * as indexedDbWorld from "../../../indexeddb.js";
import * as inMemoryWorld from "../../../in-memory.js";
import * as sqliteWorld from "../../../sqlite.js";
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
        && typeof topLevelExports.createLineageService === "function"
        && typeof topLevelExports.createGovernanceService === "function"
        && typeof topLevelExports.createGovernanceEventDispatcher === "function"
        && typeof topLevelExports.createIntentInstance === "function"
        && (topLevelExports.createInMemoryWorldStore === undefined)
        && (topLevelExports.createIndexedDbWorldStore === undefined)
        && (topLevelExports.createSqliteWorldStore === undefined);
      const passThroughIdentity = topLevelExports.createLineageService === createLineageService
        && topLevelExports.createGovernanceService === createGovernanceService
        && topLevelExports.createGovernanceEventDispatcher === createGovernanceEventDispatcher
        && topLevelExports.createIntentInstance === createIntentInstance;
      const hasSubpathAdapters = typeof inMemoryWorld.createInMemoryWorldStore === "function"
        && typeof indexedDbWorld.createIndexedDbWorldStore === "function"
        && typeof sqliteWorld.createSqliteWorldStore === "function";

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-REEXPORT-1"),
          hasExpectedSurface && hasSubpathAdapters,
          {
            passMessage: "Top-level world exposes the canonical orchestration surface while store adapters live on dedicated subpaths.",
            failMessage: "World package exports did not preserve the top-level/subpath split.",
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
        evaluateRule(
          getRuleOrThrow("FACADE-EVT-3"),
          topLevelExports.createGovernanceEventDispatcher === createGovernanceEventDispatcher,
          {
            passMessage: "Governance provides the concrete dispatcher implementation through the facade surface.",
            failMessage: "Facade did not preserve governance-owned dispatcher implementation identity.",
          },
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(hasSubpathAdapters).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
