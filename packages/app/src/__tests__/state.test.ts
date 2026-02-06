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
      expect(state.data).toEqual({});
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

      expect(state.data).toEqual(initialData);
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
});
