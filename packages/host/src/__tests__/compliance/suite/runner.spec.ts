/**
 * HCTS Runner Test Suite
 *
 * Tests for runner lifecycle rules:
 * - RUN-1: Single runner per key
 * - RUN-2: Runner guard semantics
 * - RUN-3: Mailbox processing
 * - RUN-4: Re-check before guard release
 *
 * Note: Many of these tests verify v2.0 execution model behavior.
 * The v1.x adapter provides limited support.
 *
 * @see host-SPEC-v2.0.1.md §10.2
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  assertSingleRunner,
  assertEmptyToNonEmptyKick,
  expectCompliance,
} from "../hcts-assertions.js";
import {
  createTestSchema,
  createTestIntent,
  createTestSnapshot,
} from "../../helpers/index.js";
import { createTestEffectRunner } from "../hcts-adapter.js";

describe("HCTS Runner Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "runner-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("RUN-1: Single runner per key", () => {
    it("HCTS-RUN-001: Only one runner is active at a time for a given execution key", async () => {
      // In v1.x, this is trivially satisfied because execution is synchronous
      // This test serves as a placeholder for v2.0 async execution model

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

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("simple"));

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const result = assertSingleRunner(trace, executionKey);
      expectCompliance(result);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).done).toBe(true);
    });
  });

  describe("LIVE-2: Empty to non-empty kick", () => {
    it("HCTS-LIVE-001: Runner is started when intent is submitted", async () => {
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

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      // Trace should be empty before submission
      expect(adapter.getTrace(executionKey)).toHaveLength(0);

      adapter.submitIntent(executionKey, createTestIntent("simple"));

      // After submission, there should be at least a job:start event
      const traceAfterSubmit = adapter.getTrace(executionKey);
      expect(traceAfterSubmit.length).toBeGreaterThan(0);

      await adapter.drain(executionKey);

      const trace = adapter.getTrace(executionKey);
      const result = assertEmptyToNonEmptyKick(trace, executionKey);
      expectCompliance(result);
    });
  });

  describe("Sequential intent processing", () => {
    it("HCTS-RUN-002: Multiple intents are processed sequentially", async () => {
      const schema = createTestSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: {
                kind: "add",
                left: {
                  kind: "coalesce",
                  args: [{ kind: "get", path: "count" }, { kind: "lit", value: 0 }],
                },
                right: { kind: "lit", value: 1 },
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({ count: 0 }, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);

      // Submit multiple intents
      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      adapter.submitIntent(executionKey, createTestIntent("increment"));
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).count).toBe(3);
    });
  });
});
