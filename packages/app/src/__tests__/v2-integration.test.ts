/**
 * v2 Integration Tests
 *
 * End-to-end tests for v2 execution path with Host, WorldStore, and PolicyService.
 *
 * @see APP-SPEC-v2.0.0 §5-10
 * @see FDR-APP-INTEGRATION-001
 */

import { describe, it, expect, vi } from "vitest";
import { createApp } from "../index.js";
import { createInMemoryWorldStore } from "../world-store/index.js";
import { createSilentPolicyService, createStrictPolicyService } from "../policy/index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { Host, HostResult, Snapshot, AppConfig, PolicyService } from "../types/index.js";
import { createWorldId, createProposalId, type World } from "@manifesto-ai/world";

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
  dispatchImpl?: Host["dispatch"];
  registeredEffects?: string[];
}): Host {
  const effects = options?.registeredEffects ?? ["api.save", "api.fetch"];

  return {
    dispatch: options?.dispatchImpl ?? (async (_snapshot: Snapshot, _intent): Promise<HostResult> => {
      // Default: return completed with incremented version
      const currentCount = (_snapshot?.data as { count?: number } | undefined)?.count ?? 0;
      const currentVersion = _snapshot?.meta?.version ?? 0;
      const newSnapshot: Snapshot = {
        ..._snapshot,
        data: {
          ...(_snapshot?.data ?? {}),
          count: currentCount + 1,
        },
        meta: {
          ...(_snapshot?.meta ?? {
            version: 0,
            timestamp: Date.now(),
            randomSeed: "test-seed",
            schemaHash: "test-schema-v2",
          }),
          version: currentVersion + 1,
        },
      };
      return { status: "completed", snapshot: newSnapshot };
    }),
    registerEffect: vi.fn(),
    getRegisteredEffectTypes: () => effects,
  };
}

function createGenesisWorld(schemaHash: string): World {
  return {
    worldId: createWorldId("world-genesis"),
    schemaHash,
    snapshotHash: "genesis-snapshot",
    createdAt: Date.now(),
    createdBy: null,
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

// =============================================================================
// Test Suites
// =============================================================================

describe("v2 Integration", () => {
  describe("v2 Mode Detection", () => {
    it("APP-API-1: createApp with AppConfig enables v2 mode", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash);
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const config: AppConfig = {
        schema,
        host,
        worldStore,
      };

      const app = createApp(config);
      await app.ready();

      // v2 mode should be enabled - verify by checking getCurrentHead exists
      expect(typeof (app as unknown as { getCurrentHead?: () => unknown }).getCurrentHead).toBe("function");
    });

    it("APP-API-2: legacy createApp does not enable v2 mode", async () => {
      const schema = createTestSchema();

      const app = createApp(schema);
      await app.ready();

      // v2 mode should NOT be enabled
      const getCurrentHead = (app as unknown as { getCurrentHead?: () => unknown }).getCurrentHead;
      expect(getCurrentHead?.()).toBeUndefined();
    });
  });

  describe("v2 Action Execution Lifecycle", () => {
    it("executes action through all 9 phases", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 0 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const phases: string[] = [];
      const config: AppConfig = {
        schema,
        host,
        worldStore,
        hooks: {
          "action:preparing": () => phases.push("preparing"),
          "action:submitted": () => phases.push("submitted"),
          "action:completed": () => phases.push("completed"),
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
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 0 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const getCurrentHead = () => (app as unknown as { getCurrentHead: () => unknown }).getCurrentHead.call(app);
      const initialHead = getCurrentHead();

      const handle = app.act("counter.increment", {});
      await handle.done();

      const newHead = getCurrentHead();
      expect(newHead).not.toBe(initialHead);
    });

    it("BRANCH-7: does NOT advance head on failed execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost({
        dispatchImpl: async () => {
          throw new Error("Execution failed");
        },
      });
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 0 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const getCurrentHead = (app as unknown as { getCurrentHead: () => unknown }).getCurrentHead;
      const initialHead = getCurrentHead();

      const handle = app.act("counter.increment", {});
      await handle.done();

      const result = await handle.result();
      expect(result.status).toBe("failed");

      // Head should NOT have advanced
      const currentHead = getCurrentHead();
      expect(currentHead).toBe(initialHead);
    });
  });

  describe("PolicyService Integration", () => {
    it("EXK-POLICY-1: derives ExecutionKey for proposal", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash);

      let derivedKey: string | undefined;
      const policyService: PolicyService = {
        ...createSilentPolicyService(),
        deriveExecutionKey: (proposal) => {
          derivedKey = `key:${proposal.actorId}:${proposal.intentType}`;
          return derivedKey;
        },
      };

      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

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
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash);

      const policyService: PolicyService = {
        ...createSilentPolicyService(),
        requestApproval: async () => ({
          approved: false,
          reason: "Policy denied",
        }),
      };

      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

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
      await handle.done();

      const result = await handle.result();
      expect(result.status).toBe("rejected");
      expect(rejectedEvent).toBeDefined();
      expect((rejectedEvent as { reason: string }).reason).toBe("Policy denied");
    });

    it("SCOPE-PATH-1: validates result scope after execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 0 });

      let scopeValidated = false;
      const policyService: PolicyService = {
        ...createSilentPolicyService(),
        validateResultScope: () => {
          scopeValidated = true;
          return { valid: true };
        },
      };

      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

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
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 0 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const storeSpy = vi.spyOn(worldStore, "store");

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(storeSpy).toHaveBeenCalled();
      const [storedWorld, storedDelta] = storeSpy.mock.calls[0];
      expect(storedWorld.schemaHash).toBe(schema.hash);
      expect(storedDelta.patches.length).toBeGreaterThan(0);
    });

    it("STORE-2: restores snapshot from WorldStore for execution", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 42 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      let capturedSnapshot: Snapshot | undefined;
      const customHost = createTestHost({
        dispatchImpl: async (snapshot) => {
          capturedSnapshot = snapshot;
          return {
            status: "completed",
            snapshot: {
              ...snapshot,
              data: { ...snapshot.data, count: 43 },
              meta: { ...snapshot.meta, version: snapshot.meta.version + 1 },
            },
          };
        },
      });

      const app = createApp({
        schema,
        host: customHost,
        worldStore,
      });
      await app.ready();

      const handle = app.act("counter.increment", {});
      await handle.done();

      expect(capturedSnapshot?.data).toHaveProperty("count", 42);
    });
  });

  describe("v2 Public API", () => {
    it("APP-API-3: getCurrentHead returns current World head", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash);
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      // Call method directly on app to preserve `this` binding
      const head = (app as unknown as { getCurrentHead: () => unknown }).getCurrentHead.call(app);
      expect(head).toBeDefined();
    });

    it("APP-API-4: getSnapshot returns snapshot for WorldId", async () => {
      const schema = createTestSchema();
      const host = createTestHost();
      const genesisWorld = createGenesisWorld(schema.hash);
      const genesisSnapshot = createGenesisSnapshot(schema.hash, { count: 10 });
      const worldStore = createInMemoryWorldStore({
        genesisWorld,
        genesisSnapshot,
        activeHorizon: 0,
      });

      const app = createApp({
        schema,
        host,
        worldStore,
      });
      await app.ready();

      // Call method directly on app to preserve `this` binding
      const snapshot = await (app as unknown as { getSnapshot: (id: unknown) => Promise<Snapshot> }).getSnapshot.call(app, genesisWorld.worldId);
      expect(snapshot.data).toHaveProperty("count", 10);
    });
  });
});
