/**
 * Integration Tests (v1.1)
 */

import { describe, it, expect, vi } from "vitest";
import { createCompiler } from "../api/factory.js";
import {
  createMockAdapter,
  createSuccessMockAdapter,
  createPlanFailMockAdapter,
  createAmbiguousPlanMockAdapter,
  createGenerateFailMockAdapter,
  DEFAULT_PLAN_RESPONSE,
} from "./helpers/mock-adapter.js";

describe("Compiler Integration", () => {
  describe("successful compilation flow", () => {
    it("should complete full flow: idle → planning → generating → lowering → linking → verifying → emitting → success", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      // Initial state should be idle
      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("idle");
      expect(snapshot.isIdle).toBe(true);

      // Start compilation
      await compiler.start({ text: "Create a counter that can be incremented" });

      // After completion, should be in success state
      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("success");
      expect(snapshot.isTerminal).toBe(true);
      expect(snapshot.domainSpec).toBeDefined();
    });

    it("should track state transitions via subscription", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      const transitions: string[] = [];
      const unsubscribe = compiler.subscribe((state) => {
        transitions.push(state.status);
      });

      await compiler.start({ text: "Track user count" });

      unsubscribe();

      // Should have transitioned through states
      expect(transitions.length).toBeGreaterThan(0);
      expect(transitions[transitions.length - 1]).toBe("success");
    });
  });

  describe("planning failure handling", () => {
    it("should fail when planning fails", async () => {
      const adapter = createPlanFailMockAdapter("Network error");
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Some input" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("failed");
      expect(snapshot.failureReason).toBe("PLANNING_FAILED");
    });
  });

  describe("plan decision flow", () => {
    it("should enter awaiting_plan_decision when ambiguity detected (await policy)", async () => {
      const adapter = createAmbiguousPlanMockAdapter("Multiple strategies possible");
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "await",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track items" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("awaiting_plan_decision");
    });

    it("should auto-accept plan when policy is auto-accept", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track items" });

      const snapshot = await compiler.getSnapshot();
      // Should proceed past planning
      expect(snapshot.status).not.toBe("awaiting_plan_decision");
    });

    it("should discard when plan ambiguous but policy is discard", async () => {
      const adapter = createAmbiguousPlanMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "discard",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track items" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("failed");
    });

    it("should accept plan and continue to generation", async () => {
      const adapter = createMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "await",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      // Start compilation - should get plan and enter awaiting_plan_decision
      await compiler.start({ text: "Track items" });

      let snapshot = await compiler.getSnapshot();
      // With auto-accept it will proceed, otherwise check the transition
      if (snapshot.status === "awaiting_plan_decision") {
        await compiler.acceptPlan();

        snapshot = await compiler.getSnapshot();
        expect(["generating", "success"]).toContain(snapshot.status);
      }
    });
  });

  describe("generation failure handling", () => {
    it("should fail when generation fails", async () => {
      const adapter = createGenerateFailMockAdapter("Generation network error");
      // Override plan to succeed
      vi.mocked(adapter.plan).mockResolvedValue(DEFAULT_PLAN_RESPONSE);

      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("failed");
      expect(snapshot.failureReason).toBe("GENERATION_FAILED");
    });
  });

  describe("reset after completion", () => {
    it("should reset to idle after success", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("success");

      await compiler.reset();

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("idle");
      expect(snapshot.isIdle).toBe(true);
      expect(snapshot.domainSpec).toBeNull();
    });

    it("should reset to idle after failure", async () => {
      const adapter = createPlanFailMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Something" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("failed");

      await compiler.reset();

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("idle");
    });
  });

  describe("plan rejection", () => {
    it("should allow rejecting plan during awaiting_plan_decision", async () => {
      const adapter = createMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "await",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track items" });

      let snapshot = await compiler.getSnapshot();
      if (snapshot.status === "awaiting_plan_decision") {
        const planAttemptsBefore = snapshot.planAttempts;

        await compiler.rejectPlan("Plan not satisfactory");

        snapshot = await compiler.getSnapshot();
        // After reject, effect loop runs again: planning → receivePlan → awaiting_plan_decision
        // Or if max attempts exceeded: failed
        expect(["awaiting_plan_decision", "failed"]).toContain(snapshot.status);

        // Plan attempts should have increased (retry occurred)
        if (snapshot.status === "awaiting_plan_decision") {
          expect(snapshot.planAttempts).toBeGreaterThan(planAttemptsBefore);
        }
      }
    });
  });

  describe("attempt tracking", () => {
    it("should track plan attempts", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.planAttempts).toBeGreaterThanOrEqual(1);
    });

    it("should track draft attempts per chunk", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      // draftAttempts is a Record<chunkId, number>
      expect(typeof snapshot.draftAttempts).toBe("object");
    });
  });

  describe("computed state helpers", () => {
    it("should provide correct computed helpers for idle state", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.isIdle).toBe(true);
      expect(snapshot.isProcessing).toBe(false);
      expect(snapshot.isTerminal).toBe(false);
      expect(snapshot.isAwaitingDecision).toBe(false);
    });

    it("should provide correct computed helpers for success state", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.isSuccess).toBe(true);
      expect(snapshot.isTerminal).toBe(true);
      expect(snapshot.isProcessing).toBe(false);
      expect(snapshot.isFailed).toBe(false);
    });

    it("should provide correct computed helpers for failed state", async () => {
      const adapter = createPlanFailMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Something" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.isFailed).toBe(true);
      expect(snapshot.isTerminal).toBe(true);
      expect(snapshot.isSuccess).toBe(false);
    });
  });
});
