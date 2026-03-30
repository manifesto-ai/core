import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
} from "../../../index.js";
import {
  createInMemoryWorldStore,
  createWorld,
} from "../../../index.js";
import {
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
  createFacadeHarness,
} from "../../facade/helpers.js";
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
      const writeSetHarness = createFacadeHarness();
      const { world: baseWorld } = sealStandaloneGenesis(writeSetHarness);
      const { proposal, decisionRecord } = createExecutingProposal(writeSetHarness);
      const originalCommit = writeSetHarness.store.commitSeal.bind(writeSetHarness.store);
      let capturedWriteSet: {
        kind?: string;
        lineage?: unknown;
        governance?: unknown;
      } | null = null;
      const sdkSource = readFileSync(
        new URL("../../../../../sdk/src/index.ts", import.meta.url),
        "utf8",
      );
      const removedLegacyStoreContract = /export type \{[^}]*\bWorldStore\b[^}]*\}/m;
      const sdkHasGovernedTypeExport = sdkSource.includes("CommitCapableWorldStore")
        && sdkSource.includes("WorldCoordinator")
        && !removedLegacyStoreContract.test(sdkSource);
      const sdkHasGovernedRuntimeExports = sdkSource.includes("createInMemoryWorldStore")
        && sdkSource.includes("createWorld");
      const topLevelWorldExports = adapter.topLevelExports();
      const topLevelWorldHasGovernedExports = typeof topLevelWorldExports.createWorld === "function"
        && typeof topLevelWorldExports.createInMemoryWorldStore === "function"
        && typeof topLevelWorldExports.createGovernanceService === "function"
        && typeof topLevelWorldExports.createLineageService === "function";

      const readyToUseWorld = typeof world.coordinator.sealNext === "function"
        && typeof world.coordinator.sealGenesis === "function"
        && world.store === store
        && world.lineage === lineage
        && world.governance === governance;
      const hasSplitStoreFactory = typeof splitStore.getWorld === "function"
        && typeof splitStore.commitPrepared === "function"
        && typeof splitStore.getAttempts === "function"
        && typeof splitStore.getProposal === "function"
        && typeof splitStore.commitSeal === "function";
      const hasFullCompositeStoreSurface = hasSplitStoreFactory
        && typeof splitStore.putDecisionRecord === "function";

      vi.spyOn(writeSetHarness.store, "commitSeal").mockImplementation((writeSet) => {
        capturedWriteSet = writeSet as {
          kind?: string;
          lineage?: unknown;
          governance?: unknown;
        };
        return originalCommit(writeSet);
      });

      writeSetHarness.world.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: baseWorld!.worldId,
          branchId: writeSetHarness.lineage.getActiveBranch().id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });
      const hasLineagePayload = capturedWriteSet != null
        && typeof capturedWriteSet === "object"
        && "lineage" in capturedWriteSet
        && (capturedWriteSet as { lineage?: unknown }).lineage !== undefined;
      const hasGovernancePayload = capturedWriteSet != null
        && typeof capturedWriteSet === "object"
        && "governance" in capturedWriteSet
        && (capturedWriteSet as { governance?: unknown }).governance !== undefined;
      const hasAttemptPayload = capturedWriteSet != null
        && typeof capturedWriteSet === "object"
        && "lineage" in capturedWriteSet
        && typeof (capturedWriteSet as { lineage?: { attempt?: unknown } }).lineage?.attempt !== "undefined";
      const usesGovOnlyVariant = capturedWriteSet != null
        && typeof capturedWriteSet === "object"
        && "kind" in capturedWriteSet
        && (capturedWriteSet as { kind?: string }).kind === "govOnly";
      const sealedWorldId = resultingWorldId(writeSetHarness);
      const latestAttempts = writeSetHarness.store.getAttempts(sealedWorldId);
      const persistedLineageAndGovernance = writeSetHarness.store.getWorld(sealedWorldId)?.worldId === sealedWorldId
        && writeSetHarness.store.getProposal(proposal.proposalId)?.status === "completed"
        && latestAttempts.length > 0;

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
          getRuleOrThrow("FACADE-STORE-1"),
          hasFullCompositeStoreSurface,
          {
            passMessage: "In-memory world store exposes both lineage and governance store methods plus commitSeal().",
            failMessage: "In-memory world store is missing composite lineage/governance store capabilities.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-STORE-3"),
          persistedLineageAndGovernance,
          {
            passMessage: "Full seal commit persisted lineage records, governance records, and lineage attempts together.",
            failMessage: "Full seal commit did not persist the expected lineage + governance + attempt records.",
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
          hasLineagePayload && hasGovernancePayload,
          {
            passMessage: "Current seal path produces a write set carrying both lineage and governance records.",
            failMessage: "Current seal path did not produce a lineage+governance write set.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-2"),
          hasLineagePayload,
          {
            passMessage: "Current facade write sets remain lineage-bearing.",
            failMessage: "Current facade write set omitted lineage records.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-3"),
          capturedWriteSet != null && !usesGovOnlyVariant,
          {
            passMessage: "Current typed seal path does not rely on a governance-only write-set variant.",
            failMessage: "Current typed seal path fell back to a governance-only write-set variant.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-WS-4"),
          hasAttemptPayload,
          {
            passMessage: "Prepared lineage attempts remain part of the committed write set.",
            failMessage: "Prepared lineage attempt payload was missing from the committed write set.",
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
            passMessage: "SDK exposes the hard-cut governed world type surface without the legacy store contract.",
            failMessage: "SDK is still exposing the wrong world type surface after the hard cut.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-SDK-2"),
          sdkHasGovernedRuntimeExports && topLevelWorldHasGovernedExports,
          {
            passMessage: "SDK and top-level world both expose the canonical governed factory surface.",
            failMessage: "SDK or top-level world is missing the hard-cut governed factory surface.",
          },
        ),
      ]);

      expect(readyToUseWorld).toBe(true);
      expect(hasSplitStoreFactory).toBe(true);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.STORE_ATOMICITY,
      "commitSeal() is all-or-nothing and does not leave partial lineage writes behind on governance write failure."
    ),
    () => {
      const harness = createFacadeHarness();
      const { world } = sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = createExecutingProposal(harness);

      const lineageCommit = harness.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: harness.lineage.getActiveBranch().id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 20,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      });
      const governanceCommit = harness.governance.finalize(proposal, lineageCommit, 21);

      const internals = harness.store as unknown as {
        governanceStore: { putProposal: (proposal: unknown) => void };
      };
      const failure = new Error("simulated governance write failure");
      const proposalWriter = vi.spyOn(internals.governanceStore, "putProposal").mockImplementation(() => {
        throw failure;
      });

      expect(() => harness.store.commitSeal({
        lineage: lineageCommit,
        governance: governanceCommit,
      })).toThrow(failure);

      const rolledBack =
        harness.store.getWorld(lineageCommit.worldId) == null
        && harness.store.getAttempts(lineageCommit.worldId).length === 0
        && harness.store.getProposal(proposal.proposalId)?.status === "executing";

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-STORE-2"),
          rolledBack,
          {
            passMessage: "commitSeal() rolled back lineage writes when governance persistence failed.",
            failMessage: "commitSeal() left partial lineage state behind after governance persistence failed.",
          },
        ),
      ]);

      expect(proposalWriter).toHaveBeenCalledTimes(1);
      expect(rolledBack).toBe(true);
    }
  );
});

function resultingWorldId(harness: ReturnType<typeof createFacadeHarness>): string {
  const branch = harness.lineage.getActiveBranch();
  if (!branch.head) {
    throw new Error("expected active branch head after governed seal");
  }
  return branch.head;
}
