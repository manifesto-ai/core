import { describe, expect, it } from "vitest";
import type { ErrorValue, Snapshot } from "@manifesto-ai/core";
import {
  createInMemoryLineageStore,
  createLineageService,
} from "@manifesto-ai/lineage";
import {
  createGovernanceEventDispatcher,
  createGovernanceService,
  createInMemoryGovernanceStore,
} from "./index.js";

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

  const proposal = governanceService.createProposal({
    baseWorld: genesis.worldId,
    branchId: genesis.branchId,
    actorId: "actor-1",
    authorityId: "auth-1",
    intent: { type: "demo.intent", intentId: "intent-1" },
    executionKey: "prop-1:1",
    submittedAt: 10,
    epoch: lineageService.getActiveBranch().epoch,
  });

  const approved = governanceService.prepareAuthorityResult(
    { ...proposal, status: "evaluating" },
    { kind: "approved", approvedScope: null },
    { decidedAt: 11 }
  );
  if (!approved.decisionRecord) {
    throw new Error("expected decision record");
  }

  const lineageCommit = lineageService.prepareSealNext({
    schemaHash: "schema-hash",
    baseWorldId: genesis.worldId,
    branchId: genesis.branchId,
    terminalSnapshot: createSnapshot({ count: 2 }),
    createdAt: 12,
    proposalRef: approved.proposal.proposalId,
    decisionRef: approved.decisionRecord.decisionId,
  });

  const completedProposal = {
    ...approved.proposal,
    status: "completed" as const,
    resultWorld: lineageCommit.worldId,
    completedAt: 13,
  };
  const failedProposal = {
    ...approved.proposal,
    status: "failed" as const,
    resultWorld: lineageCommit.worldId,
    completedAt: 13,
  };

  return {
    lineageCommit,
    governanceService,
    governanceCommit: {
      proposal: completedProposal,
      decisionRecord: approved.decisionRecord,
      hasLineageRecords: true,
    },
    completedProposal,
    failedProposal,
  };
}

describe("@manifesto-ai/governance event helpers", () => {
  it("creates governance-native post-commit event payloads", () => {
    const ctx = bootstrap();
    const completed = ctx.governanceService.createExecutionCompletedEvent(
      ctx.completedProposal,
      20
    );
    const failed = ctx.governanceService.createExecutionFailedEvent(
      ctx.failedProposal,
      {
        summary: "Execution failed",
        details: [
          {
            code: "ERR-1",
            message: "boom",
            source: { actionId: "action-1", nodePath: "root" },
            timestamp: 19,
          } satisfies ErrorValue,
        ],
      },
      21
    );
    const created = ctx.governanceService.createWorldCreatedEvent(
      ctx.lineageCommit.world,
      ctx.completedProposal.proposalId,
      ctx.completedProposal.baseWorld,
      "completed",
      22
    );
    const forked = ctx.governanceService.createWorldForkedEvent(
      ctx.completedProposal.branchId,
      ctx.completedProposal.baseWorld,
      23
    );

    expect(completed).toEqual({
      type: "execution:completed",
      timestamp: 20,
      proposalId: ctx.completedProposal.proposalId,
      executionKey: ctx.completedProposal.executionKey,
      resultWorld: ctx.completedProposal.resultWorld,
    });
    expect(failed).toEqual({
      type: "execution:failed",
      timestamp: 21,
      proposalId: ctx.failedProposal.proposalId,
      executionKey: ctx.failedProposal.executionKey,
      resultWorld: ctx.failedProposal.resultWorld,
      error: {
        summary: "Execution failed",
        details: [
          {
            code: "ERR-1",
            message: "boom",
            source: { actionId: "action-1", nodePath: "root" },
            timestamp: 19,
          },
        ],
      },
    });
    expect(created).toEqual({
      type: "world:created",
      timestamp: 22,
      world: ctx.lineageCommit.world,
      from: ctx.completedProposal.baseWorld,
      proposalId: ctx.completedProposal.proposalId,
      outcome: "completed",
    });
    expect(forked).toEqual({
      type: "world:forked",
      timestamp: 23,
      branchId: ctx.completedProposal.branchId,
      forkPoint: ctx.completedProposal.baseWorld,
    });
  });
});

describe("@manifesto-ai/governance dispatcher", () => {
  it("emits completion and rejection events in governance order", () => {
    const ctx = bootstrap();
    const events: unknown[] = [];
    const dispatcher = createGovernanceEventDispatcher({
      service: ctx.governanceService,
      sink: {
        emit(event) {
          events.push(event);
        },
      },
      now: () => 100,
    });

    dispatcher.emitSealCompleted(ctx.governanceCommit, ctx.lineageCommit);
    dispatcher.emitSealRejected(ctx.governanceCommit, {
      kind: "self_loop",
      computedWorldId: ctx.lineageCommit.worldId,
      message: "rejected",
    });

    expect(events).toEqual([
      {
        type: "world:created",
        timestamp: 100,
        world: ctx.lineageCommit.world,
        from: ctx.completedProposal.baseWorld,
        proposalId: ctx.completedProposal.proposalId,
        outcome: "completed",
      },
      {
        type: "world:forked",
        timestamp: 100,
        branchId: ctx.completedProposal.branchId,
        forkPoint: ctx.completedProposal.baseWorld,
      },
      {
        type: "execution:completed",
        timestamp: 100,
        proposalId: ctx.completedProposal.proposalId,
        executionKey: ctx.completedProposal.executionKey,
        resultWorld: ctx.completedProposal.resultWorld,
      },
      {
        type: "execution:seal_rejected",
        timestamp: 100,
        proposalId: ctx.completedProposal.proposalId,
        executionKey: ctx.completedProposal.executionKey,
        rejection: {
          kind: "self_loop",
          computedWorldId: ctx.lineageCommit.worldId,
          message: "rejected",
        },
      },
    ]);
  });
});
