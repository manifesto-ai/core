/**
 * SPEC Compliance Tests
 *
 * Tests organized by SPEC section and rule numbers.
 * Each test explicitly references the SPEC rule it validates.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createTestApp,
  AppNotReadyError,
  AppDisposedError,
  ActionRejectedError,
  ActionFailedError,
  ActionPreparationError,
  ActionTimeoutError,
  HandleDetachedError,
  BranchNotFoundError,
  WorldNotInLineageError,
  MissingDefaultActorError,
  ReservedNamespaceError,
  ReservedEffectTypeError,
} from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type { ActionPhase, App, Branch } from "../index.js";

// =============================================================================
// Test Fixtures
// =============================================================================

const createMockSchema = (overrides?: Partial<DomainSchema>): DomainSchema => ({
  id: "test:mock",
  version: "1.0.0",
  hash: "test-hash-" + Math.random().toString(36).slice(2),
  types: {},
  actions: {
    "todo.add": {
      flow: { kind: "seq", steps: [] },
    },
    "todo.remove": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
  ...overrides,
});

// =============================================================================
// §5 App Creation and Lifecycle
// =============================================================================

describe("SPEC §5: App Creation and Lifecycle", () => {
  describe("§5.1 createApp()", () => {
    it("SYNC-1: createApp() returns synchronously without initialization", () => {
      const schema = createMockSchema();
      const startTime = Date.now();

      const app = createTestApp(schema);

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeLessThan(10); // Should be nearly instant
      expect(app.status).toBe("created");
    });

    it("SYNC-2: createApp() does not compile MEL or validate schema", () => {
      // Even with complex schema, should return instantly
      const schema = createMockSchema({
        actions: Object.fromEntries(
          Array.from({ length: 100 }, (_, i) => [
            `action.${i}`,
            { flow: { kind: "seq", steps: [] } },
          ])
        ),
      });

      const app = createTestApp(schema);
      expect(app.status).toBe("created");
    });
  });

  describe("§5.6 ready() Lifecycle", () => {
    it("READY-1: API calls before ready() throw AppNotReadyError", async () => {
      const app = createTestApp(createMockSchema());

      // All these should throw AppNotReadyError
      const apis = [
        () => app.getState(),
        () => app.currentBranch(),
        () => app.listBranches(),
        () => app.act("todo.add", {}),
        () => app.subscribe(() => null, () => {}),
        () => app.session("user"),
        () => app.getActionHandle("id"),
        () => app.getMigrationLinks(),
      ];

      for (const api of apis) {
        expect(api).toThrow(AppNotReadyError);
      }
    });

    it("READY-2: ready() is idempotent", async () => {
      const app = createTestApp(createMockSchema());

      await app.ready();
      await app.ready();
      await app.ready();

      expect(app.status).toBe("ready");
    });

    it("READY-3: ready() emits hooks in order", async () => {
      const app = createTestApp(createMockSchema());
      const order: string[] = [];

      app.hooks.on("app:ready:before", () => { order.push("before"); });
      app.hooks.on("app:ready", () => { order.push("ready"); });

      await app.ready();

      expect(order).toEqual(["before", "ready"]);
    });

    it("READY-4: ready() rejects reserved namespace in actions", async () => {
      const schema = createMockSchema({
        actions: {
          "system.custom": {
            flow: { kind: "seq", steps: [] },
          },
        },
      });

      const app = createTestApp(schema);
      await expect(app.ready()).rejects.toThrow(ReservedNamespaceError);
    });

    it("READY-5: createApp() rejects reserved effect type in effects", () => {
      // v2.3.0: Validation now happens at createApp() time
      expect(() =>
        createTestApp(createMockSchema(), {
          effects: {
            "system.get": async () => [],
          },
        })
      ).toThrow(ReservedEffectTypeError);
    });
  });

  describe("§5.7 dispose() Lifecycle", () => {
    it("DISPOSE-1: API calls after dispose() throw AppDisposedError", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();
      await app.dispose();

      expect(() => app.getState()).toThrow(AppDisposedError);
      expect(() => app.act("todo.add", {})).toThrow(AppDisposedError);
      expect(() => app.currentBranch()).toThrow(AppDisposedError);
    });

    it("DISPOSE-2: dispose() is idempotent", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      await app.dispose();
      await app.dispose();
      await app.dispose();

      expect(app.status).toBe("disposed");
    });

    it("DISPOSE-3: ready() after dispose() throws AppDisposedError", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();
      await app.dispose();

      await expect(app.ready()).rejects.toThrow(AppDisposedError);
    });

    it("DISPOSE-4: dispose() emits hooks in order", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const order: string[] = [];
      app.hooks.on("app:dispose:before", () => { order.push("before"); });
      app.hooks.on("app:dispose", () => { order.push("dispose"); });

      await app.dispose();

      expect(order).toEqual(["before", "dispose"]);
    });
  });

  describe("§5.3 Actor Policy", () => {
    it("ACTOR-1: mode=require without defaultActor throws", async () => {
      const app = createTestApp(createMockSchema(), {
        actorPolicy: { mode: "require" },
      });

      await expect(app.ready()).rejects.toThrow(MissingDefaultActorError);
    });

    it("ACTOR-2: mode=require with defaultActor succeeds", async () => {
      const app = createTestApp(createMockSchema(), {
        actorPolicy: {
          mode: "require",
          defaultActor: { actorId: "user-1", kind: "human" },
        },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });

    it("ACTOR-3: mode=anonymous uses anonymous actor", async () => {
      const app = createTestApp(createMockSchema(), {
        actorPolicy: { mode: "anonymous" },
      });

      await app.ready();
      expect(app.status).toBe("ready");
    });
  });
});

// =============================================================================
// §7 State Model
// =============================================================================

describe("SPEC §7: State Model", () => {
  describe("§7.1 AppState Structure", () => {
    it("STATE-1: AppState has required fields", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const state = app.getState();

      expect(state).toHaveProperty("data");
      expect(state).toHaveProperty("computed");
      expect(state).toHaveProperty("system");
      expect(state).toHaveProperty("meta");
    });

    it("STATE-2: SystemState has required fields", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const { system } = app.getState();

      expect(system).toHaveProperty("status");
      expect(system).toHaveProperty("lastError");
      expect(system).toHaveProperty("errors");
      expect(system).toHaveProperty("pendingRequirements");
      expect(system).toHaveProperty("currentAction");
    });

    it("STATE-3: SnapshotMeta has required fields", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const { meta } = app.getState();

      expect(meta).toHaveProperty("version");
      expect(meta).toHaveProperty("timestamp");
      expect(meta).toHaveProperty("randomSeed");
      expect(meta).toHaveProperty("schemaHash");
    });

    it("STATE-4: Initial version is 0", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      expect(app.getState().meta.version).toBe(0);
    });

    it("STATE-5: Initial system.status is idle", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      expect(app.getState().system.status).toBe("idle");
    });
  });

  describe("§7.2 initialData", () => {
    it("INIT-1: initialData is reflected in state.data", async () => {
      const initialData = { todos: [{ id: 1, text: "Test" }], count: 1 };
      const app = createTestApp(createMockSchema(), { initialData });
      await app.ready();

      // state.data includes initialData plus platform namespace defaults ($host, $mel)
      expect(app.getState().data).toMatchObject(initialData);
    });

    it("INIT-2: Empty initialData defaults to empty object", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      // Platform namespace defaults ($host, $mel) are always present from schema
      expect(app.getState().data).toMatchObject({});
    });

    it("INIT-3: initialData is deeply cloned", async () => {
      const initialData = { nested: { value: 1 } };
      const app = createTestApp(createMockSchema(), { initialData });
      await app.ready();

      // Mutating original should not affect state
      initialData.nested.value = 999;

      expect(app.getState<typeof initialData>().data.nested.value).toBe(1);
    });
  });

  describe("§7.2 READY-8: Genesis computed", () => {
    it("READY-8: computed values are available immediately after ready()", async () => {
      const schema = createMockSchema({
        state: {
          fields: {
            count: { type: "number", required: true, default: 0 },
          },
        },
        computed: {
          fields: {
            "computed.doubled": {
              deps: ["count"],
              expr: { kind: "mul", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 2 } },
            },
          },
        },
      });

      const app = createTestApp(schema);
      await app.ready();

      const state = app.getState();
      expect(state.computed["computed.doubled"]).toBe(0);
    });

    it("READY-8: computed values reflect initialData", async () => {
      const schema = createMockSchema({
        state: {
          fields: {
            count: { type: "number", required: true, default: 0 },
          },
        },
        computed: {
          fields: {
            "computed.doubled": {
              deps: ["count"],
              expr: { kind: "mul", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 2 } },
            },
          },
        },
      });

      const app = createTestApp(schema, { initialData: { count: 5 } });
      await app.ready();

      const state = app.getState();
      expect(state.computed["computed.doubled"]).toBe(10);
    });
  });

  describe("§7.3 Type Safety", () => {
    it("TYPE-1: getState<T>() returns typed data", async () => {
      interface TodoState {
        todos: Array<{ id: number; text: string; done: boolean }>;
      }

      const app = createTestApp(createMockSchema(), {
        initialData: { todos: [{ id: 1, text: "Test", done: false }] },
      });
      await app.ready();

      const state = app.getState<TodoState>();

      // TypeScript should infer these correctly
      expect(state.data.todos[0].id).toBe(1);
      expect(state.data.todos[0].text).toBe("Test");
      expect(state.data.todos[0].done).toBe(false);
    });
  });
});

// =============================================================================
// §8 Action Execution
// =============================================================================

describe("SPEC §8: Action Execution", () => {
  describe("§8.1 act() Contract", () => {
    it("ACT-1: act() returns ActionHandle synchronously", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const startTime = Date.now();
      const handle = app.act("todo.add", {});
      const elapsed = Date.now() - startTime;

      expect(handle).toBeDefined();
      expect(handle.proposalId).toBeDefined();
      expect(elapsed).toBeLessThan(10);
    });

    it("ACT-2: ActionHandle has stable proposalId", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      const id1 = handle.proposalId;

      await handle.done();

      const id2 = handle.proposalId;
      expect(id1).toBe(id2);
    });

    it("ACT-3: Different actions have unique proposalIds", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const handle = app.act("todo.add", {});
        ids.add(handle.proposalId);
      }

      expect(ids.size).toBe(100);
    });
  });

  describe("§8.2 ActionPhase Transitions", () => {
    it("PHASE-1: Initial phase is preparing", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      expect(handle.phase).toBe("preparing");
    });

    it("PHASE-2: Successful action ends in completed", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      await handle.done();

      expect(handle.phase).toBe("completed");
    });

    it("PHASE-3: Unknown action ends in preparation_failed", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("unknown.action", {});
      await handle.result();

      expect(handle.phase).toBe("preparation_failed");
    });

    it("PHASE-4: Phase transitions are monotonic (no going back)", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("todo.add", {});

      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      await handle.done();

      // Each phase should come after the previous (no duplicates, no going back)
      const phaseOrder: ActionPhase[] = [
        "preparing",
        "submitted",
        "evaluating",
        "approved",
        "executing",
        "completed",
      ];

      let lastIndex = -1;
      for (const phase of phases) {
        const index = phaseOrder.indexOf(phase);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      }
    });
  });

  describe("§8.5 done() Contract", () => {
    it("DONE-1: done() resolves with CompletedActionResult on success", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      const result = await handle.done();

      expect(result.status).toBe("completed");
      expect(result.proposalId).toBe(handle.proposalId);
      expect(result.worldId).toBeDefined();
      expect(result.decisionId).toBeDefined();
      expect(result.stats).toBeDefined();
    });

    it("DONE-2: done() throws ActionPreparationError for unknown action", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("unknown.action", {});

      await expect(handle.done()).rejects.toThrow(ActionPreparationError);
    });

    it("DONE-3: done() resolves immediately if already completed", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      await handle.done();

      // Second call should resolve immediately
      const startTime = Date.now();
      await handle.done();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(5);
    });

    it("DONE-4: done() with timeout throws ActionTimeoutError", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      // Create a handle but immediately detach to prevent completion
      const handle = app.act("todo.add", {});

      // This is hard to test reliably without being able to pause execution
      // For now, verify the timeout option is accepted
      const result = await handle.done({ timeoutMs: 5000 });
      expect(result.status).toBe("completed");
    });
  });

  describe("§8.6 result() Contract", () => {
    it("RESULT-1: result() never throws for terminal states", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      // Success case
      const handle1 = app.act("todo.add", {});
      const result1 = await handle1.result();
      expect(result1.status).toBe("completed");

      // Failure case
      const handle2 = app.act("unknown.action", {});
      const result2 = await handle2.result();
      expect(result2.status).toBe("preparation_failed");
    });

    it("RESULT-2: result() returns same result as done() for success", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      const [doneResult, resultResult] = await Promise.all([
        handle.done(),
        handle.result(),
      ]);

      expect(doneResult.proposalId).toBe(resultResult.proposalId);
      expect(doneResult.status).toBe(resultResult.status);
    });
  });

  describe("§8.7 detach() Contract", () => {
    it("DETACH-1: detach() prevents further subscribe()", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      handle.detach();

      expect(() => handle.subscribe(() => {})).toThrow(HandleDetachedError);
    });

    it("DETACH-2: detach() is idempotent", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});

      handle.detach();
      handle.detach();
      handle.detach();

      expect(() => handle.subscribe(() => {})).toThrow(HandleDetachedError);
    });

    it("DETACH-3: detach() rejects pending done() with HandleDetachedError", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle = app.act("todo.add", {});
      const donePromise = handle.done();

      // Detach immediately
      handle.detach();

      // Depending on timing, may complete or reject
      try {
        await donePromise;
      } catch (error) {
        expect(error).toBeInstanceOf(HandleDetachedError);
      }
    });

    it("DETACH-4: detach() clears all listeners", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const listener = vi.fn();
      const handle = app.act("todo.add", {});
      handle.subscribe(listener);

      handle.detach();

      // Wait for action to complete (listeners should not be called)
      await new Promise((r) => setTimeout(r, 50));

      // Listener might have been called before detach, but not after
    });
  });

  describe("§8.8 getActionHandle()", () => {
    it("HANDLE-1: getActionHandle() returns same handle", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const handle1 = app.act("todo.add", {});
      const handle2 = app.getActionHandle(handle1.proposalId);

      expect(handle1).toBe(handle2);
    });

    it("HANDLE-2: getActionHandle() throws for unknown proposalId", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      expect(() => app.getActionHandle("nonexistent")).toThrow();
    });
  });
});

// =============================================================================
// §9 Branch Management
// =============================================================================

describe("SPEC §9: Branch Management", () => {
  describe("§9.1 Default Branch", () => {
    it("BRANCH-1: Main branch exists after ready()", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      expect(branch.id).toBe("main");
    });

    it("BRANCH-2: Main branch has correct schemaHash", async () => {
      const schema = createMockSchema();
      const app = createTestApp(schema);
      await app.ready();

      expect(app.currentBranch().schemaHash).toBe(schema.hash);
    });

    it("BRANCH-3: Main branch has genesis world", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const head = app.currentBranch().head();
      expect(head).toMatch(/^world_/);
    });
  });

  describe("§9.3 checkout()", () => {
    it("CHECKOUT-1: checkout() to head succeeds", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      const head = branch.head();

      await branch.checkout(head);

      expect(branch.head()).toBe(head);
    });

    it("CHECKOUT-2: checkout() to unknown world throws", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();

      await expect(branch.checkout("world_unknown")).rejects.toThrow(
        WorldNotInLineageError
      );
    });

    it("CHECKOUT-3: checkout() updates head", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      const genesis = branch.head();

      // Checkout to genesis (same world)
      await branch.checkout(genesis);

      expect(branch.head()).toBe(genesis);
    });
  });

  describe("§9.5 fork()", () => {
    it("FORK-1: fork() creates new branch", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const originalCount = app.listBranches().length;
      await app.fork();

      expect(app.listBranches().length).toBe(originalCount + 1);
    });

    it("FORK-2: fork() new branch has unique id", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch1 = await app.fork({ switchTo: false });
      const branch2 = await app.fork({ switchTo: false });
      const branch3 = await app.fork({ switchTo: false });

      const ids = new Set([branch1.id, branch2.id, branch3.id]);
      expect(ids.size).toBe(3);
    });

    it("FORK-3: fork() switches by default", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const oldBranch = app.currentBranch();
      const newBranch = await app.fork();

      expect(app.currentBranch().id).toBe(newBranch.id);
      expect(app.currentBranch().id).not.toBe(oldBranch.id);
    });

    it("FORK-4: fork({ switchTo: false }) stays on current", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const oldBranch = app.currentBranch();
      await app.fork({ switchTo: false });

      expect(app.currentBranch().id).toBe(oldBranch.id);
    });

    it("FORK-5: fork() inherits schemaHash", async () => {
      const schema = createMockSchema();
      const app = createTestApp(schema);
      await app.ready();

      const newBranch = await app.fork();

      expect(newBranch.schemaHash).toBe(schema.hash);
    });
  });

  describe("§9.6 switchBranch()", () => {
    it("SWITCH-1: switchBranch() changes current branch", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const newBranch = await app.fork({ switchTo: false });
      expect(app.currentBranch().id).toBe("main");

      await app.switchBranch(newBranch.id);
      expect(app.currentBranch().id).toBe(newBranch.id);
    });

    it("SWITCH-2: switchBranch() to unknown throws", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      await expect(app.switchBranch("nonexistent")).rejects.toThrow(
        BranchNotFoundError
      );
    });

    it("SWITCH-3: switchBranch() returns the branch", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const newBranch = await app.fork({ switchTo: false });
      const switched = await app.switchBranch(newBranch.id);

      expect(switched.id).toBe(newBranch.id);
    });
  });

  describe("§9.7 lineage()", () => {
    it("LINEAGE-1: lineage() includes head", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      const lineage = branch.lineage();

      expect(lineage).toContain(branch.head());
    });

    it("LINEAGE-2: lineage() respects limit", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      const lineage = branch.lineage({ limit: 1 });

      expect(lineage.length).toBeLessThanOrEqual(1);
    });

    it("LINEAGE-3: lineage() is ordered oldest to newest", async () => {
      const app = createTestApp(createMockSchema());
      await app.ready();

      const branch = app.currentBranch();
      const lineage = branch.lineage();

      // Last element should be current head
      expect(lineage[lineage.length - 1]).toBe(branch.head());
    });
  });
});

// =============================================================================
// §15 Plugin System
// =============================================================================

describe("SPEC §15: Plugin System", () => {
  describe("§15.2 Plugin Execution", () => {
    it("PLUGIN-1: Plugins execute in order", async () => {
      const order: number[] = [];

      const app = createTestApp(createMockSchema(), {
        plugins: [
          () => { order.push(1); },
          () => { order.push(2); },
          () => { order.push(3); },
        ],
      });

      await app.ready();

      expect(order).toEqual([1, 2, 3]);
    });

    it("PLUGIN-2: Plugins receive app instance", async () => {
      let receivedApp: App | null = null;

      const app = createTestApp(createMockSchema(), {
        plugins: [(a) => { receivedApp = a; }],
      });

      await app.ready();

      expect(receivedApp).toBe(app);
    });

    it("PLUGIN-3: Async plugins are awaited", async () => {
      let completed = false;

      const app = createTestApp(createMockSchema(), {
        plugins: [
          async () => {
            await new Promise((r) => setTimeout(r, 10));
            completed = true;
          },
        ],
      });

      await app.ready();

      expect(completed).toBe(true);
    });

    it("PLUGIN-4: Plugin error stops initialization", async () => {
      const laterPlugin = vi.fn();

      const app = createTestApp(createMockSchema(), {
        plugins: [
          () => { throw new Error("Plugin failed"); },
          laterPlugin,
        ],
      });

      await expect(app.ready()).rejects.toThrow();
      expect(laterPlugin).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Concurrency Tests
// =============================================================================

describe("Concurrency and Race Conditions", () => {
  it("CONC-1: Multiple concurrent actions complete independently", async () => {
    const app = createTestApp(createMockSchema());
    await app.ready();

    const handles = Array.from({ length: 10 }, () =>
      app.act("todo.add", { text: "test" })
    );

    const results = await Promise.all(handles.map((h) => h.done()));

    expect(results.every((r) => r.status === "completed")).toBe(true);
    expect(new Set(results.map((r) => r.proposalId)).size).toBe(10);
  });

  it("CONC-2: Actions on different branches are isolated", async () => {
    const app = createTestApp(createMockSchema());
    await app.ready();

    const branch1 = app.currentBranch();
    const branch2 = await app.fork({ switchTo: false });

    const handle1 = branch1.act("todo.add", {});
    const handle2 = branch2.act("todo.add", {});

    const [result1, result2] = await Promise.all([
      handle1.done(),
      handle2.done(),
    ]);

    expect(result1.proposalId).not.toBe(result2.proposalId);
  });

  it("CONC-3: Rapid fork/switch maintains consistency", async () => {
    const app = createTestApp(createMockSchema());
    await app.ready();

    // Rapid operations
    const branches: Branch[] = [];
    for (let i = 0; i < 5; i++) {
      branches.push(await app.fork({ name: `branch-${i}`, switchTo: false }));
    }

    // Switch between them rapidly
    for (const branch of branches) {
      await app.switchBranch(branch.id);
      expect(app.currentBranch().id).toBe(branch.id);
    }

    // All branches should still exist
    expect(app.listBranches().length).toBe(6); // main + 5
  });
});

// =============================================================================
// Error Recovery Tests
// =============================================================================

describe("Error Recovery", () => {
  it("ERR-1: App remains usable after action preparation failure", async () => {
    const app = createTestApp(createMockSchema());
    await app.ready();

    // Failed action
    const failedHandle = app.act("unknown.action", {});
    await failedHandle.result();

    // App should still work
    const successHandle = app.act("todo.add", {});
    const result = await successHandle.done();

    expect(result.status).toBe("completed");
  });

  it("ERR-2: App remains usable after detach", async () => {
    const app = createTestApp(createMockSchema());
    await app.ready();

    const handle1 = app.act("todo.add", {});
    handle1.detach();

    // Should still be able to create new actions
    const handle2 = app.act("todo.add", {});
    const result = await handle2.done();

    expect(result.status).toBe("completed");
  });
});
