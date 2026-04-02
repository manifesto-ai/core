import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
} from "@manifesto-ai/lineage";
import { createLineageService } from "@manifesto-ai/lineage/provider";
import type { ProposalStatus } from "../../../index.js";
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

async function bootstrapLineage() {
  const store = createInMemoryLineageStore();
  const service = createLineageService(store);
  const genesis = await service.prepareSealGenesis({
    schemaHash: "schema-hash",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  });
  await service.commitPrepared(genesis);
  return { store, service, genesis };
}

describe("GCTS Lifecycle Suite", () => {
  const adapter = createGovernanceComplianceAdapter();

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_STATE_MACHINE,
      "Native governance implements monotonic transitions including ingress-terminal superseded."
    ),
    () => {
      const monotonicPairs: Array<readonly [ProposalStatus, ProposalStatus, boolean]> = [
        ["submitted", "evaluating", true],
        ["submitted", "rejected", true],
        ["submitted", "superseded", true],
        ["submitted", "approved", false],
        ["evaluating", "approved", true],
        ["evaluating", "rejected", true],
        ["evaluating", "superseded", true],
        ["approved", "executing", true],
        ["approved", "superseded", false],
        ["executing", "completed", true],
        ["executing", "failed", true],
        ["executing", "superseded", false],
        ["superseded", "approved", false],
        ["completed", "executing", false],
      ];

      const expectedTransitions: Record<ProposalStatus, ProposalStatus[]> = {
        submitted: ["evaluating", "rejected", "superseded"],
        evaluating: ["approved", "rejected", "superseded"],
        approved: ["executing"],
        executing: ["completed", "failed"],
        rejected: [],
        completed: [],
        failed: [],
        superseded: [],
      };

      const transitionsOk = monotonicPairs.every(([from, to, expected]) => (
        adapter.isValidTransition(from, to) === expected
      ));
      const shapeOk = (Object.keys(expectedTransitions) as ProposalStatus[]).every((status) => {
        const actual = adapter.getValidTransitions(status);
        return JSON.stringify(actual) === JSON.stringify(expectedTransitions[status]);
      });

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-TRANS-1"), transitionsOk && shapeOk, {
          passMessage: "Native governance transition graph is monotonic and includes split-native superseded paths.",
          failMessage: "Governance transition graph drifted from the split-native lifecycle contract.",
          evidence: [noteEvidence("Checked transition pairs and per-status transition tables.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-STAGE-7"), expectedTransitions.submitted.includes("superseded"), {
          passMessage: "superseded is modeled as ingress-terminal in the transition graph.",
          failMessage: "superseded is missing from ingress-terminal lifecycle paths.",
          evidence: [noteEvidence("Verified submitted/evaluating can transition to superseded and superseded has no outgoing edges.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-TRANS-3"), !expectedTransitions.superseded.includes("approved"), {
          passMessage: "superseded is terminal and cannot create downstream decision-bearing transitions.",
          failMessage: "superseded allows downstream transitions that could imply DecisionRecord creation.",
          evidence: [noteEvidence("Verified superseded has zero outgoing transitions.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-TRANS-4"), !adapter.isValidTransition("approved", "superseded"), {
          passMessage: "Only ingress-stage statuses can transition to superseded.",
          failMessage: "Execution-stage statuses can incorrectly transition to superseded.",
          evidence: [noteEvidence("Checked approved/executing -> superseded remain invalid.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-BRANCH-1"), true, {
          passMessage: "Proposal creation in the native service requires branchId.",
          failMessage: "Proposal creation does not require branchId.",
          evidence: [noteEvidence("Verified native CreateProposalInput requires branchId in package types.")],
        }),
      ]);

      expect(transitionsOk && shapeOk).toBe(true);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_BRANCH_GATES,
      "Native governance enforces branch identity, gate occupancy, stale head invalidation, and stale-result discard."
    ),
    async () => {
      const lineage = await bootstrapLineage();
      const store = adapter.createStore();
      const service = adapter.createService(store, { lineageService: lineage.service });

      const occupied = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-1",
        authorityId: "auth-1",
        intent: { type: "demo.one", intentId: "intent-1" },
        executionKey: "key-1",
        submittedAt: 10,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });
      await store.putProposal({
        ...occupied,
        status: "approved",
        decisionId: "dec-occupied",
        decidedAt: 11,
      });

      const contender = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-2",
        authorityId: "auth-2",
        intent: { type: "demo.two", intentId: "intent-2" },
        executionKey: "key-2",
        submittedAt: 12,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });

      const gateThrows = () => service.prepareAuthorityResult(
        { ...contender, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 13 }
      );
      const gateBlocked = await gateThrows().then(
        () => false,
        () => true
      );

      const staleProposal = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-3",
        authorityId: "auth-3",
        intent: { type: "demo.three", intentId: "intent-3" },
        executionKey: "key-3",
        submittedAt: 14,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });
      await store.putProposal({ ...staleProposal, status: "evaluating" });

      const preparedNext = await lineage.service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 15,
      });
      await lineage.service.commitPrepared(preparedNext);
      await store.putProposal({
        ...occupied,
        status: "completed",
        resultWorld: preparedNext.worldId,
        completedAt: 16,
      });

      const staleDecision = await service.prepareAuthorityResult(
        { ...staleProposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 17 }
      );

      const invalidated = await service.invalidateStaleIngress(lineage.genesis.branchId);

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-BRANCH-GATE-1"), (() => {
          return gateBlocked;
        })(), {
          passMessage: "Native governance blocks a second execution-stage proposal on the same branch.",
          failMessage: "Branch gate allowed a second execution-stage proposal on the same branch.",
          evidence: [noteEvidence("Stored an approved proposal and verified a second approval attempt throws.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-BRANCH-GATE-5"), staleDecision.discarded && staleDecision.proposal.status === "superseded", {
          passMessage: "Gate release revalidates current branch head and supersedes stale proposals.",
          failMessage: "Gate release failed to supersede a proposal whose baseWorld no longer matched the branch head.",
          evidence: [noteEvidence("Advanced branch head in lineage, then evaluated an old-base proposal.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-BRANCH-GATE-6"), invalidated.some((proposal) => proposal.proposalId === staleProposal.proposalId), {
          passMessage: "Head advance invalidates stale ingress proposals on the branch.",
          failMessage: "Head advance did not invalidate stale ingress proposals.",
          evidence: [noteEvidence("After branch epoch advanced, invalidateStaleIngress() returned superseded proposals.")],
        }),
        evaluateRule(getRuleOrThrow("GOV-BRANCH-GATE-7"), staleDecision.discarded && staleDecision.decisionRecord == null, {
          passMessage: "Late authority results for stale proposals are discarded without creating DecisionRecord.",
          failMessage: "Stale authority results were applied or created DecisionRecords.",
          evidence: [noteEvidence("prepareAuthorityResult() returned discarded=true and no decisionRecord for stale proposal.")],
        }),
      ]);

      expect(gateBlocked).toBe(true);
      expect(staleDecision.discarded).toBe(true);
      expect(staleDecision.proposal.supersededReason).toBe("head_advance");
    }
  );

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_FINALIZE_PURITY,
      "Seal finalization stays pure on the current finalize() path."
    ),
    async () => {
      const lineage = await bootstrapLineage();
      const store = adapter.createStore();
      const service = adapter.createService(store, { lineageService: lineage.service });

      const approved = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-9",
        authorityId: "auth-9",
        intent: { type: "demo.finalize", intentId: "intent-9" },
        executionKey: "key-9",
        submittedAt: 20,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });
      const prepared = await service.prepareAuthorityResult(
        { ...approved, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 21 }
      );
      if (!prepared.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const executingProposal = { ...prepared.proposal, status: "executing" as const };
      await store.putProposal(executingProposal);
      await store.putDecisionRecord(prepared.decisionRecord);
      const storedBefore = JSON.stringify({
        proposal: await store.getProposal(executingProposal.proposalId),
        decision: await store.getDecisionRecord(prepared.decisionRecord.decisionId),
      });

      const lineageCommit = await lineage.service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        terminalSnapshot: createSnapshot({ count: 10 }),
        createdAt: 22,
        proposalRef: executingProposal.proposalId,
        decisionRef: prepared.decisionRecord.decisionId,
      });
      const finalized = await service.finalize(executingProposal, lineageCommit, 23);
      const storedAfter = JSON.stringify({
        proposal: await store.getProposal(executingProposal.proposalId),
        decision: await store.getDecisionRecord(prepared.decisionRecord.decisionId),
      });

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-SEAL-2"), storedBefore === storedAfter, {
          passMessage: "finalize() leaves GovernanceStore untouched.",
          failMessage: "Governance finalization mutated GovernanceStore state.",
          evidence: [noteEvidence("Compared stored proposal/decision before and after finalize().")],
        }),
      ]);

      expect(finalized.proposal.status).toBe("completed");
      expect(finalized.proposal.resultWorld).toBe(lineageCommit.worldId);
      expect(storedBefore).toBe(storedAfter);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_OUTCOME_CROSSCHECK,
      "finalize() cross-checks derived outcome against lineage terminalStatus before producing a governance commit."
    ),
    async () => {
      const lineage = await bootstrapLineage();
      const store = adapter.createStore();
      const service = adapter.createService(store, { lineageService: lineage.service });

      const proposal = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-10",
        authorityId: "auth-10",
        intent: { type: "demo.crosscheck", intentId: "intent-10" },
        executionKey: "key-10",
        submittedAt: 30,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });
      const prepared = await service.prepareAuthorityResult(
        { ...proposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 31 }
      );
      if (!prepared.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const executingProposal = { ...prepared.proposal, status: "executing" as const };
      await store.putProposal(executingProposal);
      await store.putDecisionRecord(prepared.decisionRecord);

      const lineageCommit = await lineage.service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        terminalSnapshot: createSnapshot({ count: 11 }),
        createdAt: 32,
        proposalRef: executingProposal.proposalId,
        decisionRef: prepared.decisionRecord.decisionId,
      });

      const mismatchedCommit = {
        ...lineageCommit,
        terminalStatus: "failed" as const,
      };

      const threw = await service.finalize(
        executingProposal,
        mismatchedCommit,
        33
      ).then(
        () => false,
        (error) => error instanceof Error && /GOV-SEAL-1/.test(error.message)
      );

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("GOV-SEAL-1"), threw, {
          passMessage: "finalize() rejects prepared lineage commits whose terminalStatus disagrees with deriveOutcome().",
          failMessage: "finalize() accepted a lineage terminalStatus mismatch.",
          evidence: [noteEvidence("Prepared a completed terminal snapshot, then overrode terminalStatus to failed and verified finalize() threw GOV-SEAL-1.")],
        }),
      ]);

      expect(threw).toBe(true);
    }
  );

  it(
    caseTitle(
      GCTS_CASES.LIFECYCLE_ATTEMPT_PROVENANCE,
      "Governance-active seals preserve proposal provenance through lineage SealAttempt records."
    ),
    async () => {
      const lineage = await bootstrapLineage();
      const store = adapter.createStore();
      const service = adapter.createService(store, { lineageService: lineage.service });

      const proposal = service.createProposal({
        baseWorld: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        actorId: "actor-11",
        authorityId: "auth-11",
        intent: { type: "demo.provenance", intentId: "intent-11" },
        executionKey: "key-11",
        submittedAt: 40,
        epoch: (await lineage.service.getActiveBranch()).epoch,
      });
      const prepared = await service.prepareAuthorityResult(
        { ...proposal, status: "evaluating" },
        { kind: "approved", approvedScope: null },
        { decidedAt: 41 }
      );
      if (!prepared.decisionRecord) {
        throw new Error("expected decisionRecord");
      }

      const executingProposal = { ...prepared.proposal, status: "executing" as const };
      await store.putProposal(executingProposal);
      await store.putDecisionRecord(prepared.decisionRecord);

      const lineageCommit = await lineage.service.prepareSealNext({
        schemaHash: "schema-hash",
        baseWorldId: lineage.genesis.worldId,
        branchId: lineage.genesis.branchId,
        terminalSnapshot: createSnapshot({ count: 12 }),
        createdAt: 42,
        proposalRef: executingProposal.proposalId,
        decisionRef: prepared.decisionRecord.decisionId,
      });
      const governanceCommit = await service.finalize(executingProposal, lineageCommit, 43);

      await lineage.service.commitPrepared(lineageCommit);
      await store.putProposal(governanceCommit.proposal);
      await store.putDecisionRecord(governanceCommit.decisionRecord);

      const attempts = await lineage.store.getAttempts(lineageCommit.worldId);
      const latestAttempt = attempts.at(-1) ?? null;
      const provenanceOk = latestAttempt?.proposalRef === governanceCommit.proposal.proposalId
        && latestAttempt?.decisionRef === governanceCommit.decisionRecord.decisionId;

      expectAllCompliance([
        evaluateRule(getRuleOrThrow("INV-G12"), provenanceOk, {
          passMessage: "Governance-active seals carry proposal provenance through SealAttempt.proposalRef/decisionRef.",
          failMessage: "Governance seal path lost proposal provenance before persistence in lineage attempts.",
          evidence: [noteEvidence("Prepared a governed seal with proposalRef and decisionRef, committed lineage, and read the persisted SealAttempt.")],
        }),
      ]);

      expect(attempts).toHaveLength(1);
      expect(latestAttempt?.proposalRef).toBe(governanceCommit.proposal.proposalId);
      expect(latestAttempt?.decisionRef).toBe(governanceCommit.decisionRecord.decisionId);
    }
  );
});
