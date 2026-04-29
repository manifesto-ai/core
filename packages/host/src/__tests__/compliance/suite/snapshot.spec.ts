/**
 * HCTS Snapshot Ownership Test Suite
 *
 * Tests for snapshot type alignment rules in the current Host v5 contract:
 * - HOST-SNAP-1~4: Core Snapshot type usage
 * - HOST-NS-1~8: Host-owned state namespace
 * - HOST-RESTORE-1~4: restore-normalized resume boundary
 *
 * @see host-SPEC.md §3.3
 */

import { semanticPathToPatchPath } from "@manifesto-ai/core";
const pp = semanticPathToPatchPath;

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestRuntime, type DeterministicRuntime } from "../hcts-runtime.js";
import { createV1Adapter } from "../adapter-v2.js";
import type { HostTestAdapter } from "../hcts-adapter.js";
import {
  DEFAULT_HOST_CONTEXT,
  createTestSchema,
  createTestIntent,
  createTestIntentWithId,
  createRestoreNormalizedSnapshot,
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
              op: "set", path: pp("done"),
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

      // Verify Core's canonical v5 Snapshot structure
      expect(finalSnapshot).toHaveProperty("state");
      expect(finalSnapshot).toHaveProperty("computed");
      expect(finalSnapshot).toHaveProperty("system");
      expect(finalSnapshot).toHaveProperty("input");
      expect(finalSnapshot).toHaveProperty("meta");
      expect(finalSnapshot).toHaveProperty("namespaces");
      expect(finalSnapshot).not.toHaveProperty("data");
      expect(finalSnapshot.namespaces).toHaveProperty("host");
      expect(finalSnapshot.namespaces).toHaveProperty("mel");

      // Verify SystemState structure
      expect(finalSnapshot.system).toHaveProperty("status");
      expect(finalSnapshot.system).toHaveProperty("lastError");
      expect(finalSnapshot.system).toHaveProperty("pendingRequirements");
      expect(finalSnapshot.system).toHaveProperty("currentAction");

      // Verify SnapshotMeta structure
      expect(finalSnapshot.meta).toHaveProperty("version");
      expect(finalSnapshot.meta).toHaveProperty("timestamp");
      expect(finalSnapshot.meta).toHaveProperty("randomSeed");
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
                  op: "set", path: pp("step1"),
                  value: { kind: "lit", value: true },
                },
                {
                  kind: "patch",
                  op: "set", path: pp("step2"),
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

      // Original state preserved alongside new state
      expect((finalSnapshot.state as Record<string, unknown>).existing).toBe("value");
      expect((finalSnapshot.state as Record<string, unknown>).step1).toBe(true);
      expect((finalSnapshot.state as Record<string, unknown>).step2).toBe(true);
    });
  });

  describe("HOST-NS-1/HOST-NS-7: Host-owned state in namespaces.host", () => {
    it("HCTS-NS-001: Host stores its state in namespaces.host, not domain state", async () => {
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
      const hostState = getHostState(finalSnapshot);

      expect(hostState).toBeDefined();
      expect(finalSnapshot.namespaces.host).toBe(hostState);
      expect((finalSnapshot.state as Record<string, unknown>).$host).toBeUndefined();

      // Error should be recorded in namespaces.host, not system.*
      expect(hostState?.lastError).toHaveProperty("code");
      expect(hostState?.lastError).toHaveProperty("message");
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

      // getHostState should retrieve namespaces.host from the canonical Snapshot.
      const hostState = getHostState(finalSnapshot);
      expect(hostState).toBeDefined();
      expect(hostState).toBe(finalSnapshot.namespaces.host);
      expect((finalSnapshot.state as Record<string, unknown>).$host).toBeUndefined();
    });
  });

  describe("HOST-NS-2: Host does not extend Core's SystemState", () => {
    it("HCTS-NS-003: system.* contains only Core-defined fields", async () => {
      const schema = createTestSchema({
        actions: {
          complete: {
            flow: {
              kind: "patch",
              op: "set", path: pp("done"),
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
      const requiredCoreSystemFields = [
        "status",
        "lastError",
        "pendingRequirements",
        "currentAction",
      ];
      for (const key of requiredCoreSystemFields) {
        expect(systemKeys).toContain(key);
      }
      expect(systemKeys.sort()).toEqual([...requiredCoreSystemFields].sort());
    });
  });

  describe("HOST-NS-5: Host error reporting uses namespaces.host", () => {
    it("HCTS-NS-004: Effect execution errors recorded in namespaces.host.lastError", async () => {
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
      const hostState = getHostState(finalSnapshot);

      expect(hostState?.lastError).toBeDefined();
      expect(hostState?.lastError?.code).toBe("EFFECT_EXECUTION_FAILED");
      expect(hostState?.lastError?.message).toContain("Effect execution failed");
      expect((finalSnapshot.state as Record<string, unknown>).$host).toBeUndefined();
      expect(finalSnapshot.system.lastError).toBeNull();
    });

    it("HCTS-NS-005: Unknown effect type error recorded in namespaces.host", async () => {
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
      const hostState = getHostState(finalSnapshot);

      expect(hostState?.lastError).toBeDefined();
      expect(hostState?.lastError?.code).toBe("UNKNOWN_EFFECT");
      expect((finalSnapshot.state as Record<string, unknown>).$host).toBeUndefined();
      expect(finalSnapshot.system.lastError).toBeNull();
    });
  });

  describe("HOST-RESTORE-1~4: Restore-normalized snapshots resume as fresh execution boundaries", () => {
    it("HCTS-RESTORE-001: Resume from a restore-normalized snapshot uses fresh per-job context and fresh namespaces.host bookkeeping", async () => {
      const schema = createTestSchema({
        actions: {
          resume: {
            flow: {
              kind: "patch",
              op: "set", path: pp("processed"),
              value: { kind: "lit", value: true },
            },
          },
        },
      });

      const effectRunner = createTestEffectRunner();
      await adapter.create({ schema, effectRunner, runtime });

      const restoredSnapshot = createRestoreNormalizedSnapshot(
        { count: 5, $host: { currentIntentId: "stale-intent" } },
        schema.hash,
        {
          ...DEFAULT_HOST_CONTEXT,
          now: 5,
          randomSeed: "restored-seed",
        }
      );

      runtime.advanceTime(100);
      adapter.seedSnapshot(executionKey, restoredSnapshot);
      adapter.submitIntent(executionKey, createTestIntentWithId("resume", "intent-restore"));
      await adapter.drain(executionKey);

      const finalSnapshot = adapter.getSnapshot(executionKey);
      const hostState = getHostState(finalSnapshot);

      expect((finalSnapshot.state as Record<string, unknown>).processed).toBe(true);
      expect(finalSnapshot.input).toBeUndefined();
      expect(finalSnapshot.system.currentAction).toBeNull();
      expect(finalSnapshot.meta.timestamp).toBe(100);
      expect(finalSnapshot.meta.randomSeed).toBe("intent-restore");
      expect((finalSnapshot.state as Record<string, unknown>).$host).toBeUndefined();
      expect(hostState?.intentSlots?.["intent-restore"]).toEqual({
        type: "resume",
        input: undefined,
      });
      expect(hostState?.intentSlots?.["stale-intent"]).toBeUndefined();
    });
  });

  describe("HOST-SNAP-4: Host reads Core fields without assuming absence", () => {
    it("HCTS-SNAP-003: Host handles snapshots with minimal fields", async () => {
      const schema = createTestSchema({
        actions: {
          simple: {
            flow: {
              kind: "patch",
              op: "set", path: pp("processed"),
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
      expect((finalSnapshot.state as Record<string, unknown>).processed).toBe(true);
    });
  });
});
