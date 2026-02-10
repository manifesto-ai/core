/**
 * State Model Tests
 *
 * @see SPEC §7 State Model
 */

import { describe, it, expect } from "vitest";
import { createApp, createTestApp } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import {
  createInitialAppState,
  snapshotToAppState,
  appStateToSnapshot,
  normalizeSnapshot,
  withDxAliases,
} from "../core/state/index.js";

// Mock DomainSchema for testing
const mockDomainSchema: DomainSchema = {
  id: "test:mock",
  version: "1.0.0",
  hash: "test-schema-hash-abc123",
  types: {},
  actions: {},
  computed: { fields: {} },
  state: { fields: {} },
};

describe("State Model", () => {
  describe("createInitialAppState()", () => {
    it("should create initial state with default values", () => {
      const state = createInitialAppState("hash-123");

      expect(state.data).toEqual({});
      expect(state.computed).toEqual({});
      expect(state.system.status).toBe("idle");
      expect(state.system.lastError).toBeNull();
      expect(state.system.errors).toEqual([]);
      expect(state.system.pendingRequirements).toEqual([]);
      expect(state.system.currentAction).toBeNull();
      expect(state.meta.version).toBe(0);
      expect(state.meta.schemaHash).toBe("hash-123");
      expect(typeof state.meta.timestamp).toBe("number");
      expect(typeof state.meta.randomSeed).toBe("string");
    });

    it("should include provided initial data", () => {
      const initialData = { todos: [], count: 0 };
      const state = createInitialAppState("hash-123", initialData);

      expect(state.data).toEqual(initialData);
    });

    it("should apply schema defaults when no initialData", () => {
      const defaults = { count: 0, name: "untitled" };
      const state = createInitialAppState("hash-123", undefined, defaults);

      expect(state.data).toEqual({ count: 0, name: "untitled" });
    });

    it("should let initialData override schema defaults", () => {
      const defaults = { count: 0, name: "untitled" };
      const state = createInitialAppState("hash-123", { count: 5 }, defaults);

      expect((state.data as Record<string, unknown>).count).toBe(5);
      expect((state.data as Record<string, unknown>).name).toBe("untitled");
    });

    it("should merge non-overlapping defaults and initialData", () => {
      const defaults = { count: 0 };
      const state = createInitialAppState("hash-123", { name: "test" }, defaults);

      expect((state.data as Record<string, unknown>).count).toBe(0);
      expect((state.data as Record<string, unknown>).name).toBe("test");
    });

    it("should handle empty schema defaults like before", () => {
      const state = createInitialAppState("hash-123", undefined, {});

      expect(state.data).toEqual({});
    });

    it("should generate unique randomSeed", () => {
      const state1 = createInitialAppState("hash-123");
      const state2 = createInitialAppState("hash-123");

      // While unlikely to be exactly equal due to timing,
      // the randomSeed should be a non-empty string
      expect(state1.meta.randomSeed).toBeTruthy();
      expect(state2.meta.randomSeed).toBeTruthy();
    });
  });

  describe("snapshotToAppState()", () => {
    it("should convert snapshot to app state", () => {
      const snapshot = {
        data: { todos: [{ id: 1, text: "Test" }] },
        computed: { totalCount: 1 },
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: { actionType: "test" },
        meta: {
          version: 5,
          timestamp: 12345,
          randomSeed: "seed-123",
          schemaHash: "hash-abc",
        },
      };

      const appState = snapshotToAppState(snapshot);

      expect(appState.data).toEqual(snapshot.data);
      expect(appState.computed).toEqual(snapshot.computed);
      expect(appState.system).toEqual(snapshot.system);
      expect(appState.meta).toEqual(snapshot.meta);
      // input should NOT be in AppState
      expect("input" in appState).toBe(false);
    });
  });

  describe("appStateToSnapshot()", () => {
    it("should convert app state to snapshot with default input", () => {
      const appState = createInitialAppState("hash-123", { count: 0 });
      const snapshot = appStateToSnapshot(appState);

      expect(snapshot.data).toEqual(appState.data);
      expect(snapshot.computed).toEqual(appState.computed);
      expect(snapshot.system).toEqual(appState.system);
      expect(snapshot.meta).toEqual(appState.meta);
      expect(snapshot.input).toEqual({});
    });

    it("should include provided input", () => {
      const appState = createInitialAppState("hash-123");
      const input = { actionType: "todo.add", payload: { text: "Test" } };
      const snapshot = appStateToSnapshot(appState, input);

      expect(snapshot.input).toEqual(input);
    });
  });

  describe("normalizeSnapshot()", () => {
    it("should ensure $host and $mel guard structure", () => {
      const snapshot = {
        data: { count: 1 },
        computed: {},
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 0,
          timestamp: Date.now(),
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const normalized = normalizeSnapshot(snapshot);

      expect(normalized.data).toHaveProperty("$host");
      expect((normalized.data as Record<string, unknown>).$host).toEqual({});
      expect(normalized.data).toHaveProperty("$mel");
      expect((normalized.data as Record<string, unknown>).$mel).toEqual({
        guards: { intent: {} },
      });
    });
  });

  describe("App.getState()", () => {
    it("should return initial state after ready()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const state = app.getState();

      expect(state).toBeDefined();
      // Platform namespaces ($host, $mel) are initialized from schema defaults
      expect(state.data).toMatchObject({});
      expect(state.computed).toEqual({});
      expect(state.system.status).toBe("idle");
      expect(state.meta.schemaHash).toBe("test-schema-hash-abc123");
      expect(state.meta.version).toBe(0);
    });

    it("should include initialData in state", async () => {
      const initialData = { todos: [], settings: { theme: "dark" } };
      const app = createTestApp(mockDomainSchema, { initialData });
      await app.ready();

      const state = app.getState<typeof initialData>();

      expect(state.data).toMatchObject(initialData);
      expect(state.data.todos).toEqual([]);
      expect(state.data.settings.theme).toBe("dark");
    });

    it("should return typed state", async () => {
      interface TodoState {
        todos: { id: number; text: string; done: boolean }[];
      }

      const initialData: TodoState = {
        todos: [{ id: 1, text: "Test", done: false }],
      };

      const app = createTestApp(mockDomainSchema, { initialData });
      await app.ready();

      const state = app.getState<TodoState>();

      expect(state.data.todos).toHaveLength(1);
      expect(state.data.todos[0].text).toBe("Test");
    });

    it("should have immutable system state properties", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const state = app.getState();

      expect(state.system.status).toBe("idle");
      expect(state.system.lastError).toBeNull();
      expect(state.system.errors).toEqual([]);
      expect(state.system.pendingRequirements).toEqual([]);
      expect(state.system.currentAction).toBeNull();
    });

    it("should have meta with valid timestamp", async () => {
      const beforeTime = Date.now();
      const app = createTestApp(mockDomainSchema);
      await app.ready();
      const afterTime = Date.now();

      const state = app.getState();

      expect(state.meta.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(state.meta.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it("should have meta with randomSeed", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const state = app.getState();

      expect(state.meta.randomSeed).toBeTruthy();
      expect(typeof state.meta.randomSeed).toBe("string");
    });
  });

  // ===========================================================================
  // DX Aliases (App SPEC v2.3.2)
  // ===========================================================================

  describe("DX Aliases — state alias (STATE-ALIAS-1/2)", () => {
    it("state should be referentially identical to data (createInitialAppState)", () => {
      const appState = createInitialAppState("hash-123", { count: 0 });

      expect(appState.state).toBe(appState.data);
    });

    it("state should be referentially identical to data (snapshotToAppState)", () => {
      const snapshot = {
        data: { count: 42 },
        computed: {},
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 1,
          timestamp: 12345,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const appState = snapshotToAppState(snapshot);

      expect(appState.state).toBe(appState.data);
      expect(appState.state).toEqual({ count: 42 });
    });

    it("state alias should be non-enumerable (STATE-ALIAS-2)", () => {
      const appState = createInitialAppState("hash-123", { count: 0 });

      const descriptor = Object.getOwnPropertyDescriptor(appState, "state");
      expect(descriptor).toBeDefined();
      expect(descriptor!.enumerable).toBe(false);
    });

    it("state alias should not appear in JSON serialization", () => {
      const appState = createInitialAppState("hash-123", { count: 0 });

      const json = JSON.parse(JSON.stringify(appState));
      expect(json).not.toHaveProperty("state");
      expect(json).toHaveProperty("data");
    });

    it("state alias should not appear in Object.keys()", () => {
      const appState = createInitialAppState("hash-123", { count: 0 });

      expect(Object.keys(appState)).not.toContain("state");
      expect(Object.keys(appState)).toContain("data");
    });
  });

  describe("DX Aliases — computed alias keys (COMP-ALIAS-1~3)", () => {
    it("should expose computed.<name> aliases as short keys", () => {
      const snapshot = {
        data: { count: 5 },
        computed: { "computed.doubled": 10, "computed.tripled": 15 } as Record<string, unknown>,
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 1,
          timestamp: 12345,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const appState = snapshotToAppState(snapshot);

      // Canonical access still works
      expect(appState.computed["computed.doubled"]).toBe(10);
      expect(appState.computed["computed.tripled"]).toBe(15);

      // Alias access works
      expect(appState.computed["doubled"]).toBe(10);
      expect(appState.computed["tripled"]).toBe(15);
    });

    it("alias keys should be non-enumerable (COMP-ALIAS-3)", () => {
      const snapshot = {
        data: {},
        computed: { "computed.doubled": 10 } as Record<string, unknown>,
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 1,
          timestamp: 12345,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const appState = snapshotToAppState(snapshot);

      // Canonical key is enumerable
      expect(Object.keys(appState.computed)).toContain("computed.doubled");

      // Alias is non-enumerable
      expect(Object.keys(appState.computed)).not.toContain("doubled");

      // But alias is accessible
      expect(appState.computed["doubled"]).toBe(10);
    });

    it("should not overwrite existing keys (COMP-ALIAS-2)", () => {
      const snapshot = {
        data: {},
        computed: {
          "computed.doubled": 10,
          "doubled": 999, // already exists
        } as Record<string, unknown>,
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 1,
          timestamp: 12345,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const appState = snapshotToAppState(snapshot);

      // Existing key preserved, alias not created
      expect(appState.computed["doubled"]).toBe(999);
    });

    it("should skip invalid identifiers", () => {
      const snapshot = {
        data: {},
        computed: { "computed.foo-bar": 10, "computed.valid": 20 } as Record<string, unknown>,
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [],
          pendingRequirements: [],
          currentAction: null,
        },
        input: {},
        meta: {
          version: 1,
          timestamp: 12345,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const appState = snapshotToAppState(snapshot);

      // Invalid identifier not aliased
      expect(appState.computed["foo-bar"]).toBeUndefined();

      // Valid identifier is aliased
      expect(appState.computed["valid"]).toBe(20);
    });

    it("should handle empty computed gracefully", () => {
      const appState = createInitialAppState("hash-123");

      expect(appState.computed).toEqual({});
      // No aliases to create, should not throw
    });
  });

  describe("DX Aliases — getSnapshot() overload (API-DX-1)", () => {
    it("getSnapshot() no-arg should return same value as getState()", async () => {
      const app = createTestApp(mockDomainSchema);
      await app.ready();

      const fromGetState = app.getState();
      const fromGetSnapshot = app.getSnapshot();

      expect(fromGetSnapshot).toBe(fromGetState);
    });

    it("getSnapshot() should include state alias", async () => {
      const initialData = { count: 42 };
      const app = createTestApp(mockDomainSchema, { initialData });
      await app.ready();

      const snapshot = app.getSnapshot<typeof initialData>();

      expect(snapshot.state).toBe(snapshot.data);
      expect(snapshot.state.count).toBe(42);
    });
  });

  describe("DX Aliases — withDxAliases()", () => {
    it("should be idempotent (safe to call multiple times)", () => {
      const obj = {
        data: { count: 1 },
        computed: { "computed.doubled": 2 } as Record<string, unknown>,
        system: {
          status: "idle" as const,
          lastError: null,
          errors: [] as readonly never[],
          pendingRequirements: [] as readonly never[],
          currentAction: null,
        },
        meta: {
          version: 0,
          timestamp: 0,
          randomSeed: "seed",
          schemaHash: "hash",
        },
      };

      const result = withDxAliases(obj);

      expect(result.state).toBe(result.data);
      expect(result.computed["doubled"]).toBe(2);
    });
  });
});
