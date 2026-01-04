/**
 * Action Catalog Projector Tests
 *
 * Per Intent & Projection Specification v1.1 (§7.4)
 */
import { describe, it, expect } from "vitest";
import type { ActorRef } from "@manifesto-ai/world";
import type { ExprNode } from "@manifesto-ai/core";
import type { SnapshotView } from "../schema/snapshot-view.js";
import {
  DefaultActionCatalogProjector,
  createActionCatalogProjector,
} from "./projector.js";
import { computeCatalogHash, getAppliedPruningOptions } from "./hash.js";
import type {
  ActionDescriptor,
  AvailabilityContext,
  PruningOptions,
} from "./types.js";

// ============================================================================
// Test Fixtures
// ============================================================================

const mockActor: ActorRef = {
  actorId: "test-user",
  kind: "human",
  name: "Test User",
};

const mockSnapshot: SnapshotView = {
  data: {
    user: { role: "admin", active: true },
    todos: [],
  },
  computed: {
    canCreateTodo: true,
    canDeleteTodo: false,
    todoCount: 0,
  },
};

const schemaHash = "test-schema-hash-12345";

// ============================================================================
// Projector Tests
// ============================================================================

describe("DefaultActionCatalogProjector", () => {
  describe("projectActionCatalog", () => {
    it("should return ActionCatalog with correct kind", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "todo.create", label: "Create Todo" },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      expect(catalog.kind).toBe("action_catalog");
      expect(catalog.schemaHash).toBe(schemaHash);
      expect(catalog.catalogHash).toBeDefined();
      expect(catalog.actions).toHaveLength(1);
    });

    it("should mark actions as available when no predicate", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "todo.create" },
        { type: "todo.list", available: null },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      expect(catalog.actions).toHaveLength(2);
      expect(catalog.actions[0].availability.status).toBe("available");
      expect(catalog.actions[1].availability.status).toBe("available");
    });

    it("should evaluate fn predicates correctly", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        {
          type: "admin.action",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              (ctx.data as { user: { role: string } }).user.role === "admin",
          },
        },
        {
          type: "user.action",
          available: {
            kind: "fn",
            evaluate: (ctx: AvailabilityContext) =>
              (ctx.data as { user: { role: string } }).user.role === "user",
          },
        },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      // admin.action should be available (user.role === "admin")
      const adminAction = catalog.actions.find((a) => a.type === "admin.action");
      expect(adminAction?.availability.status).toBe("available");

      // user.action should not be in catalog (pruned by default)
      const userAction = catalog.actions.find((a) => a.type === "user.action");
      expect(userAction).toBeUndefined();
    });

    it("should handle fn predicate errors as unknown/indeterminate", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        {
          type: "error.action",
          available: {
            kind: "fn",
            evaluate: () => {
              throw new Error("Evaluation error");
            },
          },
        },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { policy: "mark_only" },
      });

      expect(catalog.actions[0].availability.status).toBe("unknown");
      expect(
        (catalog.actions[0].availability as { reason: string }).reason
      ).toBe("indeterminate");
    });

    it("should evaluate ExprNode predicates", async () => {
      const projector = createActionCatalogProjector();

      // ExprNode that evaluates to true
      const trueExpr: ExprNode = { kind: "lit", value: true };

      // ExprNode that evaluates to false
      const falseExpr: ExprNode = { kind: "lit", value: false };

      // ExprNode that reads computed value
      const computedExpr: ExprNode = {
        kind: "get",
        path: "computed.canCreateTodo",
      };

      const actions: ActionDescriptor[] = [
        { type: "always.available", available: trueExpr },
        { type: "never.available", available: falseExpr },
        { type: "computed.check", available: computedExpr },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { policy: "mark_only" },
      });

      const always = catalog.actions.find((a) => a.type === "always.available");
      const never = catalog.actions.find((a) => a.type === "never.available");
      const computed = catalog.actions.find((a) => a.type === "computed.check");

      expect(always?.availability.status).toBe("available");
      expect(never?.availability.status).toBe("unavailable");
      expect(computed?.availability.status).toBe("available");
    });
  });

  describe("pruning policy", () => {
    it("should drop unavailable actions by default", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "available", available: { kind: "lit", value: true } as ExprNode },
        { type: "unavailable", available: { kind: "lit", value: false } as ExprNode },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      expect(catalog.actions).toHaveLength(1);
      expect(catalog.actions[0].type).toBe("available");
    });

    it("should keep all actions with mark_only policy", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "available", available: { kind: "lit", value: true } as ExprNode },
        { type: "unavailable", available: { kind: "lit", value: false } as ExprNode },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { policy: "mark_only" },
      });

      expect(catalog.actions).toHaveLength(2);
    });

    it("should include unknown status by default", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        {
          type: "unknown.action",
          // ExprNode that returns null (missing context)
          available: { kind: "get", path: "nonexistent.path" } as ExprNode,
        },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      expect(catalog.actions).toHaveLength(1);
      expect(catalog.actions[0].availability.status).toBe("unknown");
    });

    it("should exclude unknown status when includeUnknown is false", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        {
          type: "unknown.action",
          available: { kind: "get", path: "nonexistent.path" } as ExprNode,
        },
        { type: "available.action" },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { includeUnknown: false },
      });

      expect(catalog.actions).toHaveLength(1);
      expect(catalog.actions[0].type).toBe("available.action");
    });
  });

  describe("sorting", () => {
    it("should sort by type_lex by default", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "zebra.action" },
        { type: "alpha.action" },
        { type: "middle.action" },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      expect(catalog.actions[0].type).toBe("alpha.action");
      expect(catalog.actions[1].type).toBe("middle.action");
      expect(catalog.actions[2].type).toBe("zebra.action");
    });

    it("should preserve schema_order when specified", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "zebra.action" },
        { type: "alpha.action" },
        { type: "middle.action" },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { sort: "schema_order" },
      });

      expect(catalog.actions[0].type).toBe("zebra.action");
      expect(catalog.actions[1].type).toBe("alpha.action");
      expect(catalog.actions[2].type).toBe("middle.action");
    });
  });

  describe("maxActions limit", () => {
    it("should limit actions after sorting", async () => {
      const projector = createActionCatalogProjector();
      const actions: ActionDescriptor[] = [
        { type: "c.action" },
        { type: "a.action" },
        { type: "b.action" },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
        pruning: { maxActions: 2 },
      });

      expect(catalog.actions).toHaveLength(2);
      expect(catalog.actions[0].type).toBe("a.action");
      expect(catalog.actions[1].type).toBe("b.action");
    });
  });

  describe("field preservation", () => {
    it("should preserve label, description, inputSchema", async () => {
      const projector = createActionCatalogProjector();
      const inputSchema = { type: "object", properties: { title: { type: "string" } } };
      const actions: ActionDescriptor[] = [
        {
          type: "todo.create",
          label: "Create Todo",
          description: "Creates a new todo item",
          inputSchema,
        },
      ];

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions,
      });

      const action = catalog.actions[0];
      expect(action.label).toBe("Create Todo");
      expect(action.description).toBe("Creates a new todo item");
      expect(action.inputSchema).toEqual(inputSchema);
    });
  });

  describe("empty actions", () => {
    it("should handle empty actions array", async () => {
      const projector = createActionCatalogProjector();

      const catalog = await projector.projectActionCatalog({
        schemaHash,
        snapshot: mockSnapshot,
        actor: mockActor,
        actions: [],
      });

      expect(catalog.kind).toBe("action_catalog");
      expect(catalog.actions).toHaveLength(0);
      expect(catalog.catalogHash).toBeDefined();
    });
  });
});

// ============================================================================
// Hash Tests
// ============================================================================

describe("catalogHash", () => {
  it("should be deterministic for same inputs", async () => {
    const actions = [
      {
        type: "action.a",
        availability: { status: "available" as const },
      },
    ];
    const pruning = getAppliedPruningOptions({});

    const hash1 = await computeCatalogHash(schemaHash, actions, pruning);
    const hash2 = await computeCatalogHash(schemaHash, actions, pruning);

    expect(hash1).toBe(hash2);
  });

  it("should differ for different schema hashes", async () => {
    const actions = [
      {
        type: "action.a",
        availability: { status: "available" as const },
      },
    ];
    const pruning = getAppliedPruningOptions({});

    const hash1 = await computeCatalogHash("schema-1", actions, pruning);
    const hash2 = await computeCatalogHash("schema-2", actions, pruning);

    expect(hash1).not.toBe(hash2);
  });

  it("should differ for different action statuses", async () => {
    const pruning = getAppliedPruningOptions({});

    const actions1 = [
      {
        type: "action.a",
        availability: { status: "available" as const },
      },
    ];
    const actions2 = [
      {
        type: "action.a",
        availability: { status: "unavailable" as const },
      },
    ];

    const hash1 = await computeCatalogHash(schemaHash, actions1, pruning);
    const hash2 = await computeCatalogHash(schemaHash, actions2, pruning);

    expect(hash1).not.toBe(hash2);
  });

  it("should include unknown reason in hash", async () => {
    const pruning = getAppliedPruningOptions({});

    const actions1 = [
      {
        type: "action.a",
        availability: { status: "unknown" as const, reason: "missing_context" as const },
      },
    ];
    const actions2 = [
      {
        type: "action.a",
        availability: { status: "unknown" as const, reason: "indeterminate" as const },
      },
    ];

    const hash1 = await computeCatalogHash(schemaHash, actions1, pruning);
    const hash2 = await computeCatalogHash(schemaHash, actions2, pruning);

    expect(hash1).not.toBe(hash2);
  });

  it("should differ for different pruning options", async () => {
    const actions = [
      {
        type: "action.a",
        availability: { status: "available" as const },
      },
    ];

    const pruning1 = getAppliedPruningOptions({ policy: "drop_unavailable" });
    const pruning2 = getAppliedPruningOptions({ policy: "mark_only" });

    const hash1 = await computeCatalogHash(schemaHash, actions, pruning1);
    const hash2 = await computeCatalogHash(schemaHash, actions, pruning2);

    expect(hash1).not.toBe(hash2);
  });
});

// ============================================================================
// Default Pruning Options Tests
// ============================================================================

describe("getAppliedPruningOptions", () => {
  it("should apply defaults when no options provided", () => {
    const applied = getAppliedPruningOptions(undefined);

    expect(applied.policy).toBe("drop_unavailable");
    expect(applied.includeUnknown).toBe(true);
    expect(applied.sort).toBe("type_lex");
    expect(applied.maxActions).toBeNull();
  });

  it("should preserve provided options", () => {
    const options: PruningOptions = {
      policy: "mark_only",
      includeUnknown: false,
      sort: "schema_order",
      maxActions: 10,
    };

    const applied = getAppliedPruningOptions(options);

    expect(applied.policy).toBe("mark_only");
    expect(applied.includeUnknown).toBe(false);
    expect(applied.sort).toBe("schema_order");
    expect(applied.maxActions).toBe(10);
  });

  it("should merge partial options with defaults", () => {
    const options: PruningOptions = {
      maxActions: 5,
    };

    const applied = getAppliedPruningOptions(options);

    expect(applied.policy).toBe("drop_unavailable");
    expect(applied.includeUnknown).toBe(true);
    expect(applied.sort).toBe("type_lex");
    expect(applied.maxActions).toBe(5);
  });
});
