import { describe, it, expect } from "vitest";
import { AppHostExecutor } from "@manifesto-ai/runtime";
import type { Host, HostResult, Intent, Snapshot } from "@manifesto-ai/shared";

function createBaseSnapshot(): Snapshot {
  return {
    data: {},
    computed: {},
    input: {},
    system: {
      status: "idle",
      lastError: null,
      errors: [],
      pendingRequirements: [],
      currentAction: null,
    },
    meta: {
      version: 0,
      timestamp: 0,
      randomSeed: "seed",
      schemaHash: "schema-1",
    },
  };
}

function createHost(dispatchImpl: Host["dispatch"]): Host {
  return {
    dispatch: dispatchImpl,
    registerEffect: () => {},
  };
}

describe("HostExecutor (FDR-APP-INTEGRATION-001)", () => {
  it("HEXEC-3: execute returns failed result when dispatch throws", async () => {
    const baseSnapshot = createBaseSnapshot();
    const intent: Intent = { type: "test.noop", input: {}, intentId: "intent-1" };

    const host = createHost(async () => {
      throw new Error("boom");
    });
    const executor = new AppHostExecutor(host);

    const result = await executor.execute("key-1", baseSnapshot, intent, {
      timeoutMs: 25,
    });

    expect(result.outcome).toBe("failed");
    expect(result.terminalSnapshot).toBe(baseSnapshot);
    expect(result.error?.code).toBe("EXECUTION_ERROR");
  });

  it("HEXEC-3: execute returns completed result from dispatch", async () => {
    const baseSnapshot = createBaseSnapshot();
    const terminalSnapshot: Snapshot = {
      ...baseSnapshot,
      meta: {
        ...baseSnapshot.meta,
        version: 1,
      },
    };
    const intent: Intent = { type: "test.noop", input: {}, intentId: "intent-2" };

    const host = createHost(async (): Promise<HostResult> => {
      return { status: "complete", snapshot: terminalSnapshot };
    });
    const executor = new AppHostExecutor(host);

    const result = await executor.execute("key-2", baseSnapshot, intent, {
      timeoutMs: 25,
    });

    expect(result.outcome).toBe("completed");
    expect(result.terminalSnapshot).toBe(terminalSnapshot);
  });

  it("HEXEC-6: traceRef uses ArtifactRef when enabled", async () => {
    const baseSnapshot = createBaseSnapshot();
    const intent: Intent = { type: "test.noop", input: {}, intentId: "intent-3" };

    const host = createHost(async (): Promise<HostResult> => {
      return { status: "complete", snapshot: baseSnapshot };
    });
    const executor = new AppHostExecutor(host, { traceEnabled: true });

    const result = await executor.execute("key-3", baseSnapshot, intent, {
      timeoutMs: 25,
    });

    expect(result.traceRef).toBeDefined();
    expect(typeof result.traceRef?.uri).toBe("string");
    expect(typeof result.traceRef?.hash).toBe("string");
  });
});
