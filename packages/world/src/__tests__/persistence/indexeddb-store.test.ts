import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createGovernanceService,
  createIndexedDbWorldStore,
  createLineageService,
  type DecisionRecord,
  type Proposal,
} from "../../index.js";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import { createSnapshot } from "../facade/helpers.js";

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.addEventListener("success", () => resolve(), { once: true });
    request.addEventListener(
      "error",
      () => {
        reject(request.error ?? new Error(`Failed to delete IndexedDB database ${name}`));
      },
      { once: true }
    );
    request.addEventListener(
      "blocked",
      () => {
        reject(new Error(`IndexedDB delete for ${name} was blocked`));
      },
      { once: true }
    );
  });
}

async function createIndexedDbHarness(name: string) {
  const store = createIndexedDbWorldStore({ name });
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
  harness: Awaited<ReturnType<typeof createIndexedDbHarness>>
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
  harness: Awaited<ReturnType<typeof createIndexedDbHarness>>,
  baseWorldId: string
): Promise<{ proposal: Proposal; decisionRecord: DecisionRecord }> {
  const branch = await harness.lineage.getActiveBranch();
  const proposal = harness.governance.createProposal({
    proposalId: "prop-idb",
    baseWorld: baseWorldId,
    branchId: branch.id,
    actorId: "actor-idb",
    authorityId: "auth-idb",
    intent: {
      type: "demo.intent",
      intentId: "intent-idb",
      input: { count: 2 },
    },
    executionKey: "exec-idb",
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

describe("IndexedDbGovernedWorldStore", () => {
  it("persists governed lineage and governance state across reopen", async () => {
    const name = `manifesto-world-idb-${crypto.randomUUID()}`;
    let first: Awaited<ReturnType<typeof createIndexedDbHarness>> | undefined;
    let second: Awaited<ReturnType<typeof createIndexedDbHarness>> | undefined;

    try {
      first = await createIndexedDbHarness(name);
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
      await first.store.close();
      first = undefined;

      second = await createIndexedDbHarness(name);
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
      await second?.store.close();
      await first?.store.close();
      await deleteDatabase(name);
    }
  });

  it("rolls back indexeddb seal transactions when the callback fails", async () => {
    const name = `manifesto-world-idb-${crypto.randomUUID()}`;
    let harness: Awaited<ReturnType<typeof createIndexedDbHarness>> | undefined;

    try {
      harness = await createIndexedDbHarness(name);
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
      const failure = new Error("simulated indexeddb transaction failure");

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
      await harness?.store.close();
      await deleteDatabase(name);
    }
  });

  it("propagates lineage CAS mismatches through the indexeddb seal transaction seam", async () => {
    const name = `manifesto-world-idb-${crypto.randomUUID()}`;
    let harness: Awaited<ReturnType<typeof createIndexedDbHarness>> | undefined;

    try {
      harness = await createIndexedDbHarness(name);
      const genesis = await sealGenesis(harness);
      const branch = await harness.lineage.getActiveBranch();
      const staleCommit = await harness.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: genesis.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 2 }),
        createdAt: 20,
        proposalRef: "prop-stale",
        decisionRef: "dec-stale",
      });
      const winningCommit = await harness.lineage.prepareSealNext({
        schemaHash: "wfcts-schema",
        baseWorldId: genesis.worldId,
        branchId: branch.id,
        terminalSnapshot: createSnapshot({ count: 3 }),
        createdAt: 21,
        proposalRef: "prop-winning",
        decisionRef: "dec-winning",
      });

      await harness.lineage.commitPrepared(winningCommit);

      await expect(
        harness.store.runInSealTransaction(async (tx) => {
          await tx.commitPrepared(staleCommit);
        })
      ).rejects.toThrow(FacadeCasMismatchError);
    } finally {
      await harness?.store.close();
      await deleteDatabase(name);
    }
  });
});
