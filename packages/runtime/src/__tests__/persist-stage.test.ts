/**
 * Persist Stage Boundary Tests
 *
 * PUB-3 guard test for persist stage:
 * state:publish MUST remain once per proposal tick,
 * even if persist() is invoked multiple times for the same proposal context.
 */

import { describe, it, expect, vi } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import { createWorldId } from "@manifesto-ai/world";
import { ActionHandleImpl } from "../execution/action/handle.js";
import { persist } from "../execution/pipeline/persist.js";
import type { PipelineContext, PersistDeps } from "../execution/pipeline/types.js";

function createSnapshot(data: Record<string, unknown>): Snapshot {
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
      timestamp: Date.now(),
      randomSeed: "seed",
      schemaHash: "schema-hash",
    },
  };
}

describe("Persist Stage", () => {
  it("PUB-3 boundary: emits state:publish only once when persist() is re-invoked for same proposal", async () => {
    const handle = new ActionHandleImpl("prop_persist_once", "domain");
    const baseWorldId = createWorldId("base-world");

    const baseSnapshot = createSnapshot({ count: 0 });
    const terminalSnapshot = createSnapshot({ count: 2, done: true });

    const ctx: PipelineContext = {
      handle,
      actionType: "test.action",
      input: {},
      actorId: "human-1",
      branchId: "main",
      prepare: {
        proposal: {
          proposalId: handle.proposalId,
          actorId: "human-1",
          intentType: "test.action",
          intentBody: {},
          baseWorld: baseWorldId,
          branchId: "main",
          createdAt: Date.now(),
        },
        baseWorldId,
        baseWorldIdStr: String(baseWorldId),
      },
      execute: {
        execResult: {
          outcome: "completed",
          terminalSnapshot,
        },
        baseSnapshot,
        intent: {
          type: "test.action",
          input: {},
          intentId: "intent-1",
        },
      },
    };

    const wasPublishedState = { value: false };
    const emitHook = vi.fn().mockResolvedValue(undefined);

    const deps: PersistDeps = {
      domainSchema: {
        id: "test:persist-stage",
        version: "1.0.0",
        hash: "schema-hash",
        types: {},
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      },
      worldStore: {
        store: vi.fn().mockResolvedValue(undefined),
        restore: vi.fn().mockResolvedValue(terminalSnapshot),
        getWorld: vi.fn().mockResolvedValue(null),
        has: vi.fn().mockResolvedValue(false),
        getChildren: vi.fn().mockResolvedValue([]),
        getLineage: vi.fn().mockResolvedValue([]),
        saveBranchState: vi.fn().mockResolvedValue(undefined),
      },
      subscriptionStore: {
        notify: vi.fn(),
      },
      worldHeadTracker: {
        getCurrentHead: vi.fn().mockReturnValue(baseWorldId),
        getGenesisWorldId: vi.fn().mockReturnValue(baseWorldId),
        advanceHead: vi.fn(),
        setGenesisWorldId: vi.fn(),
        initialize: vi.fn(),
        isInitialized: vi.fn().mockReturnValue(true),
      },
      branchManager: {
        appendWorldToBranch: vi.fn(),
        toBranchSnapshot: vi.fn().mockReturnValue({ branches: [], activeBranchId: "main" }),
      },
      proposalManager: {
        createHandle: vi.fn(),
        getHandle: vi.fn(),
        hasHandle: vi.fn(),
        markPublished: vi.fn().mockImplementation(() => {
          wasPublishedState.value = true;
        }),
        wasPublished: vi.fn().mockImplementation(() => wasPublishedState.value),
        cleanup: vi.fn(),
        generateProposalId: vi.fn(),
      },
      lifecycleManager: {
        status: "ready",
        hooks: {
          on: vi.fn(),
          off: vi.fn(),
          emit: vi.fn(),
        },
        transitionTo: vi.fn(),
        emitHook,
        ensureReady: vi.fn(),
        isDisposed: vi.fn().mockReturnValue(false),
        createHookContext: vi.fn(),
        setAppRef: vi.fn(),
        getHookableImpl: vi.fn(),
      },
      getCurrentState: vi.fn(),
      setCurrentState: vi.fn(),
    } as unknown as PersistDeps;

    await persist(ctx, deps);
    await persist(ctx, deps);

    expect(deps.proposalManager.wasPublished).toHaveBeenCalledTimes(2);
    expect(deps.proposalManager.markPublished).toHaveBeenCalledTimes(1);
    expect(emitHook).toHaveBeenCalledTimes(1);
    expect(emitHook).toHaveBeenCalledWith(
      "state:publish",
      expect.objectContaining({
        worldId: expect.any(String),
        snapshot: expect.objectContaining({
          data: terminalSnapshot.data,
        }),
      }),
      expect.objectContaining({
        actorId: "human-1",
        branchId: "main",
      })
    );
  });
});
