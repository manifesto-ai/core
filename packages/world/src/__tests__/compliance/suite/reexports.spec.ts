import { describe, expect, it } from "vitest";
import {
  createExecutionKey,
  createManifestoWorld,
  createMemoryWorldStore,
} from "../../../index.js";
import { createWorldFacadeComplianceAdapter } from "../wfcts-adapter.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { expectAllCompliance, noteEvidence, warnRule } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Re-export Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.REEXPORTS_SMOKE,
      "Legacy world package keeps the current facade-compatible export surface stable."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const exported = adapter.exports();
      const hasExpectedSurface = typeof exported.createManifestoWorld === "function"
        && typeof exported.createMemoryWorldStore === "function"
        && typeof exported.createExecutionKey === "function";
      const passThroughIdentity = exported.createManifestoWorld === createManifestoWorld
        && exported.createMemoryWorldStore === createMemoryWorldStore
        && exported.createExecutionKey === createExecutionKey;

      expectAllCompliance([
        warnRule(
          getRuleOrThrow("FACADE-REEXPORT-1"),
          "Current smoke test checks only a small legacy compatibility subset, not the full §5.1 facade re-export contract.",
          [noteEvidence("Kept visible as pending until the split facade exists.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-REEXPORT-3"),
          "Current pass-through check covers a few legacy exports, not the future governance/lineage facade re-export surface.",
          [noteEvidence("Kept visible as pending until re-exports come from split packages.")],
        ),
      ]);

      expect(hasExpectedSurface).toBe(true);
      expect(passThroughIdentity).toBe(true);
    }
  );
});
