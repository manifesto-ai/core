import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryGovernanceStore,
  type GovernanceEvent,
} from "../../../index.js";
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";
import { createGovernanceComplianceAdapter } from "../gcts-adapter.js";
import {
  evaluateRule,
  expectAllCompliance,
  noteEvidence,
} from "../gcts-assertions.js";
import { caseTitle, GCTS_CASES } from "../gcts-coverage.js";
import { getRuleOrThrow } from "../gcts-rules.js";

function createSnapshot(
  data: Record<string, unknown>,
  overrides?: Partial<Snapshot>
): Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      pendingRequirements: [],
      errors: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
    ...overrides,
  };
}

function bootstrapGovernance() {
  const lineageStore = createInMemoryLineageStore();
  const lineageService = createLineageService(lineageStore);
  const genesis = lineageService.prepareSealGenesis({
    schemaHash: "schema-hash",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  });
  lineageService.commitPrepared(genesis);

  const governanceStore = createInMemoryGovernanceStore();
  const governanceService = createGovernanceService(governanceStore, {
    lineageService,
  });

  return {
    lineageStore,
    lineageService,
    governanceStore,
    governanceService,
    genesis,
  };
}

describe("GCTS Events Suite", () => {
  const adapter = createGovernanceComplianceAdapter();

  it(
    caseTitle(
      GCTS_CASES.EVENTS_DISPATCHER_SURFACE,
      "Governance exports a facade-compatible dispatcher factory whose public surface is emitSealCompleted() only."
    ),
    () => {
      const exported = adapter.exports();
      const createDispatcher = exported.createGovernanceEventDispatcher;
      const ctx = bootstrapGovernance();
      const dispatcher = createGovernanceEventDispatcher({
        service: ctx.governanceService,
      });
      const publicKeys = Object.keys(dispatcher).sort();

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("GOV-EVT-DISP-1"),
          publicKeys.length === 1 && publicKeys[0] === "emitSealCompleted",
          {
            passMessage: "Governance dispatcher matches the facade-owned seam with a single emitSealCompleted() method.",
            failMessage: "Governance dispatcher surface drifted from the facade-owned seam.",
            evidence: [noteEvidence("Inspected the dispatcher instance produced by the public factory and enumerated its public keys.")],
          }
        ),
        evaluateRule(getRuleOrThrow("GOV-EVT-DISP-2"), typeof createDispatcher === "function", {
          passMessage: "Governance exports a public createGovernanceEventDispatcher() factory.",
          failMessage: "Governance is missing the public dispatcher factory required by the facade seam.",
          evidence: [noteEvidence("Verified createGovernanceEventDispatcher is present on the package public exports.")],
        }),
      ]);

      expect(publicKeys).toEqual(["emitSealCompleted"]);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.EVENTS_POST_COMMIT_OUTCOMES,
      "Governance emits execution outcome events only through the explicit post-commit dispatcher path."
    ),
    () => {
      const successCtx = bootstrapGovernance();
      const successEvents: GovernanceEvent[] = [];
      const successProposal = successCtx.governanceService.createProposal({
        baseWorld: successCtx.genesis.worldId,
        branchId: successCtx.genesis.branchId,
        actorId: "actor-20",
        authorityId: "auth-20",
        intent: { type: "demo.events.success", intentId: "intent-20" },
        executionKey: "key-20",
        submittedAt: 20,
        epoch: successCtx.lineageService.getActiveBranch().epoch,
      });
      const successApproved = successCtx.governanceService.prepareAuthorityResult(
        { ...successProposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 21 }
      );
      if (!successApproved.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const successExecuting = { ...successApproved.proposal, status: "executing" as const };
      successCtx.governanceStore.putProposal(successExecuting);
      successCtx.governanceStore.putDecisionRecord(successApproved.decisionRecord);
      const successCommit = successCtx.lineageService.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: successCtx.genesis.worldId,
        branchId: successCtx.genesis.branchId,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 22,
        proposalRef: successExecuting.proposalId,
        decisionRef: successApproved.decisionRecord.decisionId,
      });
      const successGovernanceCommit = successCtx.governanceService.finalize(successExecuting, successCommit, 23);
      const successDispatcher = createGovernanceEventDispatcher({
        service: successCtx.governanceService,
        sink: {
          emit(event): void {
            successEvents.push(event);
          },
        },
        now: () => 500,
      });

      const failedCtx = bootstrapGovernance();
      const failedEvents: GovernanceEvent[] = [];
      const failedProposal = failedCtx.governanceService.createProposal({
        baseWorld: failedCtx.genesis.worldId,
        branchId: failedCtx.genesis.branchId,
        actorId: "actor-21",
        authorityId: "auth-21",
        intent: { type: "demo.events.failed", intentId: "intent-21" },
        executionKey: "key-21",
        submittedAt: 30,
        epoch: failedCtx.lineageService.getActiveBranch().epoch,
      });
      const failedApproved = failedCtx.governanceService.prepareAuthorityResult(
        { ...failedProposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 31 }
      );
      if (!failedApproved.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const failedExecuting = { ...failedApproved.proposal, status: "executing" as const };
      failedCtx.governanceStore.putProposal(failedExecuting);
      failedCtx.governanceStore.putDecisionRecord(failedApproved.decisionRecord);
      const failedCommit = failedCtx.lineageService.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: failedCtx.genesis.worldId,
        branchId: failedCtx.genesis.branchId,
        terminalSnapshot: createSnapshot(
          { count: 99 },
          {
            system: {
              status: "idle",
              lastError: {
                code: "ERR-POST-COMMIT",
                message: "boom",
                source: { actionId: "action-21", nodePath: "root" },
                timestamp: 32,
              },
              errors: [],
              pendingRequirements: [],
              currentAction: null,
            },
          }
        ),
        createdAt: 32,
        proposalRef: failedExecuting.proposalId,
        decisionRef: failedApproved.decisionRecord.decisionId,
      });
      const failedGovernanceCommit = failedCtx.governanceService.finalize(failedExecuting, failedCommit, 33);
      const failedDispatcher = createGovernanceEventDispatcher({
        service: failedCtx.governanceService,
        sink: {
          emit(event): void {
            failedEvents.push(event);
          },
        },
        now: () => 600,
      });

      const noPreDispatchEvents = successEvents.length === 0 && failedEvents.length === 0;
      successDispatcher.emitSealCompleted(successGovernanceCommit, successCommit);
      failedDispatcher.emitSealCompleted(failedGovernanceCommit, failedCommit);

      const successOutcomeOk = successEvents.length === 2
        && successEvents[0]?.type === "world:created"
        && successEvents[1]?.type === "execution:completed";
      const failedOutcomeOk = failedEvents.length === 2
        && failedEvents[0]?.type === "world:created"
        && failedEvents[1]?.type === "execution:failed";

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("GOV-EVT-DISP-3"),
          noPreDispatchEvents,
          {
            passMessage: "Governance emits nothing during proposal evaluation/finalization; events flow only through the explicit post-commit dispatcher seam.",
            failMessage: "Governance emitted events before the explicit post-commit dispatcher path was invoked.",
            evidence: [noteEvidence("Observed empty event sinks through createProposal(), prepareAuthorityResult(), and finalize() until emitSealCompleted() was called.")],
          }
        ),
        evaluateRule(getRuleOrThrow("GOV-EXEC-EVT-1"), successOutcomeOk, {
          passMessage: "Completed governed seals emit world:created followed by execution:completed.",
          failMessage: "Completed governed seals did not emit the expected post-commit execution:completed sequence.",
          evidence: [noteEvidence("Ran a completed terminal seal through the dispatcher and verified ordered post-commit events.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-EXEC-EVT-2"), failedOutcomeOk, {
          passMessage: "Failed governed seals emit world:created followed by execution:failed while still sealing the failed World.",
          failMessage: "Failed governed seals did not emit the expected post-commit execution:failed sequence.",
          evidence: [noteEvidence("Ran a failed terminal seal through the dispatcher and verified the failed World still produced post-commit events.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-EXEC-EVT-3"), successOutcomeOk && failedOutcomeOk, {
          passMessage: "Execution result events are emitted only on the explicit post-commit dispatcher path.",
          failMessage: "Execution result events were not consistently emitted through the explicit post-commit dispatcher path.",
          evidence: [noteEvidence("Both completed and failed outcomes remained silent before emitSealCompleted(), then emitted ordered post-commit events.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-EXEC-EVT-4"), noPreDispatchEvents, {
          passMessage: "Governance does not emit execution result events during execution or finalize().",
          failMessage: "Governance emitted execution result events before the terminal post-commit dispatcher path.",
          evidence: [noteEvidence("No governance events were observed while proposals moved through execution-stage preparation/finalization.")],
        }),
      ]);

      expect(successEvents).toEqual([
        {
          type: "world:created",
          timestamp: 500,
          world: successCommit.world,
          from: successGovernanceCommit.proposal.baseWorld,
          proposalId: successGovernanceCommit.proposal.proposalId,
          outcome: "completed",
        },
        {
          type: "execution:completed",
          timestamp: 500,
          proposalId: successGovernanceCommit.proposal.proposalId,
          executionKey: successGovernanceCommit.proposal.executionKey,
          resultWorld: successGovernanceCommit.proposal.resultWorld,
        },
      ]);
      expect(failedEvents).toEqual([
        {
          type: "world:created",
          timestamp: 600,
          world: failedCommit.world,
          from: failedGovernanceCommit.proposal.baseWorld,
          proposalId: failedGovernanceCommit.proposal.proposalId,
          outcome: "failed",
        },
        {
          type: "execution:failed",
          timestamp: 600,
          proposalId: failedGovernanceCommit.proposal.proposalId,
          executionKey: failedGovernanceCommit.proposal.executionKey,
          resultWorld: failedGovernanceCommit.proposal.resultWorld,
          error: {
            summary: "Execution failed with 1 error(s)",
            currentError: {
              code: "ERR-POST-COMMIT",
              message: "boom",
              source: { actionId: "action-21", nodePath: "root" },
              timestamp: 32,
            },
          },
        },
      ]);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.EVENTS_FAILED_PAYLOAD,
      "execution:failed payloads expose currentError and pendingRequirements without accumulated error history."
    ),
    () => {
      const ctx = bootstrapGovernance();
      const events: GovernanceEvent[] = [];
      const proposal = ctx.governanceService.createProposal({
        baseWorld: ctx.genesis.worldId,
        branchId: ctx.genesis.branchId,
        actorId: "actor-22",
        authorityId: "auth-22",
        intent: { type: "demo.events.payload", intentId: "intent-22" },
        executionKey: "key-22",
        submittedAt: 40,
        epoch: ctx.lineageService.getActiveBranch().epoch,
      });
      const approved = ctx.governanceService.prepareAuthorityResult(
        { ...proposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 41 }
      );
      if (!approved.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const executing = { ...approved.proposal, status: "executing" as const };
      ctx.governanceStore.putProposal(executing);
      ctx.governanceStore.putDecisionRecord(approved.decisionRecord);
      const lineageCommit = ctx.lineageService.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: ctx.genesis.worldId,
        branchId: ctx.genesis.branchId,
        terminalSnapshot: createSnapshot(
          { count: 100 },
          {
            system: {
              status: "idle",
              lastError: {
                code: "ERR-PRIMARY",
                message: "Primary failure",
                source: { actionId: "action-22", nodePath: "root" },
                timestamp: 50,
              },
              errors: [
                {
                  code: "ERR-PRIMARY",
                  message: "Primary failure",
                  source: { actionId: "action-22", nodePath: "root" },
                  timestamp: 50,
                },
                {
                  code: "ERR-SECONDARY",
                  message: "Secondary failure",
                  source: { actionId: "action-22b", nodePath: "root.secondary" },
                  timestamp: 51,
                },
              ],
              pendingRequirements: [
                {
                  id: "req-22",
                  type: "host.effect",
                  params: {},
                  actionId: "action-22",
                  flowPosition: { nodePath: "root", snapshotVersion: 1 },
                  createdAt: 52,
                },
              ],
              currentAction: null,
            },
          }
        ),
        createdAt: 42,
        proposalRef: executing.proposalId,
        decisionRef: approved.decisionRecord.decisionId,
      });
      const governanceCommit = ctx.governanceService.finalize(executing, lineageCommit, 43);
      const dispatcher = createGovernanceEventDispatcher({
        service: ctx.governanceService,
        sink: {
          emit(event): void {
            events.push(event);
          },
        },
        now: () => 700,
      });

      dispatcher.emitSealCompleted(governanceCommit, lineageCommit);
      const failedEvent = events[1];
      const failedPayload = failedEvent?.type === "execution:failed" ? failedEvent.error : null;
      const currentErrorOnly = failedPayload?.currentError?.code === "ERR-PRIMARY"
        && !("details" in (failedPayload as Record<string, unknown>));

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-EXEC-EVT-5"), currentErrorOnly, {
          passMessage: "execution:failed payloads surface only the current error view through currentError.",
          failMessage: "execution:failed payloads leaked accumulated error history instead of the current error view.",
          evidence: [noteEvidence("Built a terminal snapshot with lastError plus historical system.errors and verified the emitted payload only exposed currentError and pending requirement ids.")],
        }),
      ]);

      expect(failedEvent).toEqual({
        type: "execution:failed",
        timestamp: 700,
        proposalId: governanceCommit.proposal.proposalId,
        executionKey: governanceCommit.proposal.executionKey,
        resultWorld: governanceCommit.proposal.resultWorld,
        error: {
          summary: "Execution failed with 1 error(s) and 1 pending requirement(s)",
          currentError: {
            code: "ERR-PRIMARY",
            message: "Primary failure",
            source: { actionId: "action-22", nodePath: "root" },
            timestamp: 50,
          },
          pendingRequirements: ["req-22"],
        },
      });
    }
  );
});
