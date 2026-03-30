import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createLineageService,
} from "../../../index.js";
import { createInMemoryWorldStore, createWorld } from "../../../index.js";
import {
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
  createFacadeHarness,
} from "../../facade/helpers.js";
import { createWorldFacadeComplianceAdapter } from "../wfcts-adapter.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Factory Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.FACTORY_ASSEMBLY,
      "createWorld() and createInMemoryWorldStore() provide the split-native assembly surface."
    ),
    async () => {
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
        executor: {
          async execute() {
            throw new Error("WFCTS factory assembly must not execute runtime paths");
          },
        },
      });
      const splitStore = adapter.createStore();
      const writeSetHarness = createFacadeHarness();
      const { world: baseWorld } = await sealStandaloneGenesis(writeSetHarness);
      const { proposal, decisionRecord } = await createExecutingProposal(
        writeSetHarness
      );
      const activeBranch = await writeSetHarness.lineage.getActiveBranch();
      const originalRunInSealTransaction =
        writeSetHarness.store.runInSealTransaction.bind(writeSetHarness.store);
      let lineageCommitted = false;
      let governancePersisted = false;
      let attemptCommitted = false;
      const sdkSource = readFileSync(
        new URL("../../../../../sdk/src/index.ts", import.meta.url),
        "utf8"
      );
      const removedLegacyStoreContract =
        /export type \{[^}]*\bWorldStore\b[^}]*\}/m;
      const sdkHasGovernedTypeExport =
        sdkSource.includes("GovernedWorldStore") &&
        sdkSource.includes("WorldCoordinator") &&
        sdkSource.includes("WorldRuntime") &&
        sdkSource.includes("WorldExecutor") &&
        !sdkSource.includes("CommitCapableWorldStore") &&
        !sdkSource.includes("WriteSet") &&
        !removedLegacyStoreContract.test(sdkSource);
      const sdkHasGovernedRuntimeExports =
        sdkSource.includes("createInMemoryWorldStore") &&
        sdkSource.includes("createWorld");
      const topLevelWorldExports = adapter.topLevelExports();
      const topLevelWorldHasGovernedExports =
        typeof topLevelWorldExports.createWorld === "function" &&
        typeof topLevelWorldExports.createInMemoryWorldStore === "function" &&
        typeof topLevelWorldExports.createIndexedDbWorldStore === "function" &&
        typeof topLevelWorldExports.createGovernanceService === "function" &&
        typeof topLevelWorldExports.createLineageService === "function";

      const readyToUseWorld =
        typeof world.coordinator.sealNext === "function" &&
        typeof world.coordinator.sealGenesis === "function" &&
        typeof world.runtime.executeApprovedProposal === "function" &&
        world.store === store &&
        world.lineage === lineage &&
        world.governance === governance;
      const hasSplitStoreFactory =
        typeof splitStore.getWorld === "function" &&
        typeof splitStore.commitPrepared === "function" &&
        typeof splitStore.getAttempts === "function" &&
        typeof splitStore.getProposal === "function" &&
        typeof splitStore.runInSealTransaction === "function" &&
        (splitStore as Record<string, unknown>).commitSeal === undefined;
      const hasFullCompositeStoreSurface =
        hasSplitStoreFactory &&
        typeof splitStore.putDecisionRecord === "function";

      vi.spyOn(writeSetHarness.store, "runInSealTransaction").mockImplementation(
        async (work) =>
          originalRunInSealTransaction(async (tx) =>
            work({
              async commitPrepared(prepared) {
                lineageCommitted = true;
                attemptCommitted = prepared.attempt !== undefined;
                await tx.commitPrepared(prepared);
              },
              async putProposal(proposalRecord) {
                governancePersisted = true;
                await tx.putProposal(proposalRecord);
              },
              async putDecisionRecord(record) {
                await tx.putDecisionRecord(record);
              },
            })
          )
      );

      await writeSetHarness.world.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: baseWorld!.worldId,
          branchId: activeBranch.id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });
      const sealedWorldId = await resultingWorldId(writeSetHarness);
      const latestAttempts = await writeSetHarness.store.getAttempts(sealedWorldId);
      const persistedLineageAndGovernance =
        (await writeSetHarness.store.getWorld(sealedWorldId))?.worldId ===
          sealedWorldId &&
        (await writeSetHarness.store.getProposal(proposal.proposalId))?.status ===
          "completed" &&
        latestAttempts.length > 0;

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("FACADE-FACTORY-1"), readyToUseWorld, {
          passMessage:
            "createWorld() returns a ready-to-use facade instance.",
          failMessage:
            "createWorld() did not return a ready-to-use facade instance.",
        }),
        evaluateRule(getRuleOrThrow("FACADE-FACTORY-2"), world.store === store, {
          passMessage:
            "createWorld() wires the provided store into the returned world instance.",
          failMessage:
            "createWorld() did not retain the provided store instance.",
        }),
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-4"),
          world.lineage === lineage && world.governance === governance,
          {
            passMessage:
              "createWorld() exposes the provided lineage and governance services without wrapping.",
            failMessage:
              "createWorld() wrapped or replaced the provided services.",
          }
        ),
        evaluateRule(getRuleOrThrow("FACADE-STORE-1"), hasFullCompositeStoreSurface, {
          passMessage:
            "In-memory world store exposes lineage/governance store methods plus the seal transaction seam.",
          failMessage:
            "In-memory world store is missing composite lineage/governance store capabilities.",
        }),
        evaluateRule(getRuleOrThrow("FACADE-STORE-3"), persistedLineageAndGovernance, {
          passMessage:
            "Full seal commit persisted lineage records, governance records, and lineage attempts together.",
          failMessage:
            "Full seal commit did not persist the expected lineage + governance + attempt records.",
        }),
        evaluateRule(getRuleOrThrow("FACADE-STORE-7"), hasSplitStoreFactory, {
          passMessage:
            "createInMemoryWorldStore() returns a composite split-native store surface with runInSealTransaction() only.",
          failMessage:
            "createInMemoryWorldStore() is missing composite store methods.",
        }),
        evaluateRule(
          getRuleOrThrow("FACADE-STORE-3"),
          lineageCommitted &&
            governancePersisted &&
            attemptCommitted &&
            persistedLineageAndGovernance,
          {
            passMessage:
              "Current seal path persists lineage, governance, and attempt records through the transaction seam.",
            failMessage:
              "Current seal path did not persist the expected lineage + governance + attempt records through the transaction seam.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-FACTORY-3"),
          world.store === store &&
            world.lineage === lineage &&
            world.governance === governance,
          {
            passMessage:
              "createWorld() preserves the caller-owned same-store assembly precondition.",
            failMessage:
              "createWorld() did not preserve the caller-owned same-store assembly precondition.",
            evidence: [
              noteEvidence(
                "Generic mismatch detection is still not implemented; this rule remains a caller-owned wiring precondition."
              ),
            ],
          }
        ),
        evaluateRule(getRuleOrThrow("FACADE-SDK-1"), sdkHasGovernedTypeExport, {
          passMessage:
            "SDK exposes the hard-cut governed world type surface without the legacy store contract.",
          failMessage:
            "SDK is still exposing the wrong world type surface after the hard cut.",
        }),
        evaluateRule(
          getRuleOrThrow("FACADE-SDK-2"),
          sdkHasGovernedRuntimeExports && topLevelWorldHasGovernedExports,
          {
            passMessage:
              "SDK and top-level world both expose the canonical governed factory surface.",
            failMessage:
              "SDK or top-level world is missing the hard-cut governed factory surface.",
          }
        ),
      ]);

      expect(readyToUseWorld).toBe(true);
      expect(hasSplitStoreFactory).toBe(true);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.STORE_ATOMICITY,
      "runInSealTransaction() is all-or-nothing and does not leave partial lineage writes behind on governance write failure."
    ),
    async () => {
      const harness = createFacadeHarness();
      const { world } = await sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(harness);
      const activeBranch = await harness.lineage.getActiveBranch();

      const lineageCommit = await harness.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: world!.worldId,
        branchId: activeBranch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 20,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      });
      const governanceCommit = await harness.governance.finalize(
        proposal,
        lineageCommit,
        21
      );

      const internals = harness.store as unknown as {
        driver: {
          governance: { putProposal: (proposal: unknown) => Promise<void> };
        };
      };
      const failure = new Error("simulated governance write failure");
      const proposalWriter = vi
        .spyOn(internals.driver.governance, "putProposal")
        .mockImplementation(async () => {
          throw failure;
        });

      await expect(
        harness.store.runInSealTransaction(async (tx) => {
          await tx.commitPrepared(lineageCommit);
          await tx.putProposal(governanceCommit.proposal);
          await tx.putDecisionRecord(governanceCommit.decisionRecord);
        })
      ).rejects.toThrow(failure);

      const rolledBack =
        (await harness.store.getWorld(lineageCommit.worldId)) == null &&
        (await harness.store.getAttempts(lineageCommit.worldId)).length === 0 &&
        (await harness.store.getProposal(proposal.proposalId))?.status ===
          "executing";

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("FACADE-STORE-2"), rolledBack, {
          passMessage:
            "runInSealTransaction() rolled back lineage writes when governance persistence failed.",
          failMessage:
            "runInSealTransaction() left partial lineage state behind after governance persistence failed.",
        }),
      ]);

      expect(proposalWriter).toHaveBeenCalledTimes(1);
      expect(rolledBack).toBe(true);
    }
  );
});

async function resultingWorldId(
  harness: ReturnType<typeof createFacadeHarness>
): Promise<string> {
  const branch = await harness.lineage.getActiveBranch();
  if (!branch.head) {
    throw new Error("expected active branch head after governed seal");
  }
  return branch.head;
}
