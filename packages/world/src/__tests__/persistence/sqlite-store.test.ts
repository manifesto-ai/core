import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
  createGovernanceService,
  createLineageService,
  SqliteGovernedWorldStore,
  type DecisionRecord,
  type Proposal,
} from "../../index.js";
import { createSnapshot } from "../facade/helpers.js";

async function createSqliteHarness(filename: string) {
  const store = new SqliteGovernedWorldStore({ filename });
  const lineage = createLineageService(store);
  const governance = createGovernanceService(store, {
    lineageService: lineage,
  });

  return {
    store,
    lineage,
    governance,
  };
}

async function sealGenesis(
  harness: Awaited<ReturnType<typeof createSqliteHarness>>
) {
  const genesis = await harness.lineage.prepareSealGenesis({
    schemaHash: "wfcts-schema",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  });
  await harness.lineage.commitPrepared(genesis);
  return genesis;
}

async function createExecutingProposal(
  harness: Awaited<ReturnType<typeof createSqliteHarness>>,
  baseWorldId: string
): Promise<{ proposal: Proposal; decisionRecord: DecisionRecord }> {
  const branch = await harness.lineage.getActiveBranch();
  const proposal = harness.governance.createProposal({
    proposalId: "prop-sqlite",
    baseWorld: baseWorldId,
    branchId: branch.id,
    actorId: "actor-sqlite",
    authorityId: "auth-sqlite",
    intent: {
      type: "demo.intent",
      intentId: "intent-sqlite",
      input: { count: 2 },
    },
    executionKey: "exec-sqlite",
    submittedAt: 10,
    epoch: branch.epoch,
  });
  const prepared = await harness.governance.prepareAuthorityResult(
    { ...proposal, status: "evaluating" },
    { kind: "approved", approvedScope: null },
    {
      currentEpoch: branch.epoch,
      currentBranchHead: baseWorldId,
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

  await harness.store.putProposal(executingProposal);
  await harness.store.putDecisionRecord(prepared.decisionRecord);

  return {
    proposal: executingProposal,
    decisionRecord: prepared.decisionRecord,
  };
}

describe("SqliteGovernedWorldStore", () => {
  it("persists governed lineage and governance state across reopen", async () => {
    const dir = mkdtempSync(join(tmpdir(), "manifesto-world-sqlite-"));
    const filename = join(dir, "world.sqlite");
    let first: Awaited<ReturnType<typeof createSqliteHarness>> | undefined;
    let second: Awaited<ReturnType<typeof createSqliteHarness>> | undefined;

    try {
      first = await createSqliteHarness(filename);
      const genesis = await sealGenesis(first);
      const { proposal, decisionRecord } = await createExecutingProposal(
        first,
        genesis.worldId
      );
      const branch = await first.lineage.getActiveBranch();
      const lineageCommit = await first.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: genesis.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 20,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      });
      const governanceCommit = await first.governance.finalize(
        proposal,
        lineageCommit,
        21
      );

      await first.store.runInSealTransaction(async (tx) => {
        await tx.commitPrepared(lineageCommit);
        await tx.putProposal(governanceCommit.proposal);
        await tx.putDecisionRecord(governanceCommit.decisionRecord);
      });
      first.store.close();
      first = undefined;

      second = await createSqliteHarness(filename);
      expect((await second.store.getWorld(lineageCommit.worldId))?.worldId).toBe(
        lineageCommit.worldId
      );
      expect((await second.store.getProposal(proposal.proposalId))?.status).toBe(
        "completed"
      );
      expect(await second.store.getAttempts(lineageCommit.worldId)).toHaveLength(1);
      expect((await second.lineage.getActiveBranch()).head).toBe(
        lineageCommit.worldId
      );
    } finally {
      second?.store.close();
      first?.store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("rolls back sqlite seal transactions when the callback fails", async () => {
    const dir = mkdtempSync(join(tmpdir(), "manifesto-world-sqlite-"));
    const filename = join(dir, "world.sqlite");
    let harness: Awaited<ReturnType<typeof createSqliteHarness>> | undefined;

    try {
      harness = await createSqliteHarness(filename);
      const genesis = await sealGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(
        harness,
        genesis.worldId
      );
      const branch = await harness.lineage.getActiveBranch();
      const lineageCommit = await harness.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: genesis.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 20,
        proposalRef: proposal.proposalId,
        decisionRef: decisionRecord.decisionId,
      });
      const failure = new Error("simulated sqlite transaction failure");

      await expect(
        harness.store.runInSealTransaction(async (tx) => {
          await tx.commitPrepared(lineageCommit);
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
    } finally {
      harness?.store.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
