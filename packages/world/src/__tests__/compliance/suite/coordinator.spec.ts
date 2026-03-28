import { describe, expect, it, vi } from "vitest";
import { createGovernanceEventDispatcher } from "@manifesto-ai/governance";
import { FacadeCasMismatchError } from "../../../facade/internal/errors.js";
import { createWorld } from "../../../facade.js";
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
      "Coordinator normal path preserves prepare -> finalize -> commit -> dispatch ordering."
    ),
    () => {
      const harness = createFacadeHarness();
      const { world } = sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = createExecutingProposal(harness);
      const order: string[] = [];

      const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
      const originalFinalize = harness.governance.finalize.bind(harness.governance);
      const originalCommit = harness.store.commitSeal.bind(harness.store);
      const dispatcher = createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event): void {
            order.push(`event:${event.type}`);
            harness.events.push(event);
          },
        },
        now: () => 1000,
      });

      vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation((input) => {
        order.push("prepare");
        return originalPrepare(input);
      });
      vi.spyOn(harness.governance, "finalize").mockImplementation((...args) => {
        order.push("finalize");
        return originalFinalize(...args);
      });
      vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet) => {
        order.push("commit");
        return originalCommit(writeSet);
      });

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: dispatcher,
      });

      const result = governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: harness.lineage.getActiveBranch().id,
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
            passMessage: "Coordinator prepares lineage before governance finalization.",
            failMessage: "Coordinator finalized governance before lineage prepare.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-2"),
          order.indexOf("finalize") < order.indexOf("commit"),
          {
            passMessage: "Coordinator finalized governance before commitSeal().",
            failMessage: "Coordinator committed before governance finalization.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-3"),
          order.indexOf("commit") < order.findIndex((entry) => entry.startsWith("event:")),
          {
            passMessage: "Coordinator emits events only after commitSeal() succeeds.",
            failMessage: "Coordinator emitted events before commitSeal() completed.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-11"),
          result.kind === "sealed",
          {
            passMessage: "Coordinator completed the full prepare -> finalize -> commit path successfully.",
            failMessage: "Coordinator did not complete the expected full seal path.",
          },
        ),
      ]);

      expect(result.kind).toBe("sealed");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_REJECTION,
      "Coordinator rejection path routes through finalizeOnSealRejection and governance-only commit."
    ),
    () => {
      const harness = createFacadeHarness();
      const { world } = sealStandaloneGenesis(harness);
      const { proposal } = createExecutingProposal(harness);
      const order: string[] = [];

      const originalPrepare = harness.lineage.prepareSealNext.bind(harness.lineage);
      const originalFinalizeOnSealRejection = harness.governance.finalizeOnSealRejection.bind(harness.governance);
      const originalCommit = harness.store.commitSeal.bind(harness.store);
      const dispatcher = createGovernanceEventDispatcher({
        service: harness.governance,
        sink: {
          emit(event): void {
            order.push(`event:${event.type}`);
            harness.events.push(event);
          },
        },
        now: () => 1000,
      });

      vi.spyOn(harness.lineage, "prepareSealNext").mockImplementation((input) => {
        order.push("prepare");
        return originalPrepare(input);
      });
      vi.spyOn(harness.governance, "finalizeOnSealRejection").mockImplementation((...args) => {
        order.push("finalizeRejected");
        return originalFinalizeOnSealRejection(...args);
      });
      vi.spyOn(harness.store, "commitSeal").mockImplementation((writeSet) => {
        order.push("commit");
        return originalCommit(writeSet);
      });

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: dispatcher,
      });

      const result = governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: harness.lineage.getActiveBranch().id,
          terminalSnapshot: createSnapshot({ count: 1 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: proposal.decisionId,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-4"),
          result.kind === "sealRejected"
            && order.indexOf("prepare") < order.indexOf("finalizeRejected")
            && order.indexOf("finalizeRejected") < order.indexOf("commit")
            && order.indexOf("commit") < order.findIndex((entry) => entry === "event:execution:seal_rejected"),
          {
            passMessage: "Coordinator routed seal rejection through finalizeOnSealRejection(), governance-only commit, then post-commit event emission.",
            failMessage: "Coordinator rejection path did not follow prepare -> finalizeOnSealRejection -> commit -> event ordering.",
          },
        ),
      ]);

      expect(result.kind).toBe("sealRejected");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_GENESIS,
      "Coordinator distinguishes standalone genesis from governed genesis."
    ),
    () => {
      const standaloneHarness = createFacadeHarness();
      const standaloneCommit = vi.spyOn(standaloneHarness.store, "commitSeal");

      const standalone = standaloneHarness.world.coordinator.sealGenesis({
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
      governedHarness.store.putProposal(governedProposal);
      governedHarness.store.putDecisionRecord({
        decisionId: "dec-governed-genesis",
        proposalId: governedProposal.proposalId,
        authorityId: governedProposal.authorityId,
        decision: { kind: "approved" as const },
        decidedAt: 2,
      });
      const governedCommit = vi.spyOn(governedHarness.store, "commitSeal");
      const governedDispatcher = createGovernanceEventDispatcher({
        service: governedHarness.governance,
        sink: {
          emit(event): void {
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
      });

      const governed = governedWorld.coordinator.sealGenesis({
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
            passMessage: "Governed genesis uses the full prepare -> finalize -> commitSeal path.",
            failMessage: "Governed genesis did not use the full governed commit path.",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-7"),
          standalone.kind === "sealed" && standaloneCommit.mock.calls.length === 0,
          {
            passMessage: "Standalone genesis delegates directly to lineage without commitSeal().",
            failMessage: "Standalone genesis unexpectedly used commitSeal().",
          },
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-8"),
          standaloneHarness.events.length === 0,
          {
            passMessage: "Standalone genesis avoids governance records and event emission.",
            failMessage: "Standalone genesis leaked governance commit behavior.",
          },
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.COORDINATOR_RETRY,
      "Coordinator retries from prepare on CAS mismatch."
    ),
    () => {
      const harness = createFacadeHarness();
      const { world } = sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = createExecutingProposal(harness);
      const prepareSpy = vi.spyOn(harness.lineage, "prepareSealNext");
      const originalCommit = harness.store.commitSeal.bind(harness.store);
      const commitSpy = vi.spyOn(harness.store, "commitSeal");

      commitSpy
        .mockImplementationOnce(() => {
          throw new FacadeCasMismatchError("simulated CAS mismatch");
        })
        .mockImplementation((writeSet) => originalCommit(writeSet));

      const governedWorld = createWorld({
        store: harness.store,
        lineage: harness.lineage,
        governance: harness.governance,
        eventDispatcher: createGovernanceEventDispatcher({
          service: harness.governance,
          sink: {
            emit(event): void {
              harness.events.push(event);
            },
          },
          now: () => 1000,
        }),
      });

      const result = governedWorld.coordinator.sealNext({
        executingProposal: proposal,
        completedAt: 20,
        sealInput: {
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: harness.lineage.getActiveBranch().id,
          terminalSnapshot: createSnapshot({ count: 2 }),
          createdAt: 19,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-COORD-9"),
          result.kind === "sealed" && prepareSpy.mock.calls.length === 2 && commitSpy.mock.calls.length === 2,
          {
            passMessage: "Coordinator retries from prepare after CAS mismatch.",
            failMessage: "Coordinator did not restart the seal loop from prepare after CAS mismatch.",
          },
        ),
      ]);

      expect(result.kind).toBe("sealed");
    }
  );
});
