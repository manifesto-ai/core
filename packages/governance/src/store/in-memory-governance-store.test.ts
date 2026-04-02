import { describe, expect, it } from "vitest";
import { createInMemoryGovernanceStore } from "../provider.js";

describe("@manifesto-ai/governance in-memory store", () => {
  it("returns the single approved or executing proposal for a branch", async () => {
    const store = createInMemoryGovernanceStore();

    await store.putProposal({
      proposalId: "proposal-approved",
      baseWorld: "world-1",
      branchId: "branch-a",
      actorId: "actor-1",
      authorityId: "auth-1",
      intent: { type: "demo", intentId: "intent-1" },
      status: "approved",
      executionKey: "proposal-approved:1",
      submittedAt: 1,
      decisionId: "decision-1",
      decidedAt: 2,
      epoch: 0,
    });

    const proposal = await store.getExecutionStageProposal("branch-a");

    expect(proposal?.proposalId).toBe("proposal-approved");
  });

  it("rejects multiple execution-stage proposals on the same branch", async () => {
    const store = createInMemoryGovernanceStore();

    await store.putProposal({
      proposalId: "proposal-1",
      baseWorld: "world-1",
      branchId: "branch-a",
      actorId: "actor-1",
      authorityId: "auth-1",
      intent: { type: "demo", intentId: "intent-1" },
      status: "approved",
      executionKey: "proposal-1:1",
      submittedAt: 1,
      decisionId: "decision-1",
      decidedAt: 2,
      epoch: 0,
    });
    await store.putProposal({
      proposalId: "proposal-2",
      baseWorld: "world-1",
      branchId: "branch-a",
      actorId: "actor-2",
      authorityId: "auth-2",
      intent: { type: "demo", intentId: "intent-2" },
      status: "executing",
      executionKey: "proposal-2:1",
      submittedAt: 3,
      decisionId: "decision-2",
      decidedAt: 4,
      epoch: 0,
    });

    await expect(store.getExecutionStageProposal("branch-a")).rejects.toThrow(/GOV-STORE-4/);
  });
});
