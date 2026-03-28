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

function bootstrap() {
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
    genesis,
    governanceStore,
    governanceService,
  };
}

describe("@manifesto-ai/governance service", () => {
  it("enforces single-writer branch gates and stale-head supersede", () => {
    const ctx = bootstrap();
    const occupied = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-1",
      authorityId: "auth-1",
      intent: { type: "demo.occupied", intentId: "intent-1" },
      executionKey: "key-1",
      submittedAt: 10,
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });

    ctx.governanceStore.putProposal({
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
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });

    expect(() => ctx.governanceService.prepareAuthorityResult(
      { ...contender, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 13 }
    )).toThrow(/GOV-BRANCH-GATE-1/);

    ctx.governanceStore.putProposal({
      ...occupied,
      status: "completed",
      completedAt: 14,
      resultWorld: ctx.genesis.worldId,
    });

    const next = ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 2 }),
      createdAt: 15,
    });
    ctx.lineageService.commitPrepared(next);

    const stale = ctx.governanceService.prepareAuthorityResult(
      { ...contender, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 16 }
    );

    expect(stale.discarded).toBe(true);
    expect(stale.proposal.status).toBe("superseded");
    expect(stale.proposal.supersededReason).toBe("head_advance");
    expect(stale.decisionRecord).toBeUndefined();
  });

  it("invalidates stale ingress proposals after head advance and discards stale authority results", () => {
    const ctx = bootstrap();
    const stale = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-3",
      authorityId: "auth-3",
      intent: { type: "demo.stale", intentId: "intent-3" },
      executionKey: "key-3",
      submittedAt: 20,
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });
    ctx.governanceStore.putProposal({ ...stale, status: "evaluating" });

    const next = ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 3 }),
      createdAt: 21,
    });
    ctx.lineageService.commitPrepared(next);

    const invalidated = ctx.governanceService.invalidateStaleIngress(ctx.genesis.branchId);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0]?.proposalId).toBe(stale.proposalId);
    expect(invalidated[0]?.supersededReason).toBe("head_advance");
    expect(ctx.governanceService.shouldDiscardAuthorityResult(stale, ctx.lineageService.getBranch(ctx.genesis.branchId)!.epoch)).toBe(true);
  });

  it("finalize and finalizeOnSealRejection are read-only against GovernanceStore", () => {
    const ctx = bootstrap();
    const proposal = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-4",
      authorityId: "auth-4",
      intent: { type: "demo.finalize", intentId: "intent-4" },
      executionKey: "key-4",
      submittedAt: 30,
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });

    const prepared = ctx.governanceService.prepareAuthorityResult(
      { ...proposal, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 31 }
    );
    if (!prepared.decisionRecord) {
      throw new Error("expected decision record");
    }

    const executing = { ...prepared.proposal, status: "executing" as const };
    ctx.governanceStore.putProposal(executing);
    ctx.governanceStore.putDecisionRecord(prepared.decisionRecord);

    const before = JSON.stringify({
      proposal: ctx.governanceStore.getProposal(executing.proposalId),
      decision: ctx.governanceStore.getDecisionRecord(prepared.decisionRecord.decisionId),
    });

    const lineageCommit = ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot({ count: 4 }),
      createdAt: 32,
      proposalRef: executing.proposalId,
      decisionRef: prepared.decisionRecord.decisionId,
    });

    const finalized = ctx.governanceService.finalize(executing, lineageCommit, 33);
    const rejected = ctx.governanceService.finalizeOnSealRejection(
      executing,
      {
        kind: "self_loop",
        computedWorldId: ctx.genesis.worldId,
        message: "no-op",
      },
      34
    );

    const after = JSON.stringify({
      proposal: ctx.governanceStore.getProposal(executing.proposalId),
      decision: ctx.governanceStore.getDecisionRecord(prepared.decisionRecord.decisionId),
    });

    expect(finalized.proposal.status).toBe("completed");
    expect(finalized.proposal.resultWorld).toBe(lineageCommit.worldId);
    expect(rejected.proposal.status).toBe("failed");
    expect(rejected.proposal.resultWorld).toBeUndefined();
    expect(before).toBe(after);
  });
});
