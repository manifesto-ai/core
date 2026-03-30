import { describe, expect, it, vi } from "vitest";
import {
  createGovernanceService,
  type ActorAuthorityBinding,
  type Proposal,
} from "@manifesto-ai/governance";
import { createLineageService } from "@manifesto-ai/lineage";
import { createSnapshot } from "../facade/helpers.js";
import { InMemoryGovernedWorldPersistenceDriver } from "../../persistence/in-memory-driver.js";

async function createDriverHarness() {
  const driver = new InMemoryGovernedWorldPersistenceDriver();
  const lineage = createLineageService(driver.lineage);
  const governance = createGovernanceService(driver.governance, {
    lineageService: lineage,
  });
  const genesis = await lineage.prepareSealGenesis({
    schemaHash: "wfcts-schema",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  });
  await lineage.commitPrepared(genesis);

  return {
    driver,
    lineage,
    governance,
    genesis,
  };
}

async function createExecutingProposal(
  harness: Awaited<ReturnType<typeof createDriverHarness>>
) {
  const branch = await harness.lineage.getActiveBranch();
  const proposal = harness.governance.createProposal({
    proposalId: "prop-driver",
    baseWorld: branch.head,
    branchId: branch.id,
    actorId: "actor-driver",
    authorityId: "auth-driver",
    intent: {
      type: "demo.intent",
      intentId: "intent-driver",
      input: { count: 2 },
    },
    executionKey: "exec-driver",
    submittedAt: 10,
    epoch: branch.epoch,
  });
  const prepared = await harness.governance.prepareAuthorityResult(
    { ...proposal, status: "evaluating" },
    { kind: "approved", approvedScope: null },
    {
      currentEpoch: branch.epoch,
      currentBranchHead: branch.head,
      decidedAt: 11,
    }
  );

  if (prepared.discarded || !prepared.decisionRecord) {
    throw new Error("expected approved executing proposal");
  }

  const executingProposal: Proposal = {
    ...prepared.proposal,
    status: "executing",
    decisionId: prepared.decisionRecord.decisionId,
    decidedAt: prepared.decisionRecord.decidedAt,
  };

  await harness.driver.governance.putProposal(executingProposal);
  await harness.driver.governance.putDecisionRecord(prepared.decisionRecord);

  return {
    proposal: executingProposal,
    decisionRecord: prepared.decisionRecord,
  };
}

describe("InMemoryGovernedWorldPersistenceDriver", () => {
  it("persists lineage, governance, and attempt records through one transaction", async () => {
    const harness = await createDriverHarness();
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const activeBranch = await harness.lineage.getActiveBranch();

    const lineageCommit = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: harness.genesis.worldId,
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

    await harness.driver.runInSealTransaction(async (tx) => {
      await tx.commitPrepared(lineageCommit);
      await tx.putProposal(governanceCommit.proposal);
      await tx.putDecisionRecord(governanceCommit.decisionRecord);
    });

    expect((await harness.driver.lineage.getWorld(lineageCommit.worldId))?.worldId).toBe(
      lineageCommit.worldId
    );
    expect(await harness.driver.lineage.getAttempts(lineageCommit.worldId)).toHaveLength(1);
    expect((await harness.driver.governance.getProposal(proposal.proposalId))?.status).toBe(
      "completed"
    );
  });

  it("restores a prior snapshot of lineage and governance state", async () => {
    const harness = await createDriverHarness();
    const binding: ActorAuthorityBinding = {
      actorId: "actor-driver",
      authorityId: "auth-driver",
      policy: { mode: "auto_approve" },
    };
    await harness.driver.governance.putActorBinding(binding);
    const snapshot = harness.driver.snapshotState();

    await harness.driver.governance.putActorBinding({
      actorId: "actor-driver-2",
      authorityId: "auth-driver-2",
      policy: { mode: "auto_approve" },
    });
    const extraBranch = await harness.lineage.getActiveBranch();
    const extraWorld = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: harness.genesis.worldId,
      branchId: extraBranch.id,
      terminalSnapshot: createSnapshot({ count: 9 }),
      createdAt: 20,
      proposalRef: "prop-extra",
      decisionRef: "dec-extra",
    });
    await harness.lineage.commitPrepared(extraWorld);

    harness.driver.restoreState(snapshot);

    expect(await harness.driver.governance.getActorBindings()).toEqual([binding]);
    expect(await harness.driver.lineage.getWorld(extraWorld.worldId)).toBeNull();
    const activeBranchId = await harness.driver.lineage.getActiveBranchId();
    expect(activeBranchId).not.toBeNull();
    expect(await harness.driver.lineage.getBranchHead(activeBranchId!)).toBe(
      harness.genesis.worldId
    );
  });

  it("rolls back partial writes when a governance write fails mid-transaction", async () => {
    const harness = await createDriverHarness();
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const activeBranch = await harness.lineage.getActiveBranch();

    const lineageCommit = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: harness.genesis.worldId,
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
    const failure = new Error("simulated governance write failure");

    vi.spyOn(harness.driver.governance, "putProposal").mockImplementation(
      async () => {
        throw failure;
      }
    );

    await expect(
      harness.driver.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(lineageCommit);
        await tx.putProposal(governanceCommit.proposal);
        await tx.putDecisionRecord(governanceCommit.decisionRecord);
      })
    ).rejects.toThrow(failure);

    expect(await harness.driver.lineage.getWorld(lineageCommit.worldId)).toBeNull();
    expect(await harness.driver.lineage.getAttempts(lineageCommit.worldId)).toHaveLength(0);
    expect((await harness.driver.governance.getProposal(proposal.proposalId))?.status).toBe(
      "executing"
    );
  });
});
