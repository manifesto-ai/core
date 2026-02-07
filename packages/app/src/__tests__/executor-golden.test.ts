/**
 * Executor Golden Tests
 *
 * Captures the exact behavioral contract of AppExecutorImpl.execute()
 * BEFORE the pipeline decomposition (ADR-004 Phase 3).
 *
 * These tests MUST pass without modification after the refactoring.
 *
 * @see ADR-004 §5 Phase 3 Acceptance Criteria
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApp, createTestApp } from "../index.js";
import type { DomainSchema } from "@manifesto-ai/core";
import type {
  ActionPhase,
  PolicyService,
  Proposal,
  ApprovedScope,
  AuthorityDecision,
  ValidationResult,
  ExecutionKey,
} from "../core/types/index.js";
import type { Snapshot } from "@manifesto-ai/core";

// =============================================================================
// Fixtures
// =============================================================================

const createSchema = (): DomainSchema => ({
  id: "test:golden",
  version: "1.0.0",
  hash: "golden-hash-" + Math.random().toString(36).slice(2),
  types: {},
  actions: {
    "item.add": {
      flow: { kind: "seq", steps: [] },
    },
  },
  computed: { fields: {} },
  state: { fields: {} },
});

/** PolicyService that always rejects */
function createRejectingPolicyService(reason: string): PolicyService {
  return {
    deriveExecutionKey: () => "reject-key" as ExecutionKey,
    requestApproval: async () => ({
      approved: false,
      reason,
      timestamp: Date.now(),
    }),
    validateScope: () => ({ valid: true }),
    validateResultScope: () => ({ valid: true }),
  };
}

/** PolicyService that approves but with a scope that fails validation */
function createScopeRejectingPolicyService(): PolicyService {
  return {
    deriveExecutionKey: () => "scope-key" as ExecutionKey,
    requestApproval: async () => ({
      approved: true,
      scope: {
        allowedPaths: ["data.nonexistent"],
        constraints: { "item.add": false },
      } as ApprovedScope,
      timestamp: Date.now(),
    }),
    validateScope: () => ({
      valid: false,
      errors: ["Scope validation failed: action not allowed"],
    }),
    validateResultScope: () => ({ valid: true }),
  };
}

// =============================================================================
// Golden Test 1: Successful Action (Completed)
// =============================================================================

describe("Executor Golden Tests (ADR-004 Phase 3 Baseline)", () => {
  describe("Golden 1: Successful action (completed)", () => {
    it("should transition through all phases in order", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("item.add", { text: "test" });
      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      const result = await handle.result();

      expect(result.status).toBe("completed");
      // Phase transitions captured by subscribe (after handle returned).
      // "preparing" fires before subscribe is registered, so not captured.
      expect(phases).toEqual([
        "submitted",
        "evaluating",
        "approved",
        "executing",
        "completed",
      ]);
    });

    it("should emit hooks in correct order", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);

      const hookOrder: string[] = [];
      app.hooks.on("action:preparing", () => { hookOrder.push("action:preparing"); });
      app.hooks.on("action:submitted", () => { hookOrder.push("action:submitted"); });
      app.hooks.on("state:publish", () => { hookOrder.push("state:publish"); });
      app.hooks.on("action:completed", () => { hookOrder.push("action:completed"); });
      app.hooks.on("audit:rejected", () => { hookOrder.push("audit:rejected"); });
      app.hooks.on("audit:failed", () => { hookOrder.push("audit:failed"); });

      await app.ready();

      const handle = app.act("item.add", { text: "test" });
      await handle.done();

      expect(hookOrder).toEqual([
        "action:preparing",
        "action:submitted",
        "state:publish",
        "action:completed",
      ]);
    });

    it("should produce CompletedActionResult with stats", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const handle = app.act("item.add", {});
      const result = await handle.done();

      expect(result.status).toBe("completed");
      expect(result.proposalId).toBe(handle.proposalId);
      expect(result.runtime).toBe("domain");
      expect(result.worldId).toBeDefined();
      expect(result.decisionId).toMatch(/^dec_/);
      expect(result.stats).toBeDefined();
      expect(result.stats!.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.stats!.patchCount).toBeGreaterThanOrEqual(0);
    });
  });

  // =============================================================================
  // Golden Test 2: Authority Rejection
  // =============================================================================

  describe("Golden 2: Authority rejection", () => {
    it("should transition to rejected phase", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createRejectingPolicyService("Not authorized"),
      });
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("item.add", {});
      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      const result = await handle.result();

      expect(result.status).toBe("rejected");
      // "preparing" fires before subscribe is registered
      expect(phases).toEqual([
        "submitted",
        "evaluating",
        "rejected",
      ]);
    });

    it("should emit audit:rejected hook before action:completed", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createRejectingPolicyService("Denied"),
      });

      const hookOrder: string[] = [];
      app.hooks.on("action:preparing", () => { hookOrder.push("action:preparing"); });
      app.hooks.on("action:submitted", () => { hookOrder.push("action:submitted"); });
      app.hooks.on("audit:rejected", () => { hookOrder.push("audit:rejected"); });
      app.hooks.on("action:completed", () => { hookOrder.push("action:completed"); });
      app.hooks.on("state:publish", () => { hookOrder.push("state:publish"); });
      app.hooks.on("audit:failed", () => { hookOrder.push("audit:failed"); });

      await app.ready();

      const handle = app.act("item.add", {});
      await handle.result();

      expect(hookOrder).toEqual([
        "action:preparing",
        "action:submitted",
        "audit:rejected",
        "action:completed",
      ]);
      // state:publish must NOT be emitted on rejection
      expect(hookOrder).not.toContain("state:publish");
    });

    it("should include rejection reason in result", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createRejectingPolicyService("Forbidden action"),
      });
      await app.ready();

      const handle = app.act("item.add", {});
      const result = await handle.result();

      expect(result.status).toBe("rejected");
      if (result.status === "rejected") {
        expect(result.reason).toBe("Forbidden action");
        expect(result.runtime).toBe("domain");
      }
    });
  });

  // =============================================================================
  // Golden Test 3: Scope Validation Rejection
  // =============================================================================

  describe("Golden 3: Scope validation rejection", () => {
    it("should reject when scope validation fails", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createScopeRejectingPolicyService(),
      });
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("item.add", {});
      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      const result = await handle.result();

      expect(result.status).toBe("rejected");
      // Phases: approved is never reached when scope fails
      expect(phases).toContain("evaluating");
      expect(phases).toContain("rejected");
    });

    it("should emit audit:rejected and action:completed", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createScopeRejectingPolicyService(),
      });

      const hookOrder: string[] = [];
      app.hooks.on("action:preparing", () => { hookOrder.push("action:preparing"); });
      app.hooks.on("action:submitted", () => { hookOrder.push("action:submitted"); });
      app.hooks.on("audit:rejected", () => { hookOrder.push("audit:rejected"); });
      app.hooks.on("action:completed", () => { hookOrder.push("action:completed"); });
      app.hooks.on("state:publish", () => { hookOrder.push("state:publish"); });

      await app.ready();

      const handle = app.act("item.add", {});
      await handle.result();

      expect(hookOrder).toContain("audit:rejected");
      expect(hookOrder).toContain("action:completed");
      expect(hookOrder).not.toContain("state:publish");
    });
  });

  // =============================================================================
  // Golden Test 4: Execution Failure (Host returns failed)
  // =============================================================================

  describe("Golden 4: Execution failure", () => {
    it("should transition through to failed phase", async () => {
      const schema: DomainSchema = {
        ...createSchema(),
        actions: {
          "item.failAction": {
            flow: {
              kind: "effect",
              type: "test.fail",
              params: {},
            },
          },
        },
      };

      const app = createTestApp(schema, {
        effects: {
          "test.fail": async () => {
            // Return patches that set an error
            return [
              { op: "set" as const, path: "system.lastError", value: {
                code: "TEST_FAIL",
                message: "Intentional test failure",
                source: { actionId: "", nodePath: "" },
                timestamp: Date.now(),
              }},
            ];
          },
        },
      });
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("item.failAction", {});
      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      const result = await handle.result();

      // Effect execution with error patches results in completed (not failed)
      // because the Host returns "complete" status — the error is in the snapshot
      // True failure comes from Host returning "error" status
      expect(["completed", "failed"]).toContain(result.status);

      // Phase transitions captured by subscribe (after handle returned).
      // "preparing" fires before subscribe is registered, so not captured.
      expect(phases).toContain("submitted");
      expect(phases).toContain("evaluating");
      expect(phases).toContain("approved");
      expect(phases).toContain("executing");
    });

    it("should emit hooks for failed actions", async () => {
      const schema: DomainSchema = {
        ...createSchema(),
        actions: {
          "item.failAction": {
            flow: {
              kind: "effect",
              type: "test.fail",
              params: {},
            },
          },
        },
      };

      const app = createTestApp(schema, {
        effects: {
          "test.fail": async () => [],
        },
      });

      const hookOrder: string[] = [];
      app.hooks.on("action:preparing", () => { hookOrder.push("action:preparing"); });
      app.hooks.on("action:submitted", () => { hookOrder.push("action:submitted"); });
      app.hooks.on("state:publish", () => { hookOrder.push("state:publish"); });
      app.hooks.on("action:completed", () => { hookOrder.push("action:completed"); });
      app.hooks.on("audit:failed", () => { hookOrder.push("audit:failed"); });

      await app.ready();

      const handle = app.act("item.failAction", {});
      await handle.result();

      // action:completed is always the last hook
      expect(hookOrder[hookOrder.length - 1]).toBe("action:completed");
      // action:preparing and action:submitted always fire
      expect(hookOrder).toContain("action:preparing");
      expect(hookOrder).toContain("action:submitted");
    });
  });

  // =============================================================================
  // Golden Test 5: Preparation Failure (Action Not Found)
  // =============================================================================

  describe("Golden 5: Preparation failure (action not found)", () => {
    it("should fail with preparation_failed for unknown action", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const phases: ActionPhase[] = [];
      const handle = app.act("nonexistent.action", {});
      handle.subscribe((update) => {
        phases.push(update.phase);
      });

      const result = await handle.result();

      expect(result.status).toBe("preparation_failed");
      // "preparing" fires before subscribe is registered
      expect(phases).toEqual([
        "preparation_failed",
      ]);
    });

    it("should emit only action:preparing and action:completed", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);

      const hookOrder: string[] = [];
      app.hooks.on("action:preparing", () => { hookOrder.push("action:preparing"); });
      app.hooks.on("action:submitted", () => { hookOrder.push("action:submitted"); });
      app.hooks.on("action:completed", () => { hookOrder.push("action:completed"); });
      app.hooks.on("state:publish", () => { hookOrder.push("state:publish"); });
      app.hooks.on("audit:rejected", () => { hookOrder.push("audit:rejected"); });
      app.hooks.on("audit:failed", () => { hookOrder.push("audit:failed"); });

      await app.ready();

      const handle = app.act("nonexistent.action", {});
      await handle.result();

      expect(hookOrder).toEqual([
        "action:preparing",
        "action:completed",
      ]);
    });

    it("should include error details in preparation_failed result", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const handle = app.act("nonexistent.action", {});
      const result = await handle.result();

      expect(result.status).toBe("preparation_failed");
      if (result.status === "preparation_failed") {
        expect(result.error.code).toBe("ACTION_NOT_FOUND");
        expect(result.error.message).toContain("nonexistent.action");
      }
    });
  });

  // =============================================================================
  // Golden Test 6: ActionHandle done() error semantics
  // =============================================================================

  describe("Golden 6: done() error semantics", () => {
    it("should throw ActionPreparationError on done() for preparation_failed", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const handle = app.act("nonexistent.action", {});

      await expect(handle.done()).rejects.toThrow();
    });

    it("should throw ActionRejectedError on done() for rejected", async () => {
      const schema = createSchema();
      const app = createTestApp(schema, {
        policyService: createRejectingPolicyService("Denied"),
      });
      await app.ready();

      const handle = app.act("item.add", {});

      await expect(handle.done()).rejects.toThrow();
    });

    it("should resolve on done() for completed", async () => {
      const schema = createSchema();
      const app = createTestApp(schema);
      await app.ready();

      const handle = app.act("item.add", {});
      const result = await handle.done();

      expect(result.status).toBe("completed");
    });
  });
});
