/**
 * L3: Re-Entry Safety Tests
 *
 * Tests Host SPEC §6.2 re-entry requirements.
 * Uses counter.mel which has once(lastIntent) guard on increment action.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import { createTestIntent } from "../fixtures/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const counterSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// L3: Re-Entry Safety Tests
// =============================================================================

describe("L3: Re-Entry Safety", () => {
  let host: ManifestoHost;

  beforeEach(() => {
    host = createHost(counterSchema, {
      initialData: {
        count: 0,
        lastIntent: null,
      },
    });
  });

  describe("Once guards", () => {
    it("should execute once-guarded action on first call", async () => {
      const intent = createTestIntent("increment", {}, "unique-intent-1");
      await host.dispatch(intent);

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(1);
      // lastIntent should be set to the intentId
      expect(snapshot.data.lastIntent).toBe("unique-intent-1");
    });

    it("should skip once-guarded action when same intentId is used", async () => {
      const intentId = "same-intent-id";

      // First call - should execute
      await host.dispatch(createTestIntent("increment", {}, intentId));

      const snapshot1 = await host.getSnapshot();
      expect(snapshot1.data.count).toBe(1);

      // Second call with same intentId - should be skipped (once guard)
      await host.dispatch(createTestIntent("increment", {}, intentId));

      const snapshot2 = await host.getSnapshot();
      expect(snapshot2.data.count).toBe(1); // Should still be 1
    });

    it("should execute when different intentIds are used", async () => {
      // First call
      await host.dispatch(createTestIntent("increment", {}, "intent-1"));

      // Second call with different intentId
      await host.dispatch(createTestIntent("increment", {}, "intent-2"));

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(2);
    });

    it("should allow non-guarded actions (decrement uses when, not once)", async () => {
      // First set count to positive so decrement will work
      await host.dispatch(createTestIntent("reset", { value: 5 }));

      // Decrement uses when(isPositive), not once(), so it should always execute
      await host.dispatch(createTestIntent("decrement"));
      await host.dispatch(createTestIntent("decrement"));

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(3);
    });
  });

  describe("IntentId stability", () => {
    it("should use same intentId for re-invocations", async () => {
      const intentId = "stable-intent-123";
      const intent = createTestIntent("increment", {}, intentId);

      await host.dispatch(intent);
      const snapshot = await host.getSnapshot();

      expect(snapshot.data.count).toBe(1);
      expect(snapshot.data.lastIntent).toBe(intentId);
    });
  });

  describe("Idempotency", () => {
    it("should produce same snapshot for same intent on same base", async () => {
      const host1 = createHost(counterSchema, {
        initialData: { count: 0, lastIntent: null },
      });
      const host2 = createHost(counterSchema, {
        initialData: { count: 0, lastIntent: null },
      });

      const intent = createTestIntent("increment", {}, "same-intent-id");

      await host1.dispatch(intent);
      await host2.dispatch(intent);

      const snapshot1 = await host1.getSnapshot();
      const snapshot2 = await host2.getSnapshot();

      // Data should be identical
      expect(snapshot1.data).toEqual(snapshot2.data);
    });
  });
});

// =============================================================================
// L3: System Requirements Clearing
// =============================================================================

describe("L3: System Requirements", () => {
  it("should clear pendingRequirements between iterations", async () => {
    const host = createHost(counterSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    await host.dispatch(createTestIntent("increment"));

    const snapshot = await host.getSnapshot();
    expect(snapshot.system.pendingRequirements).toHaveLength(0);
  });

  it("should maintain isolation between compute calls", async () => {
    const host = createHost(counterSchema, {
      initialData: { count: 0, lastIntent: null },
    });

    // Multiple independent dispatches with different intentIds
    await host.dispatch(createTestIntent("increment", {}, "intent-1"));
    await host.dispatch(createTestIntent("increment", {}, "intent-2"));

    const snapshot = await host.getSnapshot();

    // System should be clean
    expect(snapshot.system.status).toBe("idle");
    expect(snapshot.system.pendingRequirements).toHaveLength(0);
    expect(snapshot.system.lastError).toBeNull();
  });
});
