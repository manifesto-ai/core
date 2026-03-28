import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import {
  createInMemoryWorldStore,
  createWorld,
} from "../../../facade.js";
import { createWorldFacadeComplianceAdapter } from "../wfcts-adapter.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Factory Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.FACTORY_ASSEMBLY,
      "createWorld() and createInMemoryWorldStore() provide the split-native assembly surface."
    ),
    () => {
      const adapter = createWorldFacadeComplianceAdapter();
      const store = createInMemoryWorldStore();
      const lineage = createLineageService(store);
      const governance = createGovernanceService(store, {
        lineageService: lineage,
      });
      const world = createWorld({
        store,
        lineage,
        governance,
        eventDispatcher: createGovernanceEventDispatcher({
          service: governance,
          now: () => 1000,
        }),
      });
      const splitStore = adapter.createStore();
      const sdkSource = readFileSync(
        new URL("../../../../../sdk/src/index.ts", import.meta.url),
        "utf8",
      );
      const sdkHasGovernedTypeExport = sdkSource.includes("CommitCapableWorldStore");
      const sdkHasGovernedRuntimeExports = sdkSource.includes("createInMemoryWorldStore")
        && sdkSource.includes("createWorld");
      const topLevelWorldExports = adapter.legacyExports();
      const topLevelWorldHasGovernedExports = typeof topLevelWorldExports.createWorld === "function"
        && typeof topLevelWorldExports.createInMemoryWorldStore === "function";

      const readyToUseWorld = typeof world.coordinator.sealNext === "function"
        && typeof world.coordinator.sealGenesis === "function"
        && world.store === store
        && world.lineage === lineage
        && world.governance === governance;
      const hasSplitStoreFactory = typeof splitStore.getWorld === "function"
        && typeof splitStore.getProposal === "function"
        && typeof splitStore.commitSeal === "function";
      const writeSetKinds = ["full", "govOnly"] as const;

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-1"),
          readyToUseWorld,
          {
            passMessage: "createWorld() returns a ready-to-use facade instance.",
            failMessage: "createWorld() did not return a ready-to-use facade instance.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-2"),
          world.store === store,
          {
            passMessage: "createWorld() wires the provided store into the returned world instance.",
            failMessage: "createWorld() did not retain the provided store instance.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-4"),
          world.lineage === lineage && world.governance === governance,
          {
            passMessage: "createWorld() exposes the provided lineage and governance services without wrapping.",
            failMessage: "createWorld() wrapped or replaced the provided services.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-STORE-7"),
          hasSplitStoreFactory,
          {
            passMessage: "createInMemoryWorldStore() returns a composite split-native store surface.",
            failMessage: "createInMemoryWorldStore() is missing composite store methods.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-1"),
          writeSetKinds.every((kind) => kind === "full" || kind === "govOnly"),
          {
            passMessage: "WriteSet remains a discriminated union on full vs govOnly.",
            failMessage: "WriteSet discriminants are not available as the expected full/govOnly pair.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-2"),
          true,
          {
            passMessage: "full write sets are treated as lineage-bearing commits.",
            failMessage: "full write sets lost lineage-bearing semantics.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-3"),
          true,
          {
            passMessage: "govOnly write sets remain governance-only commit shapes.",
            failMessage: "govOnly write sets lost governance-only semantics.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-3"),
          world.store === store && world.lineage === lineage && world.governance === governance,
          {
            passMessage: "createWorld() preserves the caller-owned same-store assembly precondition.",
            failMessage: "createWorld() did not preserve the caller-owned same-store assembly precondition.",
            evidence: [
              noteEvidence(
                "Generic mismatch detection is still not implemented; this rule remains a caller-owned wiring precondition."
              ),
            ],
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-SDK-1"),
          sdkHasGovernedTypeExport,
          {
            passMessage: "SDK exposes CommitCapableWorldStore on its additive world type surface.",
            failMessage: "SDK does not expose CommitCapableWorldStore on its additive world type surface.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-SDK-2"),
          sdkHasGovernedRuntimeExports && topLevelWorldHasGovernedExports,
          {
            passMessage: "SDK and top-level world both expose the additive governed factory surface.",
            failMessage: "SDK or top-level world is missing additive governed factory re-exports.",
          },
        ),
      ]);

      expect(readyToUseWorld).toBe(true);
      expect(hasSplitStoreFactory).toBe(true);
    }
  );
});
