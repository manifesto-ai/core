/**
 * L3: Host Loop Integration Tests
 *
 * Tests compute → effect → apply cycle.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHost, type ManifestoHost } from "@manifesto-ai/host";
import type { DomainSchema } from "@manifesto-ai/core";
import {
  createTestIntent,
  createIncrementIntent,
} from "../fixtures/index.js";
import { expectNoErrors, expectSnapshotStatus } from "../helpers/index.js";

// Import compiled schema
import CounterSchema from "../fixtures/schemas/counter-compiled.json";

const counterSchema = CounterSchema as unknown as DomainSchema;

// =============================================================================
// L3: Host Loop Tests
// =============================================================================

describe("L3: Host Loop Integration", () => {
  let host: ManifestoHost;

  beforeEach(() => {
    host = createHost(counterSchema, {
      initialData: { count: 0, lastIntent: null },
    });
  });

  describe("compute → apply cycle", () => {
    it("should complete simple action without effects", async () => {
      const intent = createIncrementIntent();
      const result = await host.dispatch(intent);

      expect(result.status).toBe("complete");
      expect(result.snapshot.data.count).toBe(1);
    });

    it("should update snapshot after dispatch", async () => {
      await host.dispatch(createIncrementIntent());
      const snapshot = await host.getSnapshot();

      expect(snapshot.data.count).toBe(1);
    });

    it("should compute computed values after dispatch", async () => {
      await host.dispatch(createIncrementIntent());
      const snapshot = await host.getSnapshot();

      // Computed fields have "computed." prefix
      expect(snapshot.computed["computed.doubled"]).toBe(2);
    });

    it("should handle multiple sequential dispatches", async () => {
      // Note: counter.mel uses once() guard so subsequent increments with same intent
      // won't execute. Need different intentIds for each dispatch.
      await host.dispatch(createTestIntent("increment", {}, "intent-1"));
      await host.dispatch(createTestIntent("increment", {}, "intent-2"));
      await host.dispatch(createTestIntent("increment", {}, "intent-3"));

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(3);
      expect(snapshot.computed["computed.doubled"]).toBe(6);
    });

    it("should handle action with parameters", async () => {
      const intent = createTestIntent("reset", { value: 100 });
      await host.dispatch(intent);

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(100);
    });

    it("should handle add action with amount parameter", async () => {
      const intent = createTestIntent("add", { amount: 5 });
      await host.dispatch(intent);

      const snapshot = await host.getSnapshot();
      expect(snapshot.data.count).toBe(5);
    });
  });

  describe("System status", () => {
    it("should have idle status before dispatch", async () => {
      const snapshot = await host.getSnapshot();
      expectSnapshotStatus(snapshot, "idle");
    });

    it("should return to idle status after successful dispatch", async () => {
      await host.dispatch(createIncrementIntent());
      const snapshot = await host.getSnapshot();

      expectSnapshotStatus(snapshot, "idle");
      expectNoErrors(snapshot);
    });
  });

  describe("Version tracking", () => {
    it("should increment version after each dispatch", async () => {
      const initial = await host.getSnapshot();
      const initialVersion = initial.meta.version;

      await host.dispatch(createIncrementIntent());
      const after = await host.getSnapshot();

      expect(after.meta.version).toBeGreaterThan(initialVersion);
    });
  });

  describe("Error handling", () => {
    it("should handle unknown action gracefully", async () => {
      const intent = createTestIntent("nonexistent");
      const result = await host.dispatch(intent);

      // Host doesn't throw - it returns error status
      expect(result.status).toBe("error");
      expect(result.snapshot.system.status).toBe("error");
      expect(result.snapshot.system.lastError).toBeDefined();
      expect(result.snapshot.system.lastError?.code).toBe("UNKNOWN_ACTION");
    });
  });
});

// =============================================================================
// L3: Snapshot Immutability Tests
// =============================================================================

describe("L3: Snapshot Immutability", () => {
  it("should not allow direct mutation of snapshot", async () => {
    const host = createHost(counterSchema, {
      initialData: { count: 5, lastIntent: null },
    });

    const snapshot = await host.getSnapshot();
    const originalCount = snapshot.data.count;

    // Attempt to mutate (should not affect stored snapshot)
    (snapshot.data as Record<string, unknown>).count = 999;

    const freshSnapshot = await host.getSnapshot();
    expect(freshSnapshot.data.count).toBe(originalCount);
  });
});
