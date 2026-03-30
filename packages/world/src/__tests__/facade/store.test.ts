import { describe, expect, it, vi } from "vitest";
import { type Proposal } from "../../index.js";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import {
  createFacadeHarness,
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
} from "./helpers.js";

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
  it("commits a governed seal transaction and advances lineage plus governance together", async () => {
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

    await harness.store.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(lineageCommit);
      await tx.putProposal(governanceCommit.proposal);
      await tx.putDecisionRecord(governanceCommit.decisionRecord);
    });

    expect((await harness.store.getWorld(lineageCommit.worldId))?.worldId).toBe(
      lineageCommit.worldId
    );
    expect(await harness.store.getBranchHead(activeBranch.id)).toBe(
      lineageCommit.worldId
    );
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "completed"
    );
    expect(
      (await harness.store.getDecisionRecord(decisionRecord.decisionId))
        ?.decisionId
    ).toBe(decisionRecord.decisionId);
  });

  it("wraps lineage CAS mismatch as a facade retry signal", async () => {
    const harness = createFacadeHarness();
    const { world } = await sealStandaloneGenesis(harness);

    const contenderA = await createExecutingProposal(harness, {
      proposalId: "prop-a",
      executionKey: "key-a",
      submittedAt: 10,
      decidedAt: 11,
    });
    const staleBranch = await harness.lineage.getActiveBranch();
    const staleLineageCommit = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: world!.worldId,
      branchId: staleBranch.id,
      terminalSnapshot: createSnapshot({ count: 2 }),
      createdAt: 12,
      proposalRef: contenderA.proposal.proposalId,
      decisionRef: contenderA.decisionRecord.decisionId,
    });
    const staleGovernanceCommit = await harness.governance.finalize(
      contenderA.proposal,
      staleLineageCommit,
      13
    );
    await harness.store.putProposal({
      ...contenderA.proposal,
      status: "completed",
      completedAt: 13,
      resultWorld: staleLineageCommit.worldId,
    });

    const contenderB = await createExecutingProposal(harness, {
      proposalId: "prop-b",
      executionKey: "key-b",
      submittedAt: 14,
      decidedAt: 15,
    });
    const winningBranch = await harness.lineage.getActiveBranch();
    const winningLineageCommit = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: world!.worldId,
      branchId: winningBranch.id,
      terminalSnapshot: createSnapshot({ count: 3 }),
      createdAt: 16,
      proposalRef: contenderB.proposal.proposalId,
      decisionRef: contenderB.decisionRecord.decisionId,
    });
    const winningGovernanceCommit = await harness.governance.finalize(
      contenderB.proposal,
      winningLineageCommit,
      17
    );

    await harness.store.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(winningLineageCommit);
      await tx.putProposal(winningGovernanceCommit.proposal);
      await tx.putDecisionRecord(winningGovernanceCommit.decisionRecord);
    });

    await expect(
      harness.store.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(staleLineageCommit);
        await tx.putProposal(staleGovernanceCommit.proposal);
        await tx.putDecisionRecord(staleGovernanceCommit.decisionRecord);
      })
    ).rejects.toThrow(FacadeCasMismatchError);
  });

  it("bootstraps governed genesis via the transaction seam", async () => {
    const harness = createFacadeHarness();
    const lineageCommit = await harness.lineage.prepareSealGenesis({
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

    await harness.store.putProposal(proposal);
    await harness.store.putDecisionRecord(decisionRecord);

    const governanceCommit = await harness.governance.finalize(
      proposal,
      lineageCommit,
      3
    );
    await harness.store.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(lineageCommit);
      await tx.putProposal(governanceCommit.proposal);
      await tx.putDecisionRecord(governanceCommit.decisionRecord);
    });

    expect((await harness.store.getWorld(lineageCommit.worldId))?.worldId).toBe(
      lineageCommit.worldId
    );
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "completed"
    );
    expect((await harness.lineage.getActiveBranch()).head).toBe(
      lineageCommit.worldId
    );
  });

  it("rolls back lineage writes when governance persistence fails mid-commit", async () => {
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
      resolveDriver(): Promise<{
        governance: { putProposal: (proposal: unknown) => Promise<void> };
      }>;
    };
    const driver = await internals.resolveDriver();
    const failure = new Error("simulated governance write failure");
    vi.spyOn(driver.governance, "putProposal").mockImplementation(
      async () => {
        throw failure;
      }
    );

    await expect(
      harness.store.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(lineageCommit);
        await tx.putProposal(governanceCommit.proposal);
        await tx.putDecisionRecord(governanceCommit.decisionRecord);
      })
    ).rejects.toThrow(failure);

    expect(await harness.store.getWorld(lineageCommit.worldId)).toBeNull();
    expect(await harness.store.getAttempts(lineageCommit.worldId)).toHaveLength(
      0
    );
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "executing"
    );
    expect((await harness.lineage.getActiveBranch()).head).toBe(world!.worldId);
  });

  it("exposes runInSealTransaction as the atomic write seam", async () => {
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

    const result = await harness.store.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(lineageCommit);
      await tx.putProposal(governanceCommit.proposal);
      await tx.putDecisionRecord(governanceCommit.decisionRecord);
      return lineageCommit.worldId;
    });

    expect(result).toBe(lineageCommit.worldId);
    expect((await harness.store.getWorld(lineageCommit.worldId))?.worldId).toBe(
      lineageCommit.worldId
    );
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "completed"
    );
  });

  it("rolls back runInSealTransaction when the transaction callback fails", async () => {
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
    const failure = new Error("simulated transaction failure");

    await expect(
      harness.store.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(lineageCommit);
        await tx.putProposal(governanceCommit.proposal);
        throw failure;
      })
    ).rejects.toThrow(failure);

    expect(await harness.store.getWorld(lineageCommit.worldId)).toBeNull();
    expect(await harness.store.getAttempts(lineageCommit.worldId)).toHaveLength(
      0
    );
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "executing"
    );
  });

  it("does not expose the removed commitSeal convenience method", () => {
    const harness = createFacadeHarness();
    expect((harness.store as Record<string, unknown>).commitSeal).toBeUndefined();
  });
});
