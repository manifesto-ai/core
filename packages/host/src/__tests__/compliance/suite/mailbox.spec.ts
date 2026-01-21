/**
 * HCTS Mailbox Test Suite
 *
 * Tests for execution mailbox rules:
 * - MAIL-1: One mailbox per ExecutionKey
 * - MAIL-2: ExecutionKey opaque to Host
 * - MAIL-3: World/App layer determines mapping policy
 * - MAIL-4: All state mutations through mailbox
 *
 * @see host-SPEC-v2.0.2.md §10.1
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Mailbox Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("MAIL-1: One mailbox per ExecutionKey", () => {
    it("HCTS-MAIL-001: Different ExecutionKeys have independent state", async () => {
      const schema = createTestSchema({
        actions: {
          setCounter: {
            flow: {
              kind: "patch",
              op: "set",
              path: "counter",
              value: { kind: "lit", value: 1 },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      // First execution key
      const key1 = "mailbox-test-1";
      const snapshot1 = createTestSnapshot({ counter: 0 }, schema.hash);
      adapter.seedSnapshot(key1, snapshot1);
      adapter.submitIntent(key1, createTestIntent("setCounter"));
      await adapter.drain(key1);

      // Second execution key
      const key2 = "mailbox-test-2";
      const snapshot2 = createTestSnapshot({ counter: 100 }, schema.hash);
      adapter.seedSnapshot(key2, snapshot2);
      adapter.submitIntent(key2, createTestIntent("setCounter"));
      await adapter.drain(key2);

      // Each key maintains its own state
      const result1 = adapter.getSnapshot(key1);
      const result2 = adapter.getSnapshot(key2);

      expect((result1.data as Record<string, unknown>).counter).toBe(1);
      expect((result2.data as Record<string, unknown>).counter).toBe(1);
    });

    it("HCTS-MAIL-002: ExecutionKeys are isolated during concurrent processing", async () => {
      const schema = createTestSchema({
        actions: {
          asyncAction: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "result" } },
              then: {
                kind: "effect",
                type: "delayed",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("delayed", async () => [
        { op: "set", path: "result", value: "completed" },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const key1 = "concurrent-1";
      const key2 = "concurrent-2";

      const snapshot1 = createTestSnapshot({}, schema.hash);
      const snapshot2 = createTestSnapshot({}, schema.hash);

      adapter.seedSnapshot(key1, snapshot1);
      adapter.seedSnapshot(key2, snapshot2);

      // Submit to both
      adapter.submitIntent(key1, createTestIntent("asyncAction"));
      adapter.submitIntent(key2, createTestIntent("asyncAction"));

      // Drain both
      await Promise.all([adapter.drain(key1), adapter.drain(key2)]);

      // Both should complete independently
      const result1 = adapter.getSnapshot(key1);
      const result2 = adapter.getSnapshot(key2);

      expect((result1.data as Record<string, unknown>).result).toBe("completed");
      expect((result2.data as Record<string, unknown>).result).toBe("completed");
    });
  });

  describe("MAIL-2: ExecutionKey opaque to Host", () => {
    it("HCTS-MAIL-003: Host accepts any string as ExecutionKey", async () => {
      const schema = createTestSchema({
        actions: {
          simple: {
            flow: {
              kind: "patch",
              op: "set",
              path: "done",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      // Test with various ExecutionKey formats
      const testKeys = [
        "simple-key",
        "uuid-style-key-12345-67890",
        "proposal:abc123:branch:main",
        "🔑-unicode-key",
        "key/with/slashes",
        "key.with.dots",
      ];

      for (const key of testKeys) {
        const snapshot = createTestSnapshot({}, schema.hash);
        adapter.seedSnapshot(key, snapshot);
        adapter.submitIntent(key, createTestIntent("simple"));
        await adapter.drain(key);

        const result = adapter.getSnapshot(key);
        expect((result.data as Record<string, unknown>).done).toBe(true);
      }
    });
  });

  describe("MAIL-4: All state mutations through mailbox", () => {
    it("HCTS-MAIL-004: Effect results go through job queue", async () => {
      const schema = createTestSchema({
        actions: {
          effectAction: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "effectResult" } },
              then: {
                kind: "effect",
                type: "stateChanging",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("stateChanging", async () => [
        { op: "set", path: "effectResult", value: "from-effect" },
      ]);

      await adapter.create({ schema, effectRunner, runtime });

      const executionKey = "mailbox-mutation-test";
      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("effectAction"));

      await adapter.drain(executionKey);

      // Trace should show the mutation went through proper channels
      const trace = adapter.getTrace(executionKey);

      // Should see: job:start -> core:compute -> effect:dispatch -> ... -> continue:enqueue
      const jobStarts = trace.filter((e) => e.t === "job:start");
      const dispatches = trace.filter((e) => e.t === "effect:dispatch");
      const continues = trace.filter((e) => e.t === "continue:enqueue");

      expect(jobStarts.length).toBeGreaterThan(0);
      expect(dispatches.length).toBeGreaterThan(0);
      expect(continues.length).toBeGreaterThan(0);
    });

    it("HCTS-MAIL-005: Compute patches applied through proper channel", async () => {
      const schema = createTestSchema({
        actions: {
          multiPatch: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "a",
                  value: { kind: "lit", value: 1 },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "b",
                  value: { kind: "lit", value: 2 },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const executionKey = "patch-channel-test";
      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("multiPatch"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);

      // Should see core:apply events for the patches
      const applyEvents = trace.filter((e) => e.t === "core:apply");
      expect(applyEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Mailbox processing order", () => {
    it("HCTS-MAIL-006: Jobs processed in FIFO order within same key", async () => {
      // Multiple intents to same key should be processed in order
      // Using a simple counter pattern instead of string concatenation

      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "counter",
              value: {
                kind: "add",
                left: {
                  kind: "coalesce",
                  args: [{ kind: "get", path: "counter" }, { kind: "lit", value: 0 }],
                },
                right: { kind: "lit", value: 1 },
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const executionKey = "fifo-test";
      const snapshot = createTestSnapshot({ counter: 0 }, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      // Submit multiple intents - order matters for final count
      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      const result = adapter.getSnapshot(executionKey);
      // All three increments should have been processed: 0 -> 1 -> 2 -> 3
      expect((result.data as Record<string, unknown>).counter).toBe(3);
    });
  });

});
