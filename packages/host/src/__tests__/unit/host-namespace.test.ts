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
import type {
  DomainSchema,
  NamespaceDelta,
  Patch,
  Requirement,
  Snapshot,
} from "@manifesto-ai/core";
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
            op: "set",
            path: pp("count"),
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
              kind: "causalGuard",
              guardId: "host-namespace-fetch-once",
              body: {
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
          core: {
            causalGuards: {
              "host-namespace-fetch-once": intent.intentId!,
            },
          },
          host: {
            intentSlots: {
              [intent.intentId!]: { type: "fetchOnce" },
            },
          },
        },
      };
      host.seedSnapshot(key, snapshot);

      host.injectEffectResult(key, pending.id, intent.intentId!, [], intent, [
        {
          namespace: "host",
          patches: [
            {
              op: "merge",
              path: [
                { kind: "prop", name: "intentSlots" },
                { kind: "prop", name: intent.intentId! },
                { kind: "prop", name: "type" },
              ],
              value: { invalid: true },
            },
          ],
        },
      ]);
      await host.drain(key);

      const resultSnapshot = host.getContextSnapshot(key)!;
      const hostState = getHostState(resultSnapshot);
      expect(hostState?.lastError?.code).toBe("EFFECT_APPLY_FAILED");
      expect(hostState?.lastError?.message).toContain("Invalid namespace merge target");
      expect(resultSnapshot.system.pendingRequirements).toHaveLength(0);
    });

    it("should escalate fatal when effect failure cannot be recorded in host namespace", async () => {
      const host = createHost(schema, { initialData: { count: 0 } });
      const key = "test-key";
      const intent = createTestIntent("simpleAction");
      const pending = {
        id: "req-corrupt-host-namespace",
        type: "badPatch",
        params: {},
        actionId: "simpleAction",
        flowPosition: {
          nodePath: "actions.simpleAction.flow",
          snapshotVersion: 0,
        },
        createdAt: 0,
      };
      const snapshot = {
        ...createMinimalSnapshot({ count: 0 }),
        system: {
          status: "pending" as const,
          lastError: null,
          pendingRequirements: [pending],
          currentAction: "simpleAction",
        },
        namespaces: {
          host: "corrupt",
        },
      };
      host.seedSnapshot(key, snapshot);

      host.injectEffectResult(
        key,
        pending.id,
        intent.intentId!,
        [
          {
            op: "merge",
            path: pp("count"),
            value: { invalid: true },
          },
        ],
        intent,
      );
      await host.drain(key);

      const resultSnapshot = host.getContextSnapshot(key)!;
      expect(host.hasFatalError(key)).toBe(true);
      expect(resultSnapshot.system.pendingRequirements).toHaveLength(0);
      expect(resultSnapshot.namespaces.host).toBe("corrupt");
    });

    it("should carry registered effect namespace deltas into FulfillEffect jobs", async () => {
      const effectSchema = createTestSchema({
        actions: {
          fetchOnce: {
            flow: {
              kind: "causalGuard",
              guardId: "host-namespace-registered-effect",
              body: {
                kind: "effect",
                type: "needsNamespace",
                params: {},
              },
            },
          },
        },
      });
      const host = createHost(effectSchema, { initialData: {} });
      const namespaceDelta: readonly NamespaceDelta[] = [
        {
          namespace: "host",
          patches: [
            {
              op: "set",
              path: [{ kind: "prop", name: "registeredEffectSeen" }],
              value: true,
            },
          ],
        },
      ];
      (
        host as unknown as {
          readonly executor: {
            execute: (
              requirement: Requirement,
              snapshot: Snapshot,
            ) => Promise<{
              ok: boolean;
              success: boolean;
              patches: Patch[];
              namespaceDelta?: readonly NamespaceDelta[];
              duration: number;
            }>;
          };
        }
      ).executor.execute = async () => ({
        ok: true,
        success: true,
        patches: [],
        namespaceDelta,
        duration: 0,
      });

      const result = await host.dispatch(createTestIntent("fetchOnce"));
      const hostState = getHostState(result.snapshot);

      expect(result.status).toBe("complete");
      expect(hostState?.registeredEffectSeen).toBe(true);
      expect(result.snapshot.system.lastError).toBeNull();
    });

    it("should reject non-host effect namespace deltas", async () => {
      const effectSchema = createTestSchema({
        actions: {
          fetchOnce: {
            flow: {
              kind: "causalGuard",
              guardId: "host-namespace-rejected-effect",
              body: {
                kind: "effect",
                type: "rejectNamespace",
                params: {},
              },
            },
          },
        },
      });
      const host = createHost(effectSchema, { initialData: {} });
      (
        host as unknown as {
          readonly executor: {
            execute: (
              requirement: Requirement,
              snapshot: Snapshot,
            ) => Promise<{
              ok: boolean;
              success: boolean;
              patches: Patch[];
              namespaceDelta?: readonly NamespaceDelta[];
              duration: number;
            }>;
          };
        }
      ).executor.execute = async () => ({
        ok: true,
        success: true,
        patches: [],
        namespaceDelta: [
          {
            namespace: "mel",
            patches: [
              {
                op: "set",
                path: [{ kind: "prop", name: "leaked" }],
                value: true,
              },
            ],
          },
        ],
        duration: 0,
      });

      const result = await host.dispatch(createTestIntent("fetchOnce"));
      const hostState = getHostState(result.snapshot);

      expect(result.status).toBe("error");
      expect(result.snapshot.namespaces.mel).toBeUndefined();
      expect(hostState?.lastError?.message).toContain("namespaces.host");
      expect(result.snapshot.system.pendingRequirements).toHaveLength(0);
    });

    it("should preserve compute namespace failures and not dispatch effects", async () => {
      const traces: Array<{ readonly t: string }> = [];
      const effectSchema = createTestSchema({
        actions: {
          guardedEffect: {
            flow: {
              kind: "causalGuard",
              guardId: "host-namespace-corrupt-guard",
              body: {
                kind: "effect",
                type: "shouldNotRun",
                params: {},
              },
            },
          },
        },
      });
      const host = createHost(effectSchema, {
        disableAutoEffect: true,
        initialData: {},
        onTrace: (event) => {
          traces.push(event);
        },
      });
      const key = "test-key";
      const intent = createTestIntent("guardedEffect");
      const snapshot = {
        ...host.getSnapshot()!,
        namespaces: {
          core: {
            causalGuards: "corrupt",
          },
        },
      };
      host.seedSnapshot(key, snapshot);

      host.submitIntent(key, intent);
      await host.drain(key);

      const resultSnapshot = host.getContextSnapshot(key)!;
      expect(resultSnapshot.system.status).toBe("error");
      expect(resultSnapshot.system.lastError).toMatchObject({
        code: "TYPE_MISMATCH",
      });
      expect(resultSnapshot.system.lastError?.message).toContain("Invalid namespace merge target");
      expect(resultSnapshot.system.pendingRequirements).toHaveLength(0);
      expect(traces.some((event) => event.t === "effect:dispatch")).toBe(false);
    });

    it("should report repeated effect failures with distinct attempt context", async () => {
      const effectSchema = createTestSchema({
        actions: {
          failingEffect: {
            flow: {
              kind: "causalGuard",
              guardId: "host-repeated-failure",
              body: {
                kind: "effect",
                type: "failing",
                params: {},
              },
            },
          },
        },
      });
      const runtime = {
        now: () => 0,
        microtask: (fn: () => void) => queueMicrotask(fn),
        yield: () => Promise.resolve(),
      };
      const host = createHost(effectSchema, { initialData: {}, runtime });
      host.registerEffect("failing", async () => {
        throw new Error("same failure");
      });

      const first = await host.dispatch(createTestIntent("failingEffect"));
      const second = await host.dispatch(createTestIntent("failingEffect"));

      expect(first.status).toBe("error");
      expect(second.status).toBe("error");
      expect(second.error?.message).toBe("same failure");
      expect(getHostState(second.snapshot)?.lastError?.context).toMatchObject({
        effectType: "failing",
      });
    });

    it("should clear stale host errors before a later successful dispatch", async () => {
      const effectSchema = createTestSchema({
        actions: {
          simpleAction: {
            flow: {
              kind: "patch",
              op: "set",
              path: pp("count"),
              value: { kind: "lit", value: 1 },
            },
          },
          failingEffect: {
            flow: {
              kind: "causalGuard",
              guardId: "host-stale-failure",
              body: {
                kind: "effect",
                type: "failing",
                params: {},
              },
            },
          },
        },
      });
      const host = createHost(effectSchema, { initialData: {} });
      host.registerEffect("failing", async () => {
        throw new Error("boom");
      });

      const failed = await host.dispatch(createTestIntent("failingEffect"));
      expect(failed.status).toBe("error");
      expect(getHostState(failed.snapshot)?.lastError?.code).toBe("EFFECT_EXECUTION_FAILED");

      const succeeded = await host.dispatch(createTestIntent("simpleAction"));
      expect(succeeded.status).toBe("complete");
      expect(succeeded.snapshot.state.count).toBe(1);
      expect(getHostState(succeeded.snapshot)?.lastError).toBeUndefined();
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
