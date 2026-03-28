import { describe, expect, it } from "vitest";
import { createWorldFacadeComplianceAdapter } from "../wfcts-adapter.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { expectAllCompliance, noteEvidence, warnRule } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Factory Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.FACTORY_SMOKE,
      "Legacy createManifestoWorld() and createMemoryWorldStore() remain usable as the pre-split compatibility factory surface."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const world = adapter.createWorld("wfcts-schema");
      const store = adapter.createStore() as {
        getWorld?: unknown;
        saveWorld?: unknown;
      };

      const readyToUseWorld = typeof world.createGenesis === "function"
        && typeof world.submitProposal === "function"
        && typeof world.getLineage === "function";
      const hasLegacyStoreFactory = typeof store.getWorld === "function"
        && typeof store.saveWorld === "function";

      expectAllCompliance([
        warnRule(
          getRuleOrThrow("FACADE-FACTORY-1"),
          "Current smoke test exercises createManifestoWorld(), not the future createWorld() facade contract.",
          [noteEvidence("Kept visible as pending until the actual facade factory exists.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-FACTORY-4"),
          "Split service exposure is pending; legacy world still owns governance and lineage internally.",
          [noteEvidence("Will become blocking once createWorld() accepts pre-built split services.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-STORE-7"),
          "Split createInMemoryWorldStore() is pending; CTS currently exercises legacy createMemoryWorldStore().",
          [noteEvidence(`Legacy store smoke check passed=${hasLegacyStoreFactory}.`)],
        ),
      ]);

      expect(readyToUseWorld).toBe(true);
      expect(hasLegacyStoreFactory).toBe(true);
    }
  );
});
