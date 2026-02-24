import { describe, expect, it, vi } from "vitest";
import type { Snapshot } from "@manifesto-ai/core";
import type { Host } from "../../../types/index.js";
import { createAppHostExecutor } from "../../../execution/host-executor/index.js";

function makeSnapshot(
  data: Record<string, unknown> = {},
  schemaHash = "schema-compliance"
): Snapshot {
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

describe("Runtime HostExecutor compliance", () => {
  type HostDispatchResult = {
    status: "complete";
    snapshot: Snapshot;
    error?: unknown;
  };

  it("RT-HEXEC-1 / RT-HEXEC-3: AppHostExecutor should execute against provided base snapshot", async () => {
    const baseSnapshot = makeSnapshot({
      count: 3,
      nested: { flag: true },
      $mel: { guards: { intent: {} } },
      $host: {},
    });

    let currentSnapshot = makeSnapshot({ stale: true });
    const host = {
      dispatch: vi.fn(async () => ({
        status: "complete" as const,
        snapshot: currentSnapshot,
      })),
      registerEffect: vi.fn(),
      getRegisteredEffectTypes: vi.fn(() => []),
      reset: vi.fn(async (data: unknown) => {
        currentSnapshot = (data as Snapshot) ?? makeSnapshot({});
      }),
    } as Host;

    const executor = createAppHostExecutor(host);
    const result = await executor.execute("ek-compliance", baseSnapshot, {
      type: "increment",
      input: {},
      intentId: "intent-1",
    });

    expect(host.dispatch).toHaveBeenCalledTimes(1);
    expect(host.reset).toHaveBeenCalledTimes(1);
    expect(host.reset).toHaveBeenCalledWith(baseSnapshot);
    expect(result.outcome).toBe("completed");
    expect(result.terminalSnapshot).toBe(currentSnapshot);
    expect(result.terminalSnapshot.data).toMatchObject({
      count: 3,
      nested: { flag: true },
      $host: {},
      $mel: { guards: { intent: {} } },
    });
  });

  it("RT-HEXEC-4: HostExecutor must dispatch to Mailbox via ExecutionKey", async () => {
    const baseSnapshot = makeSnapshot({ count: 4 });

    const host = {
      dispatch: vi.fn(async () => ({
        status: "complete" as const,
        snapshot: baseSnapshot,
      })),
      registerEffect: vi.fn(),
      getRegisteredEffectTypes: vi.fn(() => []),
      reset: vi.fn(async (data: unknown) => {
        expect(data).toEqual(baseSnapshot);
      }),
    } as Host;

    const executor = createAppHostExecutor(host);
    const executionKey = "proposal:abc";

    await executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: {},
      intentId: `${executionKey}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    });

    expect(host.reset).toHaveBeenCalledTimes(1);
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    expect(host.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "increment",
        intentId: expect.stringMatching(/^proposal:abc_/),
      }),
      { key: executionKey }
    );
  });

  it("RT-HEXEC-4: same ExecutionKey must wait for prior Host dispatch completion", async () => {
    const baseSnapshot = makeSnapshot({ count: 8 });
    const pendingDispatches: Array<(result: HostDispatchResult) => void> = [];
    const host = {
      dispatch: vi.fn(
        async () =>
          new Promise<HostDispatchResult>((resolve) => {
            pendingDispatches.push(resolve);
          })
      ),
      registerEffect: vi.fn(),
      getRegisteredEffectTypes: vi.fn(() => []),
      reset: vi.fn(async () => {}),
    } as Host;

    const executor = createAppHostExecutor(host);
    const executionKey = "proposal-serial";

    const first = executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: { step: 1 },
      intentId: "intent-1",
    });
    await vi.waitFor(() => expect(host.dispatch).toHaveBeenCalledTimes(1), { timeout: 1_000 });
    expect(host.dispatch).toHaveBeenCalledTimes(1);

    const second = executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: { step: 2 },
      intentId: "intent-2",
    });

    await vi.waitFor(() => expect(host.dispatch).toHaveBeenCalledTimes(1), { timeout: 1_000 });
    expect(host.dispatch).toHaveBeenCalledTimes(1);

    pendingDispatches[0]({
      status: "complete",
      snapshot: baseSnapshot,
    });

    await expect(first).resolves.toMatchObject({ outcome: "completed" });

    await vi.waitFor(() => expect(host.dispatch).toHaveBeenCalledTimes(2), { timeout: 1_000 });
    expect(host.dispatch).toHaveBeenCalledTimes(2);
    expect(host.dispatch).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "increment", input: { step: 2 }, intentId: "intent-2" }),
      { key: executionKey }
    );

    pendingDispatches[1]({
      status: "complete",
      snapshot: baseSnapshot,
    });

    await expect(second).resolves.toMatchObject({ outcome: "completed" });
    expect(host.dispatch).toHaveBeenCalledTimes(2);
  });
});
