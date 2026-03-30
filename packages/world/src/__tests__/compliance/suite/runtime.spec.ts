import { describe, expect, it, vi } from "vitest";
import type { Proposal, WorldExecutor } from "../../../index.js";
import { FacadeCasMismatchError } from "../../../facade/internal/errors.js";
import {
  createFacadeHarness,
  createExecutingProposal,
  createSnapshot,
  sealStandaloneGenesis,
} from "../../facade/helpers.js";
import { caseTitle, WFCTS_CASES } from "../wfcts-coverage.js";
import { evaluateRule, expectAllCompliance } from "../wfcts-assertions.js";
import { getRuleOrThrow } from "../wfcts-rules.js";

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

function createComputingSnapshot() {
  return createSnapshot(
    { count: 2 },
    {
      system: {
        status: "computing",
        lastError: null,
        pendingRequirements: [],
        errors: [],
        currentAction: "demo.intent",
      },
    }
  );
}

describe("WFCTS Runtime Suite", () => {
  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_HAPPY_PATH,
      "WorldRuntime loads the base snapshot from lineage, forwards execution inputs losslessly, and seals completed outcomes atomically."
    ),
    async () => {
      const harness = createFacadeHarness({
        executorResult: {
          outcome: "completed",
          terminalSnapshot: createSnapshot({ count: 2 }),
        },
      });
      const { world } = await sealStandaloneGenesis(harness);
      const baseSnapshot = await harness.lineage.getSnapshot(world!.worldId);
      const { proposal } = await createExecutingProposal(harness);
      const tamperedProposal: Proposal = {
        ...proposal,
        approvedScope: { unsafe: true },
        intent: {
          ...proposal.intent,
          input: { count: 999 },
        },
      };

      const result = await harness.world.runtime.executeApprovedProposal({
        proposal: tamperedProposal,
        completedAt: 20,
        executionOptions: {
          approvedScope: { unsafe: true },
          timeoutMs: 50,
        },
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-1"),
          harness.executionCalls[0]?.baseSnapshot !== undefined &&
            JSON.stringify(harness.executionCalls[0]?.baseSnapshot) ===
              JSON.stringify(baseSnapshot),
          {
            passMessage:
              "Runtime loaded the executor base snapshot from proposal.baseWorld in lineage.",
            failMessage:
              "Runtime did not load the executor base snapshot from proposal.baseWorld in lineage.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-2"),
          harness.executionCalls[0]?.key === proposal.executionKey &&
            JSON.stringify(harness.executionCalls[0]?.intent) ===
              JSON.stringify(proposal.intent) &&
            JSON.stringify(harness.executionCalls[0]?.intent) !==
              JSON.stringify(tamperedProposal.intent) &&
            harness.executionCalls[0]?.opts?.approvedScope === null &&
            harness.executionCalls[0]?.opts?.timeoutMs === 50,
          {
            passMessage:
              "Runtime forwarded proposal.executionKey, proposal.intent, and effective execution options to the executor unchanged.",
            failMessage:
              "Runtime did not forward execution inputs and effective execution options to the executor unchanged.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-3"),
          result.kind === "sealed" &&
            result.proposal.status === "completed" &&
            result.sealResult.kind === "sealed" &&
            (await harness.store.getProposal(proposal.proposalId))?.resultWorld ===
              result.resultWorld,
          {
            passMessage:
              "Runtime completed execution and persisted the resulting governed seal atomically.",
            failMessage:
              "Runtime did not persist the completed governed seal as expected.",
          }
        ),
      ]);

      expect(result.proposal.status).toBe("completed");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_FAILED_PATH,
      "WorldRuntime seals failed terminal snapshots through the same governed transaction path and preserves failure events."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-3"),
          result.kind === "sealed" &&
            result.proposal.status === "failed" &&
            result.lineageCommit.terminalStatus === "failed" &&
            harness.events.at(-1)?.type === "execution:failed",
          {
            passMessage:
              "Runtime used the same governed seal path for failed terminal snapshots.",
            failMessage:
              "Runtime did not preserve the governed failure seal path.",
          }
        ),
      ]);

      expect(result.proposal.status).toBe("failed");
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_EXECUTING_GUARD,
      "WorldRuntime rejects proposals that are not already executing before calling the executor."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-4"),
          executor.execute.mock.calls.length === 0,
          {
            passMessage:
              "Runtime refused non-executing proposals before invoking the executor.",
            failMessage:
              "Runtime invoked the executor for a proposal that was not executing.",
          }
        ),
      ]);
    }
  );

  it("rejects executing proposals that are missing from store before invoking the executor", async () => {
      const executor: WorldExecutor = {
        execute: vi.fn(async () => ({
          outcome: "completed",
          terminalSnapshot: createSnapshot({ count: 2 }),
        })),
      };
      const harness = createFacadeHarness({ executor });
      const { world } = await sealStandaloneGenesis(harness);
      const branch = await harness.lineage.getActiveBranch();
      const proposal = harness.governance.createProposal({
        proposalId: "missing-proposal",
        baseWorld: world!.worldId,
        branchId: branch.id,
        actorId: "actor-1",
        authorityId: "auth-1",
        intent: {
          type: "demo.intent",
          intentId: "intent-missing",
          input: { count: 2 },
        },
        executionKey: "exec-missing",
        submittedAt: 10,
        epoch: branch.epoch,
      });
      const executingProposal: Proposal = {
        ...proposal,
        status: "executing",
        decisionId: "dec-missing",
        decidedAt: 11,
      };

      await expect(
        harness.world.runtime.executeApprovedProposal({
          proposal: executingProposal,
          completedAt: 20,
        })
      ).rejects.toThrow(/FACADE-RUNTIME-11/);
      expect(executor.execute.mock.calls.length).toBe(0);
    });

  it("rejects executing proposals when execution-stage ownership disappears before dispatch", async () => {
      const executor: WorldExecutor = {
        execute: vi.fn(async () => ({
          outcome: "completed",
          terminalSnapshot: createSnapshot({ count: 2 }),
        })),
      };
      const harness = createFacadeHarness({ executor });
      await sealStandaloneGenesis(harness);
      const { proposal } = await createExecutingProposal(harness);

      vi.spyOn(harness.store, "getExecutionStageProposal").mockResolvedValue(null);

      await expect(
        harness.world.runtime.executeApprovedProposal({
          proposal,
          completedAt: 20,
        })
      ).rejects.toThrow(/FACADE-RUNTIME-11/);

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-11"),
          executor.execute.mock.calls.length === 0,
          {
            passMessage:
              "Runtime treated missing execution-stage ownership as stale currentness and refused to dispatch.",
            failMessage:
              "Runtime accepted a proposal after its execution-stage ownership disappeared.",
          }
        ),
      ]);
    });

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_OUTCOME_GUARD,
      "WorldRuntime rejects executor outcomes that disagree with the terminal snapshot outcome."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-5"),
          harness.events.length === 0 &&
            (await harness.store.getProposal(proposal.proposalId))?.status ===
              "executing",
          {
            passMessage:
              "Runtime rejected the mismatched executor outcome before any seal or event dispatch occurred.",
            failMessage:
              "Runtime accepted or partially committed a mismatched executor outcome.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_TERMINAL_RESUME,
      "WorldRuntime exposes explicit resume, seals terminal resume snapshots without re-invoking the executor, and preserves the governed path."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-6"),
          typeof harness.world.runtime.resumeExecutingProposal === "function",
          {
            passMessage:
              "Runtime exposes the explicit resumeExecutingProposal() recovery entrypoint.",
            failMessage:
              "Runtime does not expose the explicit resumeExecutingProposal() recovery entrypoint.",
          }
        ),
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-7"),
          executor.execute.mock.calls.length === 0 &&
            result.kind === "sealed" &&
            result.execution.terminalSnapshot === resumeSnapshot &&
            result.proposal.status === "completed",
          {
            passMessage:
              "Runtime sealed the terminal resume snapshot directly without re-invoking the executor.",
            failMessage:
              "Runtime did not seal the terminal resume snapshot directly.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_REPLAY_RECOVERY,
      "WorldRuntime converges replayed terminal proposals to recovered completions without duplicate execution or duplicate events."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-8"),
          first.kind === "sealed" &&
            replay.kind === "recovered" &&
            harness.executionCalls.length === 1 &&
            harness.events.length === eventCountAfterFirstSeal &&
            replay.resultWorld === first.resultWorld,
          {
            passMessage:
              "Runtime replay converged to a recovered completion without duplicate execution or duplicate event emission.",
            failMessage:
              "Runtime replay did not converge cleanly to a recovered completion.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_NON_TERMINAL_RESUME,
      "WorldRuntime resumes non-terminal snapshots from the supplied resumeSnapshot instead of proposal.baseWorld."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-9"),
          result.kind === "sealed" &&
            harness.executionCalls[0]?.baseSnapshot === resumeSnapshot &&
            JSON.stringify(harness.executionCalls[0]?.baseSnapshot) !==
              JSON.stringify(baseSnapshot),
          {
            passMessage:
              "Runtime resumed execution from the supplied resumeSnapshot rather than reloading proposal.baseWorld.",
            failMessage:
              "Runtime did not resume execution from the supplied resumeSnapshot.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_NON_TERMINAL_RESUME,
      "WorldRuntime treats computing resume snapshots as non-terminal and re-invokes the executor from that checkpoint."
    ),
    async () => {
      const resumeSnapshot = createComputingSnapshot();
      const harness = createFacadeHarness({
        executorResult: {
          outcome: "completed",
          terminalSnapshot: createSnapshot({ count: 4 }),
        },
      });
      await sealStandaloneGenesis(harness);
      const { proposal } = await createExecutingProposal(harness);

      const result = await harness.world.runtime.resumeExecutingProposal({
        proposal,
        resumeSnapshot,
        completedAt: 20,
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-9"),
          result.kind === "sealed"
            && harness.executionCalls.length === 1
            && harness.executionCalls[0]?.baseSnapshot === resumeSnapshot
            && JSON.stringify(result.execution.terminalSnapshot) !== JSON.stringify(resumeSnapshot),
          {
            passMessage:
              "Runtime treated a computing resume snapshot as non-terminal and resumed execution from that checkpoint.",
            failMessage:
              "Runtime incorrectly treated a computing resume snapshot as terminal.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_STALE_GUARD,
      "WorldRuntime rejects stale executing proposals whose branch head or epoch moved past proposal.baseWorld."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-10"),
          harness.executionCalls.length === 0,
          {
            passMessage:
              "Runtime refused the stale executing proposal before invoking the executor.",
            failMessage:
              "Runtime attempted to execute a stale proposal after branch head/epoch had advanced.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_RACE_RECOVERY,
      "WorldRuntime converges seal races to recovered completions when another writer commits the proposal first."
    ),
    async () => {
      const terminalSnapshot = createSnapshot({ count: 2 });
      const harness = createFacadeHarness({
        executorResult: {
          outcome: "completed",
          terminalSnapshot,
        },
      });
      const { world } = await sealStandaloneGenesis(harness);
      const { proposal, decisionRecord } = await createExecutingProposal(harness);
      const originalPrepareSealNext = harness.lineage.prepareSealNext.bind(
        harness.lineage
      );
      const originalRunInSealTransaction = harness.store.runInSealTransaction.bind(
        harness.store
      );

      vi.spyOn(harness.lineage, "prepareSealNext")
        .mockImplementationOnce(async (sealInput) => {
          const lineageCommit = await originalPrepareSealNext(sealInput);
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
          return originalPrepareSealNext(sealInput);
        })
        .mockImplementation(async (sealInput) => originalPrepareSealNext(sealInput));

      const result = await harness.world.runtime.executeApprovedProposal({
        proposal,
        completedAt: 20,
      });

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-11"),
          result.kind === "recovered" &&
            harness.executionCalls.length === 1 &&
            (await harness.store.getProposal(proposal.proposalId))?.resultWorld ===
              result.resultWorld,
          {
            passMessage:
              "Runtime converged the seal race to a recovered completion after another writer committed first.",
            failMessage:
              "Runtime did not converge the seal race to a recovered completion.",
          }
        ),
      ]);
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_ABORT_FORWARD,
      "WorldRuntime forwards abort signals to WorldExecutor.abort() while execution is in flight."
    ),
    async () => {
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
    }
  );

  it(
    caseTitle(
      WFCTS_CASES.RUNTIME_DISPATCH_FAILURE,
      "WorldRuntime surfaces post-commit event dispatch failures instead of converting them to recovered completions."
    ),
    async () => {
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

      expectAllCompliance([
        evaluateRule(
          getRuleOrThrow("FACADE-RUNTIME-13"),
          (await harness.store.getProposal(proposal.proposalId))?.status ===
            "completed" && harness.executionCalls.length === 1,
          {
            passMessage:
              "Runtime surfaced the post-commit dispatch failure instead of converting it into a recovered completion.",
            failMessage:
              "Runtime swallowed the post-commit dispatch failure or converted it into a recovered completion.",
          }
        ),
      ]);
    }
  );
});
