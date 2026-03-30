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
    () => {
      const { store, service, genesis } = createBootstrappedLineage();
      const before = snapshotStoreState(store);

      const preparedA = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const preparedB = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const after = snapshotStoreState(store);

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
    () => {
      const { service, store, genesis } = createBootstrappedLineage();
      const stale = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      const winner = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 3 }),
        createdAt: 3,
      });

      service.commitPrepared(winner);

      const beforeHead = store.getBranchHead(genesis.branchId);
      const beforeTip = store.getBranchTip(genesis.branchId);
      const beforeEpoch = store.getBranchEpoch(genesis.branchId);

      expect(() => service.commitPrepared(stale)).toThrow(/CAS mismatch/);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("LIN-STORE-4"), store.getBranchHead(genesis.branchId) === beforeHead
          && store.getBranchTip(genesis.branchId) === beforeTip
          && store.getBranchEpoch(genesis.branchId) === beforeEpoch, {
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
    () => {
      const { service, genesis } = createBootstrappedLineage();
      const success = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      service.commitPrepared(success);

      const afterSuccess = service.getActiveBranch();
      const failed = service.prepareSealNext({
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
              errors: [],
              currentAction: null,
            },
          }
        ),
        createdAt: 3,
      });
      service.commitPrepared(failed);

      const afterFailure = service.getActiveBranch();

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
    () => {
      const { service, genesis } = createBootstrappedLineage();
      const mainAdvance = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: genesis.branchId,
        terminalSnapshot: createTestSnapshot({ count: 2 }),
        createdAt: 2,
      });
      service.commitPrepared(mainAdvance);

      const forkBranchId = service.createBranch("fork", genesis.worldId);
      service.switchActiveBranch(forkBranchId);
      const forkAdvance = service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: genesis.worldId,
        branchId: forkBranchId,
        terminalSnapshot: createTestSnapshot({ count: 4 }),
        createdAt: 5,
      });
      service.commitPrepared(forkAdvance);

      const latestHead = service.getLatestHead();

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
