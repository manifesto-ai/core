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

function createMockMailboxHost(overrides: Partial<Host> = {}): Host {
  return {
    seedSnapshot: vi.fn(),
    submitIntent: vi.fn(),
    drain: vi.fn(async () => {}),
    getContextSnapshot: vi.fn(() => makeSnapshot({})),
    hasPendingEffects: vi.fn(() => false),
    waitForPendingEffects: vi.fn(async () => {}),
    hasQueuedWork: vi.fn(() => false),
    releaseExecution: vi.fn(),
    dispatch: vi.fn(async () => ({
      status: "complete" as const,
      snapshot: makeSnapshot({}),
    })),
    registerEffect: vi.fn(),
    getRegisteredEffectTypes: vi.fn(() => []),
    ...overrides,
  } as Host;
}

describe("Runtime HostExecutor compliance", () => {
  it("RT-HEXEC-1 / RT-HEXEC-3: execute() MUST call seedSnapshot with typed Snapshot", async () => {
    const baseSnapshot = makeSnapshot({
      count: 3,
      nested: { flag: true },
      $mel: { guards: { intent: {} } },
      $host: {},
    });

    const terminalSnapshot = makeSnapshot({
      count: 3,
      nested: { flag: true },
      $mel: { guards: { intent: {} } },
      $host: {},
    });

    const host = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => terminalSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const result = await executor.execute("ek-compliance", baseSnapshot, {
      type: "increment",
      input: {},
      intentId: "intent-1",
    });

    // seedSnapshot called with typed Snapshot (not reset with unknown)
    expect(host.seedSnapshot).toHaveBeenCalledTimes(1);
    expect(host.seedSnapshot).toHaveBeenCalledWith("ek-compliance", baseSnapshot);
    expect(host.submitIntent).toHaveBeenCalledTimes(1);
    expect(host.drain).toHaveBeenCalled();
    expect(result.outcome).toBe("completed");
    expect(result.terminalSnapshot).toBe(terminalSnapshot);
    expect(result.terminalSnapshot.data).toMatchObject({
      count: 3,
      nested: { flag: true },
      $host: {},
      $mel: { guards: { intent: {} } },
    });
  });

  it("RT-HEXEC-4: submitIntent MUST be called with correct ExecutionKey", async () => {
    const baseSnapshot = makeSnapshot({ count: 4 });

    const host = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => baseSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const executionKey = "proposal:abc";

    await executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: {},
      intentId: "intent-route",
    });

    expect(host.seedSnapshot).toHaveBeenCalledWith(executionKey, baseSnapshot);
    expect(host.submitIntent).toHaveBeenCalledWith(
      executionKey,
      expect.objectContaining({
        type: "increment",
        intentId: "intent-route",
      })
    );
  });

  it("RT-HEXEC-DRAIN-1: execute() MUST run drain→waitForPendingEffects→re-drain loop", async () => {
    const baseSnapshot = makeSnapshot({ count: 0 });
    let drainCount = 0;

    const host = createMockMailboxHost({
      drain: vi.fn(async () => { drainCount++; }),
      // First drain cycle: effects are pending. Second cycle: no more effects.
      hasPendingEffects: vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false),
      waitForPendingEffects: vi.fn(async () => {}),
      getContextSnapshot: vi.fn(() => makeSnapshot({ count: 1 })),
    });

    const executor = createAppHostExecutor(host);
    await executor.execute("ek-drain", baseSnapshot, {
      type: "increment",
      input: {},
      intentId: "intent-drain",
    });

    // drain called twice: once initial, once after effect settled
    expect(drainCount).toBe(2);
    expect(host.hasPendingEffects).toHaveBeenCalledTimes(2);
    expect(host.waitForPendingEffects).toHaveBeenCalledTimes(1);
  });

  it("RT-HEXEC-DRAIN-2: terminal snapshot from getContextSnapshot is returned", async () => {
    const baseSnapshot = makeSnapshot({ before: true });
    const terminalSnapshot = makeSnapshot({ after: true });

    const host = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => terminalSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const result = await executor.execute("ek-terminal", baseSnapshot, {
      type: "transform",
      input: {},
      intentId: "intent-terminal",
    });

    expect(host.getContextSnapshot).toHaveBeenCalledWith("ek-terminal");
    expect(result.terminalSnapshot).toBe(terminalSnapshot);
  });

  it("RT-HEXEC-SERIAL-1: same ExecutionKey must wait for prior drain completion", async () => {
    const baseSnapshot = makeSnapshot({ count: 8 });
    const pendingDrains: Array<() => void> = [];

    const host = createMockMailboxHost({
      drain: vi.fn(
        () => new Promise<void>((resolve) => { pendingDrains.push(resolve); })
      ),
      getContextSnapshot: vi.fn(() => baseSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const executionKey = "proposal-serial";

    const first = executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: { step: 1 },
      intentId: "intent-1",
    });
    await vi.waitFor(() => expect(host.drain).toHaveBeenCalledTimes(1), { timeout: 1_000 });

    const second = executor.execute(executionKey, baseSnapshot, {
      type: "increment",
      input: { step: 2 },
      intentId: "intent-2",
    });

    // Second drain should NOT have started yet
    expect(host.drain).toHaveBeenCalledTimes(1);

    // Complete first drain
    pendingDrains[0]();
    await expect(first).resolves.toMatchObject({ outcome: "completed" });

    // Now second drain should start
    await vi.waitFor(() => expect(host.drain).toHaveBeenCalledTimes(2), { timeout: 1_000 });

    // seedSnapshot called twice with correct key
    expect(host.seedSnapshot).toHaveBeenCalledTimes(2);
    expect(host.submitIntent).toHaveBeenNthCalledWith(
      2,
      executionKey,
      expect.objectContaining({ intentId: "intent-2" })
    );

    pendingDrains[1]();
    await expect(second).resolves.toMatchObject({ outcome: "completed" });
  });

  it("RT-HEXEC-ABORT-1: abort while queued returns failed without starting execution", async () => {
    const baseSnapshot = makeSnapshot({});
    const controller = new AbortController();

    // Abort immediately
    controller.abort();

    const host = createMockMailboxHost();
    const executor = createAppHostExecutor(host);

    const result = await executor.execute("ek-abort", baseSnapshot, {
      type: "noop",
      input: {},
      intentId: "intent-abort",
    }, { signal: controller.signal });

    expect(result.outcome).toBe("failed");
    expect(result.error?.code).toBe("EXECUTION_ABORTED");
    // seedSnapshot should NOT have been called (aborted before execution)
    expect(host.seedSnapshot).not.toHaveBeenCalled();
    expect(host.drain).not.toHaveBeenCalled();
  });

  it("RT-HEXEC-CLEANUP-1: releaseExecution called in finally block", async () => {
    const baseSnapshot = makeSnapshot({});

    const host = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => baseSnapshot),
    });

    const executor = createAppHostExecutor(host);
    await executor.execute("ek-cleanup", baseSnapshot, {
      type: "noop",
      input: {},
      intentId: "intent-cleanup",
    });

    expect(host.releaseExecution).toHaveBeenCalledTimes(1);
    expect(host.releaseExecution).toHaveBeenCalledWith("ek-cleanup");
  });

  it("RT-HEXEC-DRAIN-3: drain loop continues when hasQueuedWork is true (P1)", async () => {
    const baseSnapshot = makeSnapshot({ count: 0 });
    let drainCount = 0;

    const host = createMockMailboxHost({
      drain: vi.fn(async () => { drainCount++; }),
      // No pending effects on any cycle
      hasPendingEffects: vi.fn(() => false),
      // First cycle: queued work remains (runner teardown re-scheduled jobs).
      // Second cycle: mailbox is empty.
      hasQueuedWork: vi.fn()
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false),
      getContextSnapshot: vi.fn(() => makeSnapshot({ count: 1 })),
    });

    const executor = createAppHostExecutor(host);
    await executor.execute("ek-queued", baseSnapshot, {
      type: "increment",
      input: {},
      intentId: "intent-queued",
    });

    // drain called twice: once initial (queued work remained), once more to settle
    expect(drainCount).toBe(2);
    expect(host.hasQueuedWork).toHaveBeenCalledTimes(2);
  });

  it("RT-HEXEC-SETUP-1: lock released when seedSnapshot throws (P2)", async () => {
    const baseSnapshot = makeSnapshot({});

    const host = createMockMailboxHost({
      seedSnapshot: vi.fn(() => { throw new Error("seed failed"); }),
      getContextSnapshot: vi.fn(() => baseSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const executionKey = "ek-setup-fail";

    // First call should fail but release the lock
    const result1 = await executor.execute(executionKey, baseSnapshot, {
      type: "noop",
      input: {},
      intentId: "intent-fail",
    });
    expect(result1.outcome).toBe("failed");
    expect(result1.error?.code).toBe("EXECUTION_ERROR");

    // Second call for the same key MUST NOT deadlock
    const goodHost = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => baseSnapshot),
    });
    // Replace seedSnapshot to succeed this time
    (host.seedSnapshot as ReturnType<typeof vi.fn>).mockImplementation(() => {});
    (host.drain as ReturnType<typeof vi.fn>).mockImplementation(async () => {});

    const result2 = await executor.execute(executionKey, baseSnapshot, {
      type: "noop",
      input: {},
      intentId: "intent-recover",
    });
    expect(result2.outcome).toBe("completed");
  });

  it("RT-HEXEC-OUTCOME-1: outcome derived from terminal snapshot lastError", async () => {
    const errorSnapshot = makeSnapshot({});
    (errorSnapshot.system as Record<string, unknown>).lastError = {
      code: "TEST_ERROR",
      message: "Something went wrong",
      source: { actionId: "test", nodePath: "test" },
      timestamp: 1_700_000_000_000,
    };

    const host = createMockMailboxHost({
      getContextSnapshot: vi.fn(() => errorSnapshot),
    });

    const executor = createAppHostExecutor(host);
    const result = await executor.execute("ek-outcome", makeSnapshot({}), {
      type: "fail",
      input: {},
      intentId: "intent-outcome",
    });

    expect(result.outcome).toBe("failed");
    expect(result.error).toMatchObject({ code: "TEST_ERROR" });
  });
});
