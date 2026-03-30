import { describe, expect, it } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
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
    genesis,
    lineageCommit,
    lineageService,
    governanceService,
    governanceCommit: {
      proposal: completedProposal,
      decisionRecord: approved.decisionRecord,
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
        currentError: {
          code: "ERR-1",
          message: "boom",
          source: { actionId: "action-1", nodePath: "root" },
          timestamp: 19,
        },
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
        currentError: {
          code: "ERR-1",
          message: "boom",
          source: { actionId: "action-1", nodePath: "root" },
          timestamp: 19,
        },
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
  it("emits completion events in governance order without fork noise on linear seals", () => {
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
        type: "execution:completed",
        timestamp: 100,
        proposalId: ctx.completedProposal.proposalId,
        executionKey: ctx.completedProposal.executionKey,
        resultWorld: ctx.completedProposal.resultWorld,
      },
    ]);
  });

  it("emits world:forked only when a seal creates a true fork", () => {
    const ctx = bootstrap();
    const events: unknown[] = [];
    ctx.lineageService.commitPrepared(ctx.lineageCommit);
    const branchId = ctx.lineageService.createBranch("fork", ctx.genesis.worldId);
    ctx.lineageService.switchActiveBranch(branchId);
    const proposal = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId,
      actorId: "actor-2",
      authorityId: "auth-1",
      intent: { type: "demo.intent", intentId: "intent-2" },
      executionKey: "prop-2:1",
      submittedAt: 30,
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });
    const approved = ctx.governanceService.prepareAuthorityResult(
      { ...proposal, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 31 }
    );

    if (!approved.decisionRecord) {
      throw new Error("expected decision record");
    }

    const lineageCommit = ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId,
      terminalSnapshot: createSnapshot({ count: 3 }),
      createdAt: 32,
      proposalRef: approved.proposal.proposalId,
      decisionRef: approved.decisionRecord.decisionId,
    });
    const dispatcher = createGovernanceEventDispatcher({
      service: ctx.governanceService,
      sink: {
        emit(event) {
          events.push(event);
        },
      },
      now: () => 200,
    });

    dispatcher.emitSealCompleted(
      {
        proposal: {
          ...approved.proposal,
          status: "completed",
          resultWorld: lineageCommit.worldId,
          completedAt: 33,
        },
        decisionRecord: approved.decisionRecord,
      },
      lineageCommit
    );

    expect(events).toEqual([
      {
        type: "world:created",
        timestamp: 200,
        world: lineageCommit.world,
        from: ctx.genesis.worldId,
        proposalId: approved.proposal.proposalId,
        outcome: "completed",
      },
      {
        type: "world:forked",
        timestamp: 200,
        branchId,
        forkPoint: ctx.genesis.worldId,
      },
      {
        type: "execution:completed",
        timestamp: 200,
        proposalId: approved.proposal.proposalId,
        executionKey: approved.proposal.executionKey,
        resultWorld: lineageCommit.worldId,
      },
    ]);
  });

  it("preserves sealed failure diagnostics in execution:failed events", () => {
    const ctx = bootstrap();
    const events: unknown[] = [];
    const proposal = ctx.governanceService.createProposal({
      baseWorld: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      actorId: "actor-3",
      authorityId: "auth-1",
      intent: { type: "demo.intent", intentId: "intent-3" },
      executionKey: "prop-3:1",
      submittedAt: 40,
      epoch: ctx.lineageService.getActiveBranch().epoch,
    });
    const approved = ctx.governanceService.prepareAuthorityResult(
      { ...proposal, status: "evaluating" },
      { kind: "approved", approvedScope: null },
      { decidedAt: 41 }
    );

    if (!approved.decisionRecord) {
      throw new Error("expected decision record");
    }

    const lineageCommit = ctx.lineageService.prepareSealNext({
      schemaHash: "schema-hash",
      baseWorldId: ctx.genesis.worldId,
      branchId: ctx.genesis.branchId,
      terminalSnapshot: createSnapshot(
        { count: 99 },
        {
          system: {
            status: "idle",
            lastError: {
              code: "ERR-PRIMARY",
              message: "Primary failure",
              source: { actionId: "action-1", nodePath: "root" },
              timestamp: 50,
            },
            errors: [
              {
                code: "ERR-PRIMARY",
                message: "Primary failure",
                source: { actionId: "action-1", nodePath: "root" },
                timestamp: 50,
              },
              {
                code: "ERR-SECONDARY",
                message: "Secondary failure",
                source: { actionId: "action-2", nodePath: "root.secondary" },
                timestamp: 51,
              },
            ],
            pendingRequirements: [
              {
                id: "req-1",
                type: "host.effect",
                params: {},
                actionId: "action-1",
                flowPosition: { nodePath: "root", snapshotVersion: 1 },
                createdAt: 52,
              },
            ],
            currentAction: null,
          },
        }
      ),
      createdAt: 42,
      proposalRef: approved.proposal.proposalId,
      decisionRef: approved.decisionRecord.decisionId,
    });
    const dispatcher = createGovernanceEventDispatcher({
      service: ctx.governanceService,
      sink: {
        emit(event) {
          events.push(event);
        },
      },
      now: () => 300,
    });

    dispatcher.emitSealCompleted(
      {
        proposal: {
          ...approved.proposal,
          status: "failed",
          resultWorld: lineageCommit.worldId,
          completedAt: 43,
        },
        decisionRecord: approved.decisionRecord,
      },
      lineageCommit
    );

    expect(events).toEqual([
      {
        type: "world:created",
        timestamp: 300,
        world: lineageCommit.world,
        from: ctx.genesis.worldId,
        proposalId: approved.proposal.proposalId,
        outcome: "failed",
      },
      {
        type: "execution:failed",
        timestamp: 300,
        proposalId: approved.proposal.proposalId,
        executionKey: approved.proposal.executionKey,
        resultWorld: lineageCommit.worldId,
        error: {
          summary: "Execution failed with 1 error(s) and 1 pending requirement(s)",
          currentError: {
            code: "ERR-PRIMARY",
            message: "Primary failure",
            source: { actionId: "action-1", nodePath: "root" },
            timestamp: 50,
          },
          pendingRequirements: ["req-1"],
        },
      },
    ]);
  });
});
