import { describe, expect, it, vi } from "vitest";
import type { Proposal, WorldExecutor } from "../../index.js";
import { FacadeCasMismatchError } from "../../facade/internal/errors.js";
import {
  createFacadeHarness,
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
} from "./helpers.js";

function createFailedSnapshot(message = "boom") {
  return createSnapshot(
    { count: 2 },
    {
      system: {
        status: "error",
        lastError: {
          code: "HOST_FAIL",
          message,
          source: {
            actionId: "host.dispatch",
            nodePath: "execute",
          },
          timestamp: 20,
        },
        pendingRequirements: [],
        errors: [],
        currentAction: null,
      },
    }
  );
}

function createPendingSnapshot() {
  return createSnapshot(
    { count: 1 },
    {
      system: {
        status: "pending",
        lastError: null,
        pendingRequirements: [
          {
            id: "req-1",
            type: "io.wait",
            params: { ms: 1 },
            actionId: "demo.intent",
            flowPosition: {
              nodePath: "actions.demo.flow",
              snapshotVersion: 1,
            },
            createdAt: 11,
          },
        ],
        errors: [],
        currentAction: "demo.intent",
      },
    }
  );
}

describe("@manifesto-ai/world facade runtime", () => {
  it("executes an executing proposal from lineage baseWorld and seals the completed terminal snapshot", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 2 }),
      },
    });
    const { world } = await sealStandaloneGenesis(harness);
    const baseSnapshot = await harness.lineage.getSnapshot(world!.worldId);
    const { proposal } = await createExecutingProposal(harness);

    const result = await harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 20,
      executionOptions: {
        timeoutMs: 50,
      },
    });

    expect(result.kind).toBe("sealed");
    if (result.kind !== "sealed") {
      throw new Error("expected sealed runtime completion");
    }
    expect(harness.executionCalls).toHaveLength(1);
    expect(harness.executionCalls[0]?.key).toBe(proposal.executionKey);
    expect(harness.executionCalls[0]?.intent).toEqual(proposal.intent);
    expect(harness.executionCalls[0]?.baseSnapshot).toEqual(baseSnapshot);
    expect(harness.executionCalls[0]?.opts).toEqual({
      approvedScope: null,
      timeoutMs: 50,
    });
    expect(result.proposal.status).toBe("completed");
    expect(result.sealResult.kind).toBe("sealed");
    expect(result.lineageCommit.terminalStatus).toBe("completed");
    expect((await harness.store.getProposal(proposal.proposalId))?.resultWorld).toBe(
      result.resultWorld
    );
    expect(harness.events.map((event) => event.type)).toEqual([
      "world:created",
      "execution:completed",
    ]);
  });

  it("seals failed terminal snapshots through the same governed path", async () => {
    const terminalSnapshot = createFailedSnapshot();
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "failed",
        terminalSnapshot,
        error: terminalSnapshot.system.lastError ?? undefined,
      },
    });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);

    const result = await harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 20,
    });

    expect(result.kind).toBe("sealed");
    if (result.kind !== "sealed") {
      throw new Error("expected sealed runtime completion");
    }
    expect(result.execution.outcome).toBe("failed");
    expect(result.proposal.status).toBe("failed");
    expect(result.lineageCommit.terminalStatus).toBe("failed");
    expect(harness.events.map((event) => event.type)).toEqual([
      "world:created",
      "execution:failed",
    ]);
  });

  it("rejects non-executing proposals before invoking the executor", async () => {
    const executor: WorldExecutor = {
      execute: vi.fn(async () => ({
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 2 }),
      })),
    };
    const harness = createFacadeHarness({ executor });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);
    const approvedProposal: Proposal = {
      ...proposal,
      status: "approved",
    };

    await expect(
      harness.world.runtime.executeApprovedProposal({
        proposal: approvedProposal,
        completedAt: 20,
      })
    ).rejects.toThrow(/FACADE-RUNTIME-4/);
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("rejects executor outcomes that disagree with the terminal snapshot outcome", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createFailedSnapshot("mismatch"),
      },
    });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);

    await expect(
      harness.world.runtime.executeApprovedProposal({
        proposal,
        completedAt: 20,
      })
    ).rejects.toThrow(/FACADE-RUNTIME-5/);
    expect(harness.events).toHaveLength(0);
  });

  it("rejects stale executing proposals when branch head or epoch moved past proposal.baseWorld", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 2 }),
      },
    });
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);
    const activeBranch = await harness.lineage.getActiveBranch();

    const staleAdvance = await harness.lineage.prepareSealNext({
      schemaHash: "wfcts-schema",
      baseWorldId: world!.worldId,
      branchId: activeBranch.id,
      terminalSnapshot: createSnapshot({ count: 99 }),
      createdAt: 18,
      proposalRef: "prop-external",
      decisionRef: "dec-external",
    });
    await harness.lineage.commitPrepared(staleAdvance);

    await expect(
      harness.world.runtime.executeApprovedProposal({
        proposal,
        completedAt: 20,
      })
    ).rejects.toThrow(/FACADE-RUNTIME-11/);
    expect(harness.executionCalls).toHaveLength(0);
  });

  it("resumes terminal snapshots without calling the executor and seals them directly", async () => {
    const executor: WorldExecutor = {
      execute: vi.fn(async () => ({
        outcome: "completed",
        terminalSnapshot: createSnapshot({ unreachable: true }),
      })),
    };
    const harness = createFacadeHarness({ executor });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);
    const resumeSnapshot = createSnapshot({ count: 3 });

    const result = await harness.world.runtime.resumeExecutingProposal({
      proposal,
      resumeSnapshot,
      completedAt: 20,
    });

    expect(result.kind).toBe("sealed");
    if (result.kind !== "sealed") {
      throw new Error("expected sealed runtime completion");
    }
    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.execution.terminalSnapshot).toEqual(resumeSnapshot);
    expect(result.proposal.status).toBe("completed");
    expect((await harness.store.getProposal(proposal.proposalId))?.resultWorld).toBe(
      result.resultWorld
    );
    expect(harness.events.map((event) => event.type)).toEqual([
      "world:created",
      "execution:completed",
    ]);
  });

  it("replays already sealed proposals as recovered without duplicate execution or events", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 2 }),
      },
    });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);

    const first = await harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 20,
    });
    const eventCountAfterFirstSeal = harness.events.length;

    const replay = await harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 21,
    });

    expect(first.kind).toBe("sealed");
    expect(replay.kind).toBe("recovered");
    expect(harness.executionCalls).toHaveLength(1);
    expect(harness.events).toHaveLength(eventCountAfterFirstSeal);
    expect(replay.proposal.proposalId).toBe(proposal.proposalId);
    expect(replay.resultWorld).toBe(first.resultWorld);
    expect(replay.terminalStatus).toBe("completed");
  });

  it("recovers from seal races when another writer commits the same proposal first", async () => {
    const terminalSnapshot = createSnapshot({ count: 2 });
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot,
      },
    });
    const { world } = await sealStandaloneGenesis(harness);
    const { proposal, decisionRecord } = await createExecutingProposal(harness);
    const originalRunInSealTransaction =
      harness.store.runInSealTransaction.bind(harness.store);

    vi.spyOn(harness.store, "runInSealTransaction")
      .mockImplementationOnce(async () => {
        const activeBranch = await harness.lineage.getActiveBranch();
        const lineageCommit = await harness.lineage.prepareSealNext({
          schemaHash: "wfcts-schema",
          baseWorldId: world!.worldId,
          branchId: activeBranch.id,
          terminalSnapshot,
          createdAt: 20,
          proposalRef: proposal.proposalId,
          decisionRef: decisionRecord.decisionId,
        });
        const governanceCommit = await harness.governance.finalize(
          proposal,
          lineageCommit,
          20
        );
        await originalRunInSealTransaction(async (tx) => {
          await tx.commitPrepared(lineageCommit);
          await tx.putProposal(governanceCommit.proposal);
          await tx.putDecisionRecord(governanceCommit.decisionRecord);
        });
        throw new FacadeCasMismatchError(
          "simulated CAS mismatch after competing seal"
        );
      })
      .mockImplementation(async (work) => originalRunInSealTransaction(work));

    const result = await harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 20,
    });

    expect(result.kind).toBe("recovered");
    expect(result.resultWorld).toBe(
      (await harness.store.getProposal(proposal.proposalId))?.resultWorld
    );
    expect(harness.executionCalls).toHaveLength(1);
    expect(harness.events).toHaveLength(0);
  });

  it("surfaces post-commit event dispatch failures instead of converting them to recovered completions", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 2 }),
      },
    });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);

    vi.spyOn(harness.eventDispatcher, "emitSealCompleted").mockImplementation(() => {
      throw new Error("dispatch failed");
    });

    await expect(
      harness.world.runtime.executeApprovedProposal({
        proposal,
        completedAt: 20,
      })
    ).rejects.toThrow("dispatch failed");

    expect(harness.executionCalls).toHaveLength(1);
    expect((await harness.store.getProposal(proposal.proposalId))?.status).toBe(
      "completed"
    );
  });

  it("forwards abort signals to the executor abort hook while waiting for execution", async () => {
    let resolveExecution!: (value: {
      outcome: "completed";
      terminalSnapshot: ReturnType<typeof createSnapshot>;
    }) => void;
    const abort = vi.fn();
    const executor: WorldExecutor = {
      abort,
      execute: vi.fn(
        () =>
          new Promise((resolve) => {
            resolveExecution = resolve;
          })
      ),
    };
    const harness = createFacadeHarness({ executor });
    await sealStandaloneGenesis(harness);
    const { proposal } = await createExecutingProposal(harness);
    const controller = new AbortController();

    const pending = harness.world.runtime.executeApprovedProposal({
      proposal,
      completedAt: 20,
      executionOptions: {
        signal: controller.signal,
      },
    });

    await vi.waitFor(() => {
      expect(executor.execute).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    await vi.waitFor(() => {
      expect(abort).toHaveBeenCalledWith(proposal.executionKey);
    });

    resolveExecution({
      outcome: "completed",
      terminalSnapshot: createSnapshot({ count: 5 }),
    });

    const result = await pending;
    expect(result.kind).toBe("sealed");
    expect(result.proposal.status).toBe("completed");
  });

  it("resumes non-terminal snapshots from the provided resumeSnapshot rather than proposal.baseWorld", async () => {
    const harness = createFacadeHarness({
      executorResult: {
        outcome: "completed",
        terminalSnapshot: createSnapshot({ count: 4 }),
      },
    });
    const { world } = await sealStandaloneGenesis(harness);
    const baseSnapshot = await harness.lineage.getSnapshot(world!.worldId);
    const resumeSnapshot = createPendingSnapshot();
    const { proposal } = await createExecutingProposal(harness);

    const result = await harness.world.runtime.resumeExecutingProposal({
      proposal,
      resumeSnapshot,
      completedAt: 20,
      executionOptions: {
        timeoutMs: 75,
      },
    });

    expect(result.kind).toBe("sealed");
    expect(harness.executionCalls).toHaveLength(1);
    expect(harness.executionCalls[0]?.baseSnapshot).toEqual(resumeSnapshot);
    expect(harness.executionCalls[0]?.baseSnapshot).not.toEqual(baseSnapshot);
    expect(harness.executionCalls[0]?.opts).toEqual({
      approvedScope: null,
      timeoutMs: 75,
    });
  });
});
