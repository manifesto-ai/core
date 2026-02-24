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
        const nextData = (data as Record<string, unknown> | undefined) ?? {};
        currentSnapshot = makeSnapshot(nextData);
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
    expect(host.reset).toHaveBeenCalledWith(baseSnapshot.data);
    expect(result.outcome).toBe("completed");
    expect(result.terminalSnapshot).toBe(currentSnapshot);
    expect(result.terminalSnapshot.data).toMatchObject({
      count: 3,
      nested: { flag: true },
      $host: {},
      $mel: { guards: { intent: {} } },
    });
  });

  it("RT-HEXEC-4: HostExecutor must route dispatch by ExecutionKey-derived intentId", async () => {
    const baseSnapshot = makeSnapshot({ count: 4 });

    const host = {
      dispatch: vi.fn(async () => ({
        status: "complete" as const,
        snapshot: baseSnapshot,
      })),
      registerEffect: vi.fn(),
      getRegisteredEffectTypes: vi.fn(() => []),
      reset: vi.fn(async (data: unknown) => {
        expect(data).toEqual(baseSnapshot.data);
      }),
    } as Host;

    const executor = createAppHostExecutor(host);
    const executionKey = "proposal:abc";

    await executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: {},
      intentId: executionKey,
    });

    expect(host.reset).toHaveBeenCalledTimes(1);
    expect(host.dispatch).toHaveBeenCalledTimes(1);
    expect(host.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "increment",
        intentId: executionKey,
      })
    );
  });
});
