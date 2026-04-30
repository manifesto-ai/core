/**
 * Host Namespace Compliance Tests (v2.0.2)
 *
 * Verifies that Host does NOT write to Core-owned fields in the snapshot.
 * Intent slots are stored in namespaces.host to comply with HOST-NS-1 and INV-SNAP-4.
 *
 * @see host-SPEC-v2.0.2.md §3.3.1 HOST-NS-1
 */

import { semanticPathToPatchPath } from "@manifesto-ai/core";
const pp = semanticPathToPatchPath;

import { describe, it, expect, beforeEach } from "vitest";
import { createHost, getHostState, getLegacyDataRootHostState } from "../../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import {
  createTestSchema,
  createTestIntent,
  createMinimalSnapshot,
  stripHostState,
} from "../helpers/index.js";

describe("Host Namespace Compliance (v2.0.2)", () => {
  let schema: DomainSchema;

  beforeEach(() => {
    schema = createTestSchema({
      actions: {
        simpleAction: {
          flow: {
            kind: "patch",
            op: "set", path: pp("count"),
            value: { kind: "lit", value: 1 },
          },
        },
      },
    });
  });

  describe("submitIntent() namespace compliance", () => {
    it("should NOT write to system.intentSlots", async () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);
      await host.drain(key);
      await host.drain(key);

      // Verify system.intentSlots is NOT written
      const resultSnapshot = host.getContextSnapshot(key)!;
      const system = resultSnapshot.system as Record<string, unknown>;

      expect(system.intentSlots).toBeUndefined();
    });

    it("should NOT write to system.currentAction", async () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Get initial snapshot and record initial currentAction value
      const snapshot = host.getSnapshot()!;
      const initialCurrentAction = snapshot.system.currentAction;

      // Seed snapshot and submit intent
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);
      await host.drain(key);

      // Verify system.currentAction is NOT modified by Host
      // (Core manages system.currentAction, Host should not touch it)
      const resultSnapshot = host.getContextSnapshot(key)!;

      // system.currentAction should remain at its initial value (null)
      // Host should not have written the intentId to it
      expect(resultSnapshot.system.currentAction).toBe(initialCurrentAction);
      expect(resultSnapshot.system.currentAction).not.toBe(intent.intentId);
    });

    it("should store intent slots in namespaces.host for effect result injection", async () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);
      await host.drain(key);

      const resultSnapshot = host.getContextSnapshot(key)!;
      const hostState = getHostState(resultSnapshot);

      expect(hostState?.intentSlots?.[intent.intentId!]).toMatchObject({
        type: intent.type,
      });

      // Verify we can still inject effect results using stored intent slot
      const patches = [{ op: "set" as const, path: pp("result"), value: "ok" }];

      // This should not throw - if intent slots weren't stored, it would fail
      host.injectEffectResult(key, "req-1", intent.intentId!, patches);
    });

    it("should record invalid effect namespace deltas in namespaces.host.lastError", async () => {
      const effectSchema = createTestSchema({
        actions: {
          fetchOnce: {
            flow: {
              kind: "if",
              cond: { kind: "isNull", arg: { kind: "get", path: "$host.lastError" } },
              then: {
                kind: "effect",
                type: "needsNamespace",
                params: {},
              },
            },
          },
        },
      });
      const host = createHost(effectSchema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("fetchOnce");
      const pending = {
        id: "req-invalid-namespace",
        type: "needsNamespace",
        params: {},
        actionId: "fetchOnce",
        flowPosition: {
          nodePath: "actions.fetchOnce.flow.then",
          snapshotVersion: 0,
        },
        createdAt: 0,
      };
      const snapshot = {
        ...createMinimalSnapshot({}),
        system: {
          status: "pending" as const,
          lastError: null,
          pendingRequirements: [pending],
          currentAction: "fetchOnce",
        },
        namespaces: {
          host: {
            intentSlots: {
              [intent.intentId!]: { type: "fetchOnce" },
            },
          },
          mel: { guards: { intent: {} } },
        },
      };
      host.seedSnapshot(key, snapshot);

      host.injectEffectResult(
        key,
        pending.id,
        intent.intentId!,
        [],
        intent,
        [{
          namespace: "host",
          patches: [{
            op: "merge",
            path: [
              { kind: "prop", name: "intentSlots" },
              { kind: "prop", name: intent.intentId! },
              { kind: "prop", name: "type" },
            ],
            value: { invalid: true },
          }],
        }],
      );
      await host.drain(key);

      const resultSnapshot = host.getContextSnapshot(key)!;
      const hostState = getHostState(resultSnapshot);
      expect(hostState?.lastError?.code).toBe("EFFECT_APPLY_FAILED");
      expect(hostState?.lastError?.message).toContain("Invalid namespace merge target");
      expect(resultSnapshot.system.pendingRequirements).toHaveLength(0);
    });
  });

  describe("snapshot data integrity", () => {
    it("should create host namespace in snapshot namespaces", async () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);
      await host.drain(key);

      // Verify host-owned state is in snapshot namespaces.
      const resultSnapshot = host.getContextSnapshot(key)!;
      const hostState = getHostState(resultSnapshot);

      expect(hostState).toBeDefined();
    });

    it("should preserve original data during submitIntent", async () => {
      const initialData = { foo: "bar", count: 0 };
      const host = createHost(schema, { initialData });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify original data is preserved (excluding $host)
      const resultSnapshot = host.getContextSnapshot(key)!;
      expect(stripHostState(resultSnapshot.state)).toEqual(initialData);
    });
  });

  describe("getHostState utility", () => {
    it("should return undefined for snapshot without host namespace", () => {
      const snapshot = {
        ...createMinimalSnapshot({ foo: "bar" }),
        namespaces: {},
      };
      expect(getHostState(snapshot)).toBeUndefined();
    });

    it("should return HostOwnedState for snapshot with host namespace", () => {
      const snapshot = {
        ...createMinimalSnapshot({}),
        namespaces: {
          host: {
            intentSlots: { "intent-1": { type: "test" } },
            currentIntentId: "intent-1",
          },
        },
      };
      const hostState = getHostState(snapshot);

      expect(hostState).toEqual({
        intentSlots: { "intent-1": { type: "test" } },
        currentIntentId: "intent-1",
      });
    });

    it("should expose legacy data-root $host only through the explicit compatibility helper", () => {
      const legacyData = {
        $host: {
          intentSlots: { "intent-1": { type: "test" } },
          currentIntentId: "intent-1",
        },
      };
      const hostState = getLegacyDataRootHostState(legacyData);

      expect(getHostState(legacyData)).toBeUndefined();
      expect(hostState).toEqual({
        intentSlots: { "intent-1": { type: "test" } },
        currentIntentId: "intent-1",
      });
    });

    it("should return undefined for null data", () => {
      expect(getHostState(null)).toBeUndefined();
    });

    it("should return undefined for primitive data", () => {
      expect(getHostState("string")).toBeUndefined();
      expect(getHostState(123)).toBeUndefined();
      expect(getHostState(true)).toBeUndefined();
    });
  });
});
