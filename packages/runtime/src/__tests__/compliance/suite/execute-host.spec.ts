import { describe, expect, it, vi } from "vitest";
import { createWorldId } from "@manifesto-ai/world";
import { ActionHandleImpl } from "../../../execution/action/index.js";
import { executeHost } from "../../../execution/pipeline/execute.js";
import { normalizeSnapshot, snapshotToAppState } from "../../../state/index.js";
import type { ExecuteDeps, PipelineContext } from "../../../execution/pipeline/types.js";
import { IncompatiblePatchFormatError } from "../../../errors/index.js";

/**
 * Minimal Snapshot fixture for pipeline tests.
 */
function makeSnapshot(
  data: Record<string, unknown> = {},
  schemaHash = "schema-compliance"
): import("@manifesto-ai/core").Snapshot {
  return {
    data,
    computed: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    input: {},
    meta: {
      version: 1,
      timestamp: 1_700_000_000_000,
      randomSeed: "seed",
      schemaHash,
    },
  };
}

describe("Runtime execute stage compliance", () => {
  it("RT-HEXEC-1 / RT-LC-3: execute() must pass world-restored base snapshot to HostExecutor", async () => {
    const baseWorldId = createWorldId("base-world");
    const baseSnapshot = makeSnapshot({
      count: 10,
      $host: {},
      $mel: { guards: { intent: {} } },
    });
    const normalizedBaseSnapshot = normalizeSnapshot(baseSnapshot);

    const execResult = {
      outcome: "completed" as const,
      terminalSnapshot: makeSnapshot({
        count: 11,
        $host: {},
        $mel: { guards: { intent: {} } },
      }),
    };

    const hostExecutor = {
      execute: vi.fn().mockResolvedValue(execResult),
    };

    const worldStore = {
      restore: vi.fn().mockResolvedValue(baseSnapshot),
    };
    const memoryFacade = {
      recall: vi.fn(),
    };
    const policyService = {
      validateResultScope: vi.fn(),
    };

    const deps = {
      worldStore,
      memoryFacade,
      hostExecutor,
      policyService,
      schedulerOptions: { defaultTimeoutMs: 250 },
      getCurrentState: () => snapshotToAppState(baseSnapshot),
    } as unknown as ExecuteDeps;

    const handle = new ActionHandleImpl("proposal-compliance-1", "domain");
    const input = { delta: 1 };
    const ctx: PipelineContext = {
      handle,
      actionType: "increment",
      input,
      actorId: "actor-1",
      branchId: "main",
      prepare: {
        proposal: {
          proposalId: handle.proposalId,
          actorId: "actor-1",
          intentType: "increment",
          intentBody: input,
          baseWorld: baseWorldId,
          branchId: "main",
          createdAt: 1_700_000_000_000,
        },
        baseWorldId,
        baseWorldIdStr: String(baseWorldId),
      },
      authorize: {
        decision: {
          approved: true,
          timestamp: 1_700_000_000_001,
        },
        executionKey: "ek-compliance-1",
      },
    };

    await executeHost(ctx, deps);

    expect(worldStore.restore).toHaveBeenCalledWith(baseWorldId);
    expect(hostExecutor.execute).toHaveBeenCalledTimes(1);
    expect(hostExecutor.execute).toHaveBeenCalledWith(
      "ek-compliance-1",
      normalizedBaseSnapshot,
      expect.objectContaining({
        type: "increment",
        input,
      }),
      { approvedScope: undefined, timeoutMs: 250 }
    );
    expect(ctx.execute?.baseSnapshot).toEqual(normalizedBaseSnapshot);
    expect(ctx.execute?.execResult).toEqual(execResult);
    expect(ctx.execute?.intent.type).toBe("increment");
    expect(ctx.execute?.intent.intentId).toMatch(/^intent_ek-compliance-1_/);
  });

  it("RT-HEXEC-2: execute() must fall back to current app state when world restore fails", async () => {
    const fallbackState = makeSnapshot({ fallback: true });

    const fallbackCurrentState = snapshotToAppState(fallbackState);
    const hostExecutor = {
      execute: vi.fn().mockResolvedValue({
        outcome: "completed" as const,
        terminalSnapshot: makeSnapshot({ fallback: true, continued: true }),
      }),
    };

    const worldStore = {
      restore: vi.fn().mockRejectedValue(new Error("restore failed")),
    };
    const memoryFacade = {
      recall: vi.fn(),
    };
    const policyService = {};

    const deps = {
      worldStore,
      memoryFacade,
      hostExecutor,
      policyService,
      schedulerOptions: { defaultTimeoutMs: 300 },
      getCurrentState: () => fallbackCurrentState,
    } as unknown as ExecuteDeps;

    const handle = new ActionHandleImpl("proposal-compliance-2", "domain");
    const ctx: PipelineContext = {
      handle,
      actionType: "fallback",
      input: {},
      actorId: "actor-1",
      branchId: "main",
      prepare: {
        proposal: {
          proposalId: handle.proposalId,
          actorId: "actor-1",
          intentType: "fallback",
          intentBody: {},
          baseWorld: createWorldId("missing-world"),
          branchId: "main",
          createdAt: 1_700_000_000_000,
        },
        baseWorldId: createWorldId("missing-world"),
        baseWorldIdStr: "missing-world",
      },
      authorize: {
        decision: {
          approved: true,
          timestamp: 1_700_000_000_001,
        },
        executionKey: "ek-compliance-2",
      },
    };

    await executeHost(ctx, deps);

    expect(worldStore.restore).toHaveBeenCalled();
    expect(hostExecutor.execute).toHaveBeenCalledTimes(1);
    const hostCall = hostExecutor.execute.mock.calls[0];
    expect(hostCall?.[0]).toBe("ek-compliance-2");
    expect(hostCall?.[1]).toMatchObject({
      data: fallbackState.data,
    });
    expect(hostCall?.[2]).toMatchObject({
      type: "fallback",
      intentId: expect.stringMatching(/^intent_ek-compliance-2_/),
    });
    expect(hostCall?.[3]).toEqual({ approvedScope: undefined, timeoutMs: 300 });
  });

  it("RT-PATCHFMT-4: execute() must use genesis reset callback on incompatible patch format", async () => {
    const baseWorldId = createWorldId("legacy-world");
    const resetSnapshot = normalizeSnapshot(makeSnapshot({ reset: "genesis" }));

    const hostExecutor = {
      execute: vi.fn().mockResolvedValue({
        outcome: "completed" as const,
        terminalSnapshot: makeSnapshot({ reset: "genesis", after: true }),
      }),
    };

    const worldStore = {
      restore: vi.fn().mockRejectedValue(
        new IncompatiblePatchFormatError(String(baseWorldId), 1)
      ),
    };

    const resetToGenesisOnPatchFormatError = vi
      .fn()
      .mockResolvedValue(resetSnapshot);

    const deps = {
      worldStore,
      memoryFacade: { recall: vi.fn() },
      hostExecutor,
      policyService: {},
      schedulerOptions: { defaultTimeoutMs: 321 },
      getCurrentState: () => snapshotToAppState(makeSnapshot({ fallback: true })),
      resetToGenesisOnPatchFormatError,
    } as unknown as ExecuteDeps;

    const handle = new ActionHandleImpl("proposal-compliance-3", "domain");
    const ctx: PipelineContext = {
      handle,
      actionType: "repair",
      input: {},
      actorId: "actor-1",
      branchId: "main",
      prepare: {
        proposal: {
          proposalId: handle.proposalId,
          actorId: "actor-1",
          intentType: "repair",
          intentBody: {},
          baseWorld: baseWorldId,
          branchId: "main",
          createdAt: 1_700_000_000_000,
        },
        baseWorldId,
        baseWorldIdStr: String(baseWorldId),
      },
      authorize: {
        decision: {
          approved: true,
          timestamp: 1_700_000_000_001,
        },
        executionKey: "ek-compliance-3",
      },
    };

    await executeHost(ctx, deps);

    expect(resetToGenesisOnPatchFormatError).toHaveBeenCalledWith({
      error: expect.any(IncompatiblePatchFormatError),
      baseWorldId,
      branchId: "main",
    });
    expect(hostExecutor.execute).toHaveBeenCalledWith(
      "ek-compliance-3",
      resetSnapshot,
      expect.objectContaining({
        type: "repair",
      }),
      { approvedScope: undefined, timeoutMs: 321 }
    );
  });

  it("RT-PATCHFMT-5: execute() must rebase prepare baseWorldId when reset callback returns lineage anchor", async () => {
    const legacyBaseWorldId = createWorldId("legacy-world");
    const genesisWorldId = createWorldId("genesis-world");
    const resetSnapshot = normalizeSnapshot(makeSnapshot({ reset: "genesis" }));

    const hostExecutor = {
      execute: vi.fn().mockResolvedValue({
        outcome: "completed" as const,
        terminalSnapshot: makeSnapshot({ reset: "genesis", after: true }),
      }),
    };

    const worldStore = {
      restore: vi.fn().mockRejectedValue(
        new IncompatiblePatchFormatError(String(legacyBaseWorldId), 1)
      ),
    };

    const resetToGenesisOnPatchFormatError = vi
      .fn()
      .mockResolvedValue({
        snapshot: resetSnapshot,
        baseWorldId: genesisWorldId,
      });

    const deps = {
      worldStore,
      memoryFacade: { recall: vi.fn() },
      hostExecutor,
      policyService: {},
      schedulerOptions: { defaultTimeoutMs: 321 },
      getCurrentState: () => snapshotToAppState(makeSnapshot({ fallback: true })),
      resetToGenesisOnPatchFormatError,
    } as unknown as ExecuteDeps;

    const handle = new ActionHandleImpl("proposal-compliance-4", "domain");
    const ctx: PipelineContext = {
      handle,
      actionType: "repair",
      input: {},
      actorId: "actor-1",
      branchId: "main",
      prepare: {
        proposal: {
          proposalId: handle.proposalId,
          actorId: "actor-1",
          intentType: "repair",
          intentBody: {},
          baseWorld: legacyBaseWorldId,
          branchId: "main",
          createdAt: 1_700_000_000_000,
        },
        baseWorldId: legacyBaseWorldId,
        baseWorldIdStr: String(legacyBaseWorldId),
      },
      authorize: {
        decision: {
          approved: true,
          timestamp: 1_700_000_000_001,
        },
        executionKey: "ek-compliance-4",
      },
    };

    await executeHost(ctx, deps);

    expect(ctx.prepare?.baseWorldId).toBe(genesisWorldId);
    expect(ctx.prepare?.baseWorldIdStr).toBe(String(genesisWorldId));
    expect(ctx.prepare?.proposal.baseWorld).toBe(genesisWorldId);
    expect(hostExecutor.execute).toHaveBeenCalledWith(
      "ek-compliance-4",
      resetSnapshot,
      expect.objectContaining({
        type: "repair",
      }),
      { approvedScope: undefined, timeoutMs: 321 }
    );
  });
});
