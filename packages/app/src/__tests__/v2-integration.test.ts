/**
 * v2 Integration Tests
 *
 * End-to-end tests for v2 execution path with Host, WorldStore, and PolicyService.
 *
 * @see APP-SPEC-v2.0.0 §5-10
 * @see FDR-APP-INTEGRATION-001
 */

import { describe, it, expect, vi } from "vitest";
import { createApp, createTestApp } from "../index.js";
import { createInMemoryWorldStore } from "../storage/world-store/index.js";
import { createSilentPolicyService } from "../runtime/policy/index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Host, HostResult, Snapshot, AppConfig, Intent } from "../core/types/index.js";
import { createWorldId, createProposalId } from "@manifesto-ai/world";

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSchema(overrides?: Partial<DomainSchema>): DomainSchema {
  return {
    id: "test:v2",
    version: "1.0.0",
    hash: "test-schema-v2",
    types: {},
    actions: {
      "counter.increment": {
        flow: { kind: "seq", steps: [] },
      },
      "counter.decrement": {
        flow: { kind: "seq", steps: [] },
      },
      "item.create": {
        flow: {
          kind: "seq",
          steps: [
            { kind: "effect", type: "api.save", params: {} },
          ],
        },
      },
    },
    computed: { fields: {} },
    state: { fields: {} },
    ...overrides,
  };
}

function createTestHost(options?: {
  dispatchImpl?: (intent: Intent, snapshot: Snapshot) => Promise<HostResult>;
  registeredEffects?: string[];
  initialSnapshot?: Snapshot;
}): Host {
  const effects = options?.registeredEffects ?? ["api.save", "api.fetch"];
  let currentSnapshot = options?.initialSnapshot ?? createGenesisSnapshot("test-schema-v2");

  return {
    dispatch: async (intent: Intent): Promise<HostResult> => {
      const result = options?.dispatchImpl
        ? await options.dispatchImpl(intent, currentSnapshot)
        : (() => {
            // Default: return completed with incremented version
            const currentData = currentSnapshot.data as Record<string, unknown>;
            const currentCount = (currentData?.count as number | undefined) ?? 0;
            const currentVersion = currentSnapshot.meta.version;
            const newSnapshot: Snapshot = {
              ...currentSnapshot,
              data: {
                ...(currentSnapshot.data as Record<string, unknown>),
                count: currentCount + 1,
              },
              meta: {
                ...currentSnapshot.meta,
                version: currentVersion + 1,
              },
            };
            const defaultResult: HostResult = { status: "complete", snapshot: newSnapshot };
            return defaultResult;
          })();

      currentSnapshot = result.snapshot;
      return result;
    },
    registerEffect: vi.fn(),
    getRegisteredEffectTypes: () => effects,
    reset: async (data: unknown) => {
      currentSnapshot = {
        ...currentSnapshot,
        data: (data ?? {}) as Record<string, unknown>,
      };
    },
  };
}

function createGenesisSnapshot(schemaHash: string, data: Record<string, unknown> = {}): Snapshot {
  return {
    data,
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
      timestamp: Date.now(),
      randomSeed: "test-seed",
      schemaHash,
    },
  };
}

function requireCurrentHead(app: { getCurrentHead?: () => ReturnType<typeof createWorldId> }) {
  if (!app.getCurrentHead) {
    throw new Error("getCurrentHead is unavailable");
  }
  return app.getCurrentHead();
}

async function requireSnapshot(
  app: { getSnapshot?: (worldId: ReturnType<typeof createWorldId>) => Promise<Snapshot> },
  worldId: ReturnType<typeof createWorldId>
) {
  if (!app.getSnapshot) {
    throw new Error("getSnapshot is unavailable");
  }
  return app.getSnapshot(worldId);
}

// =============================================================================
// Test Suites
// =============================================================================

describe("v2 Integration", () => {
  describe("v2 Mode Detection", () => {
    it("APP-API-1: createApp with AppConfig enables v2 mode", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const config: AppConfig = {
        schema,
        host,
        worldStore,
      };

      const app = createApp(config);
      await app.ready();

      const baseWorld = requireCurrentHead(app);
      const result = await app.submitProposal({
        proposalId: createProposalId("prop-1"),
        actorId: "actor-1",
        intentType: "counter.increment",
        intentBody: {},
        baseWorld,
        createdAt: Date.now(),
        branchId: "main",
      });

      expect(result.status).toBe("completed");
    });

    // APP-API-2 removed: legacy createApp mode no longer exists
    // All createApp calls now require Host and WorldStore
  });

  describe("v2 Action Execution Lifecycle", () => {
    it("executes action through all 9 phases", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const phases: string[] = [];
      const config: AppConfig = {
        schema,
        host,
        worldStore,
        hooks: {
          "action:preparing": () => { phases.push("preparing"); },
          "action:submitted": () => { phases.push("submitted"); },
          "action:completed": () => { phases.push("completed"); },
        },
      };

      const app = createApp(config);
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(phases).toContain("preparing");
      expect(phases).toContain("submitted");
      expect(phases).toContain("completed");
    });

    it("advances World head on successful execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const initialHead = requireCurrentHead(app);

      const handle = app.act("counter.increment", {});
      await handle.done();

      const newHead = requireCurrentHead(app);
      expect(newHead).not.toBe(initialHead);
    });

    it("BRANCH-7: does NOT advance head on failed execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost({
        dispatchImpl: async () => {
          throw new Error("Execution failed");
        },
      });
      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const initialHead = requireCurrentHead(app);

      const handle = app.act("counter.increment", {});
      const result = await handle.result();
      expect(result.status).toBe("failed");

      // Head should NOT have advanced
      const currentHead = requireCurrentHead(app);
      expect(currentHead).toBe(initialHead);
    });
  });

  describe("PolicyService Integration", () => {
    it("EXK-POLICY-1: derives ExecutionKey for proposal", async () => {
      const schema = createTestSchema();
      const host = createTestHost();

      let derivedKey: string | undefined;
      const policyService = createSilentPolicyService();
      policyService.deriveExecutionKey = (proposal) => {
        derivedKey = `key:${proposal.actorId}:${proposal.intentType}`;
        return derivedKey;
      };

      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
        policyService,
      });
      await app.ready();

      const handle = app.act("counter.increment", {}, { actorId: "actor-test" });
      await handle.done();

      expect(derivedKey).toBe("key:actor-test:counter.increment");
    });

    it("ROUTE-1/2: rejected proposal emits audit:rejected", async () => {
      const schema = createTestSchema();
      const host = createTestHost();

      const policyService = createSilentPolicyService();
      policyService.requestApproval = async () => ({
        approved: false,
        reason: "Policy denied",
        timestamp: Date.now(),
      });

      const worldStore = createInMemoryWorldStore();

      let rejectedEvent: unknown;
      const app = createApp({
        schema,
        host,
        worldStore,
        policyService,
        hooks: {
          "audit:rejected": (payload) => {
            rejectedEvent = payload;
          },
        },
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      const result = await handle.result();
      expect(result.status).toBe("rejected");
      expect(rejectedEvent).toBeDefined();
      expect((rejectedEvent as { reason: string }).reason).toBe("Policy denied");
    });

    it("SCOPE-PATH-1: validates result scope after execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost();

      let scopeValidated = false;
      const policyService = createSilentPolicyService();
      policyService.validateResultScope = () => {
        scopeValidated = true;
        return { valid: true };
      };

      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
        policyService,
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(scopeValidated).toBe(true);
    });
  });

  describe("WorldStore Integration", () => {
    it("STORE-1: stores World and delta after execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const storeSpy = vi.spyOn(worldStore, "store");

      const app = createApp({
        schema,
        host,
        worldStore,
        initialData: { count: 0 },
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(storeSpy).toHaveBeenCalled();
      const [storedWorld, storedDelta] =
        storeSpy.mock.calls[storeSpy.mock.calls.length - 1];
      expect(storedWorld.schemaHash).toBe(schema.hash);
      expect(storedDelta.patches.length).toBeGreaterThan(0);
    });

    it("STORE-2: restores snapshot from WorldStore for execution", async () => {
      const schema = createTestSchema();
      const worldStore = createInMemoryWorldStore();

      let capturedSnapshot: Snapshot | undefined;
      const restoreSpy = vi.spyOn(worldStore, "restore");
      const policyService = createSilentPolicyService();
      policyService.validateResultScope = (baseSnapshot) => {
        capturedSnapshot = baseSnapshot;
        return { valid: true };
      };
      const customHost = createTestHost({
        dispatchImpl: async (_intent, snapshot) => {
          return {
            status: "complete",
            snapshot: {
              ...snapshot,
              data: { ...(snapshot.data as Record<string, unknown>), count: 43 },
              meta: { ...snapshot.meta, version: snapshot.meta.version + 1 },
            },
          };
        },
        initialSnapshot: createGenesisSnapshot(schema.hash, { count: 0 }),
      });

      const app = createApp({
        schema,
        host: customHost,
        worldStore,
        policyService,
        initialData: { count: 42 },
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(restoreSpy).toHaveBeenCalled();
      expect(capturedSnapshot?.data).toHaveProperty("count", 42);
    });
  });

  describe("v2 Public API", () => {
    it("APP-API-3: getCurrentHead returns current World head", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const head = app.getCurrentHead?.();
      expect(head).toBeDefined();
    });

    it("APP-API-4: getSnapshot returns snapshot for WorldId", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const worldStore = createInMemoryWorldStore();

      const app = createApp({
        schema,
        host,
        worldStore,
        initialData: { count: 10 },
      });
      await app.ready();

      const head = requireCurrentHead(app);
      const snapshot = await requireSnapshot(app, head);
      expect(snapshot.data).toHaveProperty("count", 10);
    });
  });
});
