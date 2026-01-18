/**
 * Host Namespace Compliance Tests (v2.0.2)
 *
 * Verifies that Host does NOT write to Core-owned fields in the snapshot.
 * Intent slots are stored internally in ExecutionContext to comply with
 * HOST-NS-1 and INV-SNAP-4.
 *
 * @see host-SPEC-v2.0.2.md §3.3.1 HOST-NS-1
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createHost, getHostState } from "../../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import {
  createTestSchema,
  createTestIntent,
} from "../helpers/index.js";

describe("Host Namespace Compliance (v2.0.2)", () => {
  let schema: DomainSchema;

  beforeEach(() => {
    schema = createTestSchema({
      actions: {
        simpleAction: {
          flow: {
            kind: "patch",
            op: "set",
            path: "count",
            value: { kind: "lit", value: 1 },
          },
        },
      },
    });
  });

  describe("submitIntent() namespace compliance", () => {
    it("should NOT write to system.intentSlots", () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify system.intentSlots is NOT written
      const resultSnapshot = host.getContextSnapshot(key)!;
      const system = resultSnapshot.system as Record<string, unknown>;

      expect(system.intentSlots).toBeUndefined();
    });

    it("should NOT write to system.currentAction", () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Get initial snapshot and record initial currentAction value
      const snapshot = host.getSnapshot()!;
      const initialCurrentAction = snapshot.system.currentAction;

      // Seed snapshot and submit intent
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify system.currentAction is NOT modified by Host
      // (Core manages system.currentAction, Host should not touch it)
      const resultSnapshot = host.getContextSnapshot(key)!;

      // system.currentAction should remain at its initial value (null)
      // Host should not have written the intentId to it
      expect(resultSnapshot.system.currentAction).toBe(initialCurrentAction);
      expect(resultSnapshot.system.currentAction).not.toBe(intent.intentId);
    });

    it("should store intent slots internally for effect result injection", async () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify we can still inject effect results
      // (this means the intent slot was stored internally)
      // The effect injection won't throw if the intent is found
      const patches = [{ op: "set" as const, path: "data.result", value: "ok" }];

      // This should not throw - if intent slots weren't stored, it would fail
      host.injectEffectResult(key, "req-1", intent.intentId!, patches);
    });
  });

  describe("snapshot data integrity", () => {
    it("should not create $host namespace in snapshot data", () => {
      const host = createHost(schema, { initialData: {} });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify $host is NOT in snapshot data
      const resultSnapshot = host.getContextSnapshot(key)!;
      const hostState = getHostState(resultSnapshot.data);

      expect(hostState).toBeUndefined();
    });

    it("should preserve original data during submitIntent", () => {
      const initialData = { foo: "bar", count: 0 };
      const host = createHost(schema, { initialData });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");

      // Seed snapshot and submit intent
      const snapshot = host.getSnapshot()!;
      host.seedSnapshot(key, snapshot);
      host.submitIntent(key, intent);

      // Verify original data is preserved
      const resultSnapshot = host.getContextSnapshot(key)!;
      expect(resultSnapshot.data).toEqual(initialData);
    });
  });

  describe("getHostState utility", () => {
    it("should return undefined for data without $host", () => {
      const data = { foo: "bar" };
      expect(getHostState(data)).toBeUndefined();
    });

    it("should return HostOwnedState for data with $host", () => {
      const data = {
        $host: {
          intentSlots: { "intent-1": { type: "test" } },
          currentIntentId: "intent-1",
        },
      };
      const hostState = getHostState(data);

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
