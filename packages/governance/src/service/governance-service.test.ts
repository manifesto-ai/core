import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";
import {
  createGovernanceService,
  createInMemoryGovernanceStore,
} from "../index.js";

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

async function bootstrap() {
  const lineageStore = createInMemoryLineageStore();
  const lineageService = createLineageService(lineageStore);
  const genesis = await lineageService.prepareSealGenesis({
    schemaHash: "schema-hash",
    terminalSnapshot: createSnapshot({ count: 1 }),
    createdAt: 1,
  });
  await lineageService.commitPrepared(genesis);

  const governanceStore = createInMemoryGovernanceStore();
  const governanceService = createGovernanceService(governanceStore, {
    lineageService,
  });

  return {
    lineageStore,
    lineageService,
    genesis,
    governanceStore,
    governanceService,
  };
}

describe("@manifesto-ai/governance service", () => {
  it("enforces single-writer branch gates and stale-head supersede", async () => {
    const ctx = await bootstrap();
    const occupied = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-1",
      authorityId: "auth-1",
      intent: { type: "demo.occupied", intentId: "intent-1" },
      executionKey: "key-1",
      submittedAt: 10,
      epoch: (await ctx.lineageService.getActiveBranch()).epoch,
    });

    await ctx.governanceStore.putProposal({
      ...occupied,
      status: "approved",
      decisionId: "dec-occupied",
      decidedAt: 11,
    });

    const contender = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-2",
      authorityId: "auth-2",
      intent: { type: "demo.contender", intentId: "intent-2" },
      executionKey: "key-2",
      submittedAt: 12,
      epoch: (await ctx.lineageService.getActiveBranch()).epoch,
    });

    await expect(ctx.governanceService.prepareAuthorityResult(
      { ...contender, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 13 }
    )).rejects.toThrow(/GOV-BRANCH-GATE-1/);

    await ctx.governanceStore.putProposal({
      ...occupied,
      status: "completed",
      completedAt: 14,
      resultWorld: ctx.genesis.worldId,
    });

    const next = await ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 2 }),
      createdAt: 15,
    });
    await ctx.lineageService.commitPrepared(next);

    const stale = await ctx.governanceService.prepareAuthorityResult(
      { ...contender, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 16 }
    );

    expect(stale.discarded).toBe(true);
    expect(stale.proposal.status).toBe("superseded");
    expect(stale.proposal.supersededReason).toBe("head_advance");
    expect(stale.decisionRecord).toBeUndefined();
  });

  it("invalidates stale ingress proposals after head advance and discards stale authority results", async () => {
    const ctx = await bootstrap();
    const stale = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-3",
      authorityId: "auth-3",
      intent: { type: "demo.stale", intentId: "intent-3" },
      executionKey: "key-3",
      submittedAt: 20,
      epoch: (await ctx.lineageService.getActiveBranch()).epoch,
    });
    await ctx.governanceStore.putProposal({ ...stale, status: "evaluating" });

    const next = await ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 3 }),
      createdAt: 21,
    });
    await ctx.lineageService.commitPrepared(next);

    const invalidated = await ctx.governanceService.invalidateStaleIngress(ctx.genesis.branchId);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0]?.proposalId).toBe(stale.proposalId);
    expect(invalidated[0]?.supersededReason).toBe("head_advance");
    expect(
      ctx.governanceService.shouldDiscardAuthorityResult(
        stale,
        (await ctx.lineageService.getBranch(ctx.genesis.branchId))!.epoch
      )
    ).toBe(true);
  });

  it("finalize is read-only against GovernanceStore", async () => {
    const ctx = await bootstrap();
    const proposal = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-4",
      authorityId: "auth-4",
      intent: { type: "demo.finalize", intentId: "intent-4" },
      executionKey: "key-4",
      submittedAt: 30,
      epoch: (await ctx.lineageService.getActiveBranch()).epoch,
    });

    const prepared = await ctx.governanceService.prepareAuthorityResult(
      { ...proposal, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 31 }
    );
    if (!prepared.decisionRecord) {
      throw new Error("expected decision record");
    }

    const executing = { ...prepared.proposal, status: "executing" as const };
    await ctx.governanceStore.putProposal(executing);
    await ctx.governanceStore.putDecisionRecord(prepared.decisionRecord);

    const before = JSON.stringify({
      proposal: await ctx.governanceStore.getProposal(executing.proposalId),
      decision: await ctx.governanceStore.getDecisionRecord(prepared.decisionRecord.decisionId),
    });

    const lineageCommit = await ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 4 }),
      createdAt: 32,
      proposalRef: executing.proposalId,
      decisionRef: prepared.decisionRecord.decisionId,
    });

    const finalized = await ctx.governanceService.finalize(executing, lineageCommit, 33);

    const after = JSON.stringify({
      proposal: await ctx.governanceStore.getProposal(executing.proposalId),
      decision: await ctx.governanceStore.getDecisionRecord(prepared.decisionRecord.decisionId),
    });

    expect(finalized.proposal.status).toBe("completed");
    expect(finalized.proposal.resultWorld).toBe(lineageCommit.worldId);
    expect(before).toBe(after);
  });
});
