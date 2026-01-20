/**
 * HCTS Snapshot Ownership Test Suite
 *
 * Tests for snapshot type alignment rules (v2.0.2):
 * - HOST-SNAP-1~4: Core Snapshot type usage
 * - HOST-NS-1~5: Host-owned state namespace
 *
 * @see host-SPEC-v2.0.2.md §3.3
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
import { getHostState } from "../../../types/host-state.js";

describe("HCTS Snapshot Ownership Tests", () => {
  let adapter: HostTestAdapter;
  let runtime: DeterministicRuntime;
  const executionKey = "snapshot-test-1";

  beforeEach(async () => {
    runtime = createTestRuntime();
    adapter = createV1Adapter();
  });

  afterEach(async () => {
    await adapter.dispose();
  });

  describe("HOST-SNAP-1: Host uses Core's canonical Snapshot type", () => {
    it("HCTS-SNAP-001: Snapshot structure matches Core SPEC definition", async () => {
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

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Verify Core's canonical Snapshot structure
      expect(finalSnapshot).toHaveProperty("data");
      expect(finalSnapshot).toHaveProperty("computed");
      expect(finalSnapshot).toHaveProperty("system");
      expect(finalSnapshot).toHaveProperty("input");
      expect(finalSnapshot).toHaveProperty("meta");

      // Verify SystemState structure
      expect(finalSnapshot.system).toHaveProperty("status");
      expect(finalSnapshot.system).toHaveProperty("pendingRequirements");

      // Verify SnapshotMeta structure
      expect(finalSnapshot.meta).toHaveProperty("version");
      expect(finalSnapshot.meta).toHaveProperty("timestamp");
      expect(finalSnapshot.meta).toHaveProperty("schemaHash");
    });
  });

  describe("HOST-SNAP-3: Host preserves Core fields when applying patches", () => {
    it("HCTS-SNAP-002: All Core-owned fields preserved after patch application", async () => {
      const schema = createTestSchema({
        actions: {
          multiPatch: {
            flow: {
              kind: "seq",
              steps: [
                {
                  kind: "patch",
                  op: "set",
                  path: "step1",
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "patch",
                  op: "set",
                  path: "step2",
                  value: { kind: "lit", value: true },
                },
              ],
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const initialSnapshot = createTestSnapshot({ existing: "value" }, schema.hash);
      adapter.seedSnapshot(executionKey, initialSnapshot);

      // Store initial meta for comparison
      const initialSchemaHash = initialSnapshot.meta.schemaHash;

      adapter.submitIntent(executionKey, createTestIntent("multiPatch"));
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Core-owned fields preserved
      expect(finalSnapshot.meta.schemaHash).toBe(initialSchemaHash);
      expect(finalSnapshot.system).toBeDefined();
      expect(finalSnapshot.computed).toBeDefined();

      // Version incremented (Core semantics)
      expect(finalSnapshot.meta.version).toBeGreaterThan(initialSnapshot.meta.version);

      // Original data preserved alongside new data
      expect((finalSnapshot.data as Record<string, unknown>).existing).toBe("value");
      expect((finalSnapshot.data as Record<string, unknown>).step1).toBe(true);
      expect((finalSnapshot.data as Record<string, unknown>).step2).toBe(true);
    });
  });

  describe("HOST-NS-1: Host-owned state in data.$host namespace", () => {
    it("HCTS-NS-001: Host stores its state in data.$host", async () => {
      const schema = createTestSchema({
        actions: {
          withEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "response" } },
              then: {
                kind: "effect",
                type: "testEffect",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("testEffect", async () => {
        throw new Error("Test error for host state");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("withEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const hostState = getHostState(finalSnapshot.data);

      // Host-owned state should be in $host namespace
      expect(hostState).toBeDefined();

      // Error should be recorded in $host, not system.*
      if (hostState?.errors && hostState.errors.length > 0) {
        expect(hostState.errors[0]).toHaveProperty("code");
        expect(hostState.errors[0]).toHaveProperty("message");
      }
    });

    it("HCTS-NS-002: Host state accessible via getHostState helper", async () => {
      const schema = createTestSchema({
        actions: {
          trigger: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "done" } },
              then: {
                kind: "effect",
                type: "failing",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("failing", async () => {
        throw new Error("Intentional failure");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("trigger"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // getHostState should retrieve $host namespace
      const hostState = getHostState(finalSnapshot.data);
      expect(hostState).toBeDefined();
    });
  });

  describe("HOST-NS-2: Host does not extend Core's SystemState", () => {
    it("HCTS-NS-003: system.* contains only Core-defined fields", async () => {
      const schema = createTestSchema({
        actions: {
          complete: {
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
      adapter.submitIntent(executionKey, createTestIntent("complete"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);

      // Core SystemState fields only
      const systemKeys = Object.keys(finalSnapshot.system);
      const coreSystemFields = [
        "status",
        "lastError",
        "errors",
        "pendingRequirements",
        "currentAction",
      ];

      // All system fields should be from Core's definition
      for (const key of systemKeys) {
        expect(coreSystemFields).toContain(key);
      }
    });
  });

  describe("HOST-NS-5: Host error reporting uses $host namespace", () => {
    it("HCTS-NS-004: Effect execution errors recorded in $host.errors", async () => {
      const schema = createTestSchema({
        actions: {
          failingEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "$host.lastError" } },
              then: {
                kind: "effect",
                type: "throwingEffect",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      effectRunner.register("throwingEffect", async () => {
        throw new Error("Effect execution failed");
      });

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("failingEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const hostState = getHostState(finalSnapshot.data);

      // Error should be in $host.errors
      expect(hostState?.errors).toBeDefined();
      expect(hostState?.errors?.length).toBeGreaterThan(0);

      const error = hostState?.errors?.[0];
      expect(error?.code).toBe("EFFECT_EXECUTION_FAILED");
      expect(error?.message).toContain("Effect execution failed");
    });

    it("HCTS-NS-005: Unknown effect type error recorded in $host", async () => {
      const schema = createTestSchema({
        actions: {
          unknownEffect: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "$host.lastError" } },
              then: {
                kind: "effect",
                type: "nonexistentEffect",
                params: {},
              },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      // Note: We don't register "nonexistentEffect"

      await adapter.create({ schema, effectRunner, runtime });

      const snapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, snapshot);
      adapter.submitIntent(executionKey, createTestIntent("unknownEffect"));

      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const hostState = getHostState(finalSnapshot.data);

      expect(hostState?.errors).toBeDefined();
      expect(hostState?.errors?.length).toBeGreaterThan(0);
      expect(hostState?.errors?.[0]?.code).toBe("UNKNOWN_EFFECT");
    });
  });

  describe("HOST-SNAP-4: Host reads Core fields without assuming absence", () => {
    it("HCTS-SNAP-003: Host handles snapshots with minimal fields", async () => {
      const schema = createTestSchema({
        actions: {
          simple: {
            flow: {
              kind: "patch",
              op: "set",
              path: "processed",
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      // Seed with minimal snapshot
      const minimalSnapshot = createTestSnapshot({}, schema.hash);
      adapter.seedSnapshot(executionKey, minimalSnapshot);
      adapter.submitIntent(executionKey, createTestIntent("simple"));

      // Should not throw even with minimal snapshot
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      expect((finalSnapshot.data as Record<string, unknown>).processed).toBe(true);
    });
  });
});
