import { describe, expect, it, vi } from "vitest";
import {
  createGovernanceEventDispatcher,
  createWorld,
  type GovernanceEvent,
} from "../../../index.js";
import { FacadeCasMismatchError } from "../../../facade/internal/errors.js";
import {
  createFacadeHarness,
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
} from "../../facade/helpers.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { evaluateRule, expectAllCompliance } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

describe("WFCTS Coordinator Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_NORMAL,
      "Coordinator normal path preserves prepare -> finalize -> transaction -> dispatch ordering."
    ),
    async () => {
      const harness = createFacadeHarness();
      const { world } = await sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(harness);
      const branch = await harness.lineage.getActiveBranch();
      const order: string[] = [];

      const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
      const originalFinalize = harness.governance.finalize.bind(harness.governance);
      const originalRunInSealTransaction =
        harness.store.runInSealTransaction.bind(harness.store);
      const dispatcher = createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event: GovernanceEvent): void {
            order.push(`event:${event.type}`);
            harness.events.push(event);
          },
        },
        now: () => 1000,
      });
      const originalEmitSealCompleted =
        dispatcher.emitSealCompleted.bind(dispatcher);

      vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation(async (input) => {
        order.push("prepare");
        return await originalPrepare(input);
      });
      vi.spyOn(harness.governance, "finalize").mockImplementation(async (...args) => {
        order.push("finalize");
        return await originalFinalize(...args);
      });
      const lineageOnlyCommitSpy = vi.spyOn(harness.lineage, "commitPrepared");
      vi.spyOn(harness.store, "runInSealTransaction").mockImplementation(
        async (work) => {
          order.push("commit");
          return await originalRunInSealTransaction(work);
        }
      );
      const dispatcherSpy = vi
        .spyOn(dispatcher, "emitSealCompleted")
        .mockImplementation((...args) => {
          order.push("dispatch");
          return originalEmitSealCompleted(...args);
        });

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: dispatcher,
        executor: harness.executor,
      });

      const result = await governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: branch.id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-1"),
          order.indexOf("prepare") < order.indexOf("finalize"),
          {
            passMessage:
              "Coordinator prepares lineage before governance finalization.",
            failMessage: "Coordinator finalized governance before lineage prepare.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-2"),
          order.indexOf("finalize") < order.indexOf("commit"),
          {
            passMessage:
              "Coordinator finalized governance before the seal transaction.",
            failMessage: "Coordinator committed before governance finalization.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-3"),
          order.indexOf("commit") <
            order.findIndex((entry) => entry.startsWith("event:")),
          {
            passMessage:
              "Coordinator emits events only after the seal transaction succeeds.",
            failMessage:
              "Coordinator emitted events before the seal transaction completed.",
          }
        ),
        evaluateRule(getRuleOrThrow("FACADE-COORD-11"), result.kind === "sealed", {
          passMessage:
            "Coordinator completed the full prepare -> finalize -> transaction path successfully.",
          failMessage:
            "Coordinator did not complete the expected full seal path.",
        }),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-5"),
          lineageOnlyCommitSpy.mock.calls.length === 0,
          {
            passMessage:
              "Governed seal path does not fall back to lineage.commitPrepared().",
            failMessage:
              "Governed seal path unexpectedly called lineage.commitPrepared().",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-EVT-1"),
          order.indexOf("commit") < order.indexOf("dispatch"),
          {
            passMessage:
              "Dispatcher activation occurs only after the seal transaction succeeds.",
            failMessage:
              "Dispatcher activation happened before the seal transaction succeeded.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-EVT-2"),
          dispatcherSpy.mock.calls.length === 1,
          {
            passMessage:
              "Coordinator called emitSealCompleted() exactly once after a successful commit.",
            failMessage:
              "Coordinator did not call emitSealCompleted() exactly once after a successful commit.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-EVT-5"),
          order.indexOf("prepare") < order.indexOf("dispatch") &&
            order.indexOf("finalize") < order.indexOf("dispatch"),
          {
            passMessage:
              "Dispatcher was not called during prepare/finalize steps.",
            failMessage: "Dispatcher was invoked before the post-commit phase.",
          }
        ),
      ]);

      expect(result.kind).toBe("sealed");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_CURRENT_SURFACE,
      "Coordinator current typed surface persists both lineage and governance writes through the transaction seam."
    ),
    async () => {
      const harness = createFacadeHarness();
      const { world } = await sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(harness);
      const branch = await harness.lineage.getActiveBranch();
      const originalRunInSealTransaction =
        harness.store.runInSealTransaction.bind(harness.store);
      let lineageCommitted = false;
      let governancePersisted = false;
      const dispatcher = createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event: GovernanceEvent): void {
            harness.events.push(event);
          },
        },
        now: () => 1000,
      });

      vi.spyOn(harness.store, "runInSealTransaction").mockImplementation(
        async (work) =>
          originalRunInSealTransaction(async (tx) =>
            work({
              async commitPrepared(prepared) {
                lineageCommitted = true;
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

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: dispatcher,
        executor: harness.executor,
      });

      const result = await governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: branch.id,
          terminalSnapshot: createSnapshot({ count: 3 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });
      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-STORE-3"),
          result.kind === "sealed" && lineageCommitted && governancePersisted,
          {
            passMessage:
              "Coordinator persisted both lineage and governance writes through the transaction seam.",
            failMessage:
              "Coordinator did not persist both lineage and governance writes through the transaction seam.",
          }
        ),
      ]);

      expect(result.kind).toBe("sealed");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_GENESIS,
      "Coordinator distinguishes standalone genesis from governed genesis."
    ),
    async () => {
      const standaloneHarness = createFacadeHarness();
      const standaloneCommit = vi.spyOn(
        standaloneHarness.store,
        "runInSealTransaction"
      );

      const standalone = await standaloneHarness.world.coordinator.sealGenesis({
        kind: "standalone",
        sealInput: {
          schemaHash: "wfcts-schema",
          terminalSnapshot: createSnapshot({ count: 1 }),
          createdAt: 1,
        },
      });

      const governedHarness = createFacadeHarness();
      const governedProposal = {
        proposalId: "prop-governed-genesis",
        baseWorld: "bootstrap-base",
        branchId: "bootstrap-branch",
        actorId: "actor-bootstrap",
        authorityId: "auth-bootstrap",
        intent: {
          type: "demo.bootstrap",
          intentId: "intent-bootstrap",
        },
        status: "executing" as const,
        executionKey: "bootstrap-key",
        submittedAt: 1,
        decidedAt: 2,
        decisionId: "dec-governed-genesis",
        epoch: 0,
      };
      await governedHarness.store.putProposal(governedProposal);
      await governedHarness.store.putDecisionRecord({
        decisionId: "dec-governed-genesis",
        proposalId: governedProposal.proposalId,
        authorityId: governedProposal.authorityId,
        decision: { kind: "approved" as const },
        decidedAt: 2,
      });
      const governedCommit = vi.spyOn(
        governedHarness.store,
        "runInSealTransaction"
      );
      const governedDispatcher = createGovernanceEventDispatcher({
        service: governedHarness.governance,
        sink: {
          emit(event: GovernanceEvent): void {
            governedHarness.events.push(event);
          },
        },
        now: () => 1000,
      });
      const governedWorld = createWorld({
        store: governedHarness.store,
        lineage: governedHarness.lineage,
        governance: governedHarness.governance,
        eventDispatcher: governedDispatcher,
        executor: governedHarness.executor,
      });

      const governed = await governedWorld.coordinator.sealGenesis({
        kind: "governed",
        executingProposal: governedProposal,
        completedAt: 3,
        sealInput: {
          schemaHash: "wfcts-schema",
          terminalSnapshot: createSnapshot({ count: 1 }),
          createdAt: 1,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-6"),
          governed.kind === "sealed" && governedCommit.mock.calls.length === 1,
          {
            passMessage:
              "Governed genesis uses the full prepare -> finalize -> transaction path.",
            failMessage:
              "Governed genesis did not use the full governed commit path.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-7"),
          standalone.kind === "sealed" && standaloneCommit.mock.calls.length === 0,
          {
            passMessage:
              "Standalone genesis delegates directly to lineage without a governed transaction.",
            failMessage:
              "Standalone genesis unexpectedly used a governed transaction.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-8"),
          standaloneHarness.events.length === 0,
          {
            passMessage:
              "Standalone genesis avoids governance records and event emission.",
            failMessage:
              "Standalone genesis leaked governance commit behavior.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_RETRY,
      "Coordinator retries from prepare on CAS mismatch."
    ),
    async () => {
      const harness = createFacadeHarness();
      const { world } = await sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(harness);
      const branch = await harness.lineage.getActiveBranch();
      const prepareSpy = vi.spyOn(harness.lineage, "prepareSealNext");
      const originalRunInSealTransaction =
        harness.store.runInSealTransaction.bind(harness.store);
      const commitSpy = vi.spyOn(harness.store, "runInSealTransaction");

      commitSpy
        .mockImplementationOnce(async () => {
          throw new FacadeCasMismatchError("simulated CAS mismatch");
        })
        .mockImplementation(async (work) => originalRunInSealTransaction(work));

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: createGovernanceEventDispatcher({
          service: harness.governance,
          sink: {
            emit(event: GovernanceEvent): void {
              harness.events.push(event);
            },
          },
          now: () => 1000,
        }),
        executor: harness.executor,
      });

      const result = await governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: branch.id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-9"),
          result.kind === "sealed" &&
            prepareSpy.mock.calls.length === 2 &&
            commitSpy.mock.calls.length === 2,
          {
            passMessage:
              "Coordinator retries from prepare after CAS mismatch.",
            failMessage:
              "Coordinator did not restart the seal loop from prepare after CAS mismatch.",
          }
        ),
      ]);

      expect(result.kind).toBe("sealed");
    }
  );
});
