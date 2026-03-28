import { describe, expect, it } from "vitest";
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
import { evaluateRule, expectAllCompliance, noteEvidence, warnRule } from "../wfcts-assertions.js";
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
          world.lineage === world.lineage && world.governance === world.governance,
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
        warnRule(
          getRuleOrThrow("FACADE-FACTORY-3"),
          "Same-store identity remains a documented caller precondition for arbitrary custom services/stores.",
          [noteEvidence("Happy-path shared-store wiring is verified; generic mismatch detection stays pending.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-SDK-1"),
          "SDK still consumes the legacy top-level world surface in Phase 4.",
          [noteEvidence("SDK alignment is deferred to Phase 5 by plan.")],
        ),
        warnRule(
          getRuleOrThrow("FACADE-SDK-2"),
          "SDK re-exports are intentionally unchanged in Phase 4.",
          [noteEvidence("Facade subpath is authoritative for this wave; SDK stays pending.")],
        ),
      ]);

      expect(readyToUseWorld).toBe(true);
      expect(hasSplitStoreFactory).toBe(true);
    }
  );
});
