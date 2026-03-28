import { describe, expect, it } from "vitest";
import { type Proposal } from "@manifesto-ai/governance";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import { createFacadeHarness, createExecutingProposal, createSnapshot, sealStandaloneGenesis } from "./helpers.js";

function createGovernedGenesisProposal(): Proposal {
  return {
    proposalId: "prop-governed-genesis",
    baseWorld: "bootstrap-base",
    branchId: "bootstrap-branch",
    actorId: "actor-bootstrap",
    authorityId: "auth-bootstrap",
    intent: {
      type: "demo.bootstrap",
      intentId: "intent-bootstrap",
    },
    status: "executing",
    executionKey: "bootstrap-key",
    submittedAt: 1,
    decidedAt: 2,
    decisionId: "dec-governed-genesis",
    epoch: 0,
  };
}

describe("@manifesto-ai/world facade store", () => {
  it("commits a full write set and advances lineage plus governance together", () => {
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

    harness.store.commitSeal({
      kind: "full",
      lineage: lineageCommit,
      governance: governanceCommit,
    });

    expect(harness.store.getWorld(lineageCommit.worldId)?.worldId).toBe(lineageCommit.worldId);
    expect(harness.store.getBranchHead(harness.lineage.getActiveBranch().id)).toBe(lineageCommit.worldId);
    expect(harness.store.getProposal(proposal.proposalId)?.status).toBe("completed");
    expect(harness.store.getDecisionRecord(decisionRecord.decisionId)?.decisionId).toBe(decisionRecord.decisionId);
  });

  it("commits governance-only write sets without mutating lineage", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = createExecutingProposal(harness);
    const rejection = {
      kind: "self_loop" as const,
      computedWorldId: world!.worldId,
      message: "simulated self-loop",
    };
    const governanceCommit = harness.governance.finalizeOnSealRejection(proposal, rejection, 30);

    harness.store.commitSeal({
      kind: "govOnly",
      governance: governanceCommit,
    });

    expect(harness.store.getWorld(world!.worldId)?.worldId).toBe(world!.worldId);
    expect(harness.store.getProposal(proposal.proposalId)?.status).toBe("failed");
    expect(harness.store.getProposal(proposal.proposalId)?.resultWorld).toBeUndefined();
    expect(harness.store.getDecisionRecord(decisionRecord.decisionId)?.decisionId).toBe(decisionRecord.decisionId);
  });

  it("wraps lineage CAS mismatch as a facade retry signal", () => {
    const harness = createFacadeHarness();
    const { world } = sealStandaloneGenesis(harness);

    const contenderA = createExecutingProposal(harness, {
      proposalId: "prop-a",
      executionKey: "key-a",
      submittedAt: 10,
      decidedAt: 11,
    });
    const staleLineageCommit = harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: world!.worldId,
      branchId: harness.lineage.getActiveBranch().id,
      terminalSnapshot: createSnapshot({ count: 2 }),
      createdAt: 12,
      proposalRef: contenderA.proposal.proposalId,
      decisionRef: contenderA.decisionRecord.decisionId,
    });
    const staleGovernanceCommit = harness.governance.finalize(contenderA.proposal, staleLineageCommit, 13);
    harness.store.putProposal({
      ...contenderA.proposal,
      status: "completed",
      completedAt: 13,
      resultWorld: staleLineageCommit.worldId,
    });

    const contenderB = createExecutingProposal(harness, {
      proposalId: "prop-b",
      executionKey: "key-b",
      submittedAt: 14,
      decidedAt: 15,
    });
    const winningLineageCommit = harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: world!.worldId,
      branchId: harness.lineage.getActiveBranch().id,
      terminalSnapshot: createSnapshot({ count: 3 }),
      createdAt: 16,
      proposalRef: contenderB.proposal.proposalId,
      decisionRef: contenderB.decisionRecord.decisionId,
    });
    const winningGovernanceCommit = harness.governance.finalize(contenderB.proposal, winningLineageCommit, 17);

    harness.store.commitSeal({
      kind: "full",
      lineage: winningLineageCommit,
      governance: winningGovernanceCommit,
    });

    expect(() => harness.store.commitSeal({
      kind: "full",
      lineage: staleLineageCommit,
      governance: staleGovernanceCommit,
    })).toThrow(FacadeCasMismatchError);
  });

  it("bootstraps genesis via a full write set", () => {
    const harness = createFacadeHarness();
    const lineageCommit = harness.lineage.prepareSealGenesis({
      schemaHash: "wfcts-schema",
      terminalSnapshot: createSnapshot({ count: 1 }),
      createdAt: 1,
    });
    const proposal = createGovernedGenesisProposal();
    const decisionRecord = {
      decisionId: "dec-governed-genesis",
      proposalId: proposal.proposalId,
      authorityId: proposal.authorityId,
      decision: { kind: "approved" as const },
      decidedAt: 2,
    };

    harness.store.putProposal(proposal);
    harness.store.putDecisionRecord(decisionRecord);

    const governanceCommit = harness.governance.finalize(proposal, lineageCommit, 3);
    harness.store.commitSeal({
      kind: "full",
      lineage: lineageCommit,
      governance: governanceCommit,
    });

    expect(harness.store.getWorld(lineageCommit.worldId)?.worldId).toBe(lineageCommit.worldId);
    expect(harness.store.getProposal(proposal.proposalId)?.status).toBe("completed");
    expect(harness.lineage.getActiveBranch().head).toBe(lineageCommit.worldId);
  });
});
