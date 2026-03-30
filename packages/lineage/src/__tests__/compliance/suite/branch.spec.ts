import { describe, expect, it } from "vitest";
import { caseTitle, LCTS_CASES } from "../lcts-coverage.js";
import { evaluateRule, expectAllCompliance, noteEvidence } from "../lcts-assertions.js";
import { getRuleOrThrow } from "../lcts-rules.js";
import { createBootstrappedLineage, createTestSnapshot, snapshotStoreState } from "../helpers.js";

describe("LCTS Branch Suite", () => {
  it(
    caseTitle(
      LCTS_CASES.PREPARE_PURITY,
      "prepareSealGenesis() and prepareSealNext() are deterministic read-only preparations."
    ),
    async () => {
      const { store, service, genesis } = await createBootstrappedLineage();
      const before = await snapshotStoreState(store);

      const preparedA = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const preparedB = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const after = await snapshotStoreState(store);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-SEAL-PURE-1"), before === after && JSON.stringify(preparedA) === JSON.stringify(preparedB), {
          passMessage: "prepareSealNext() is deterministic and read-only.",
          failMessage: "prepareSealNext() mutated the store or returned unstable prepared output.",
          evidence: [noteEvidence("Compared store state before/after prepare and repeated the same prepare call against unchanged store state.")],
        }),
      ]);

      expect(before).toBe(after);
      expect(preparedA).toEqual(preparedB);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.BRANCH_CAS,
      "Branch CAS guards head, tip, and epoch together and rejects stale prepared commits atomically."
    ),
    async () => {
      const { service, store, genesis } = await createBootstrappedLineage();
      const stale = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const winner = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 3 }),
        createdAt: 3,
      });

      await service.commitPrepared(winner);

      const beforeHead = await store.getBranchHead(genesis.branchId);
      const beforeTip = await store.getBranchTip(genesis.branchId);
      const beforeEpoch = await store.getBranchEpoch(genesis.branchId);

      await expect(service.commitPrepared(stale)).rejects.toThrow(/CAS mismatch/);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-STORE-4"), (await store.getBranchHead(genesis.branchId)) === beforeHead
          && (await store.getBranchTip(genesis.branchId)) === beforeTip
          && (await store.getBranchEpoch(genesis.branchId)) === beforeEpoch, {
          passMessage: "Stale prepared commits fail CAS without partially mutating branch state.",
          failMessage: "CAS mismatch mutated branch head, tip, or epoch.",
          evidence: [noteEvidence("Committed one prepared next seal, then attempted to commit a second stale prepared seal from the same branch state.")],
        }),
      ]);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.HEAD_TIP_SEMANTICS,
      "Completed seals advance head and tip; failed seals advance tip only."
    ),
    async () => {
      const { service, genesis } = await createBootstrappedLineage();
      const success = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      await service.commitPrepared(success);

      const afterSuccess = await service.getActiveBranch();
      const failed = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: success.worldId,
        branchId: success.branchId,
        terminalSnapshot: createTestSnapshot(
          { count: 3 },
          {
            system: {
              status: "idle",
              lastError: {
                code: "ERR",
                message: "boom",
                source: { actionId: "a", nodePath: "/x" },
                timestamp: 0,
              },
              pendingRequirements: [],
              currentAction: null,
            },
          }
        ),
        createdAt: 3,
      });
      await service.commitPrepared(failed);

      const afterFailure = await service.getActiveBranch();

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-HEAD-ADV-1"), afterSuccess.head === success.worldId && afterFailure.head === success.worldId, {
          passMessage: "Head advances only for completed seals.",
          failMessage: "Failed seal advanced the branch head.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-TIP-1"), afterSuccess.tip === success.worldId, {
          passMessage: "Completed seal advanced the branch tip.",
          failMessage: "Completed seal did not advance the branch tip.",
        }),
        evaluateRule(getRuleOrThrow("MRKL-TIP-2"), afterFailure.tip === failed.worldId && afterFailure.head === success.worldId, {
          passMessage: "Failed seal advanced tip while keeping head unchanged.",
          failMessage: "Failed seal did not preserve head/tip separation.",
          evidence: [noteEvidence("Committed one completed seal, then one failed seal on the same branch.")],
        }),
      ]);

      expect(afterSuccess.headAdvancedAt).toBe(2);
      expect(afterFailure.headAdvancedAt).toBe(2);
      expect(afterFailure.epoch).toBe(1);
    }
  );

  it(
    caseTitle(
      LCTS_CASES.LATEST_HEAD_SELECTION,
      "Latest head selection follows branch headAdvancedAt chronology."
    ),
    async () => {
      const { service, genesis } = await createBootstrappedLineage();
      const mainAdvance = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      await service.commitPrepared(mainAdvance);

      const forkBranchId = await service.createBranch("fork", genesis.worldId);
      await service.switchActiveBranch(forkBranchId);
      const forkAdvance = await service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: forkBranchId,
        terminalSnapshot: createTestSnapshot({ count: 4 }),
        createdAt: 5,
      });
      await service.commitPrepared(forkAdvance);

      const latestHead = await service.getLatestHead();

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("MRKL-HEAD-5"), latestHead?.worldId === forkAdvance.worldId && latestHead?.createdAt === 5, {
          passMessage: "getLatestHead() uses branch-local headAdvancedAt chronology.",
          failMessage: "getLatestHead() did not follow headAdvancedAt ordering.",
          evidence: [noteEvidence("Advanced the main branch at createdAt=2 and a forked branch at createdAt=5.")],
        }),
      ]);

      expect(latestHead?.worldId).toBe(forkAdvance.worldId);
      expect(latestHead?.createdAt).toBe(5);
    }
  );
});
