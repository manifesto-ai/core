/**
 * Domain Tests (v1.1)
 */

import { describe, it, expect } from "vitest";
import { CompilerDomain, INITIAL_STATE } from "../domain/domain.js";
import { CompilerStateSchema } from "../domain/schema.js";

describe("CompilerDomain", () => {
  describe("schema", () => {
    it("should have valid schema structure", () => {
      expect(CompilerDomain.schema).toBeDefined();
      expect(CompilerDomain.schema.id).toBe("manifesto:compiler");
      expect(CompilerDomain.schema.version).toBe("1.1.0");
    });

    it("should have all required v1.1 actions", () => {
      const actionNames = Object.keys(CompilerDomain.schema.actions);

      // Initialization
      expect(actionNames).toContain("start");

      // Plan phase
      expect(actionNames).toContain("receivePlan");
      expect(actionNames).toContain("acceptPlan");
      expect(actionNames).toContain("rejectPlan");

      // Generate phase
      expect(actionNames).toContain("receiveFragmentDraft");
      expect(actionNames).toContain("acceptDraft");
      expect(actionNames).toContain("rejectDraft");

      // Pipeline phase (effect-driven, receive actions only)
      expect(actionNames).toContain("receiveLoweredFragments");
      expect(actionNames).toContain("receiveLinkResult");
      expect(actionNames).toContain("resolveConflict");
      expect(actionNames).toContain("receiveVerification");
      expect(actionNames).toContain("receiveEmitted");

      // Terminal
      expect(actionNames).toContain("fail");
      expect(actionNames).toContain("reset");
    });

    it("should have all required computed values", () => {
      const computedNames = Object.keys(CompilerDomain.schema.computed.fields);

      // Status helpers
      expect(computedNames).toContain("computed.isIdle");
      expect(computedNames).toContain("computed.isPlanning");
      expect(computedNames).toContain("computed.isAwaitingPlanDecision");
      expect(computedNames).toContain("computed.isGenerating");
      expect(computedNames).toContain("computed.isAwaitingDraftDecision");
      expect(computedNames).toContain("computed.isLowering");
      expect(computedNames).toContain("computed.isLinking");
      expect(computedNames).toContain("computed.isAwaitingConflictResolution");
      expect(computedNames).toContain("computed.isVerifying");
      expect(computedNames).toContain("computed.isEmitting");
      expect(computedNames).toContain("computed.isSuccess");
      expect(computedNames).toContain("computed.isFailed");

      // Aggregate helpers
      expect(computedNames).toContain("computed.isTerminal");
      expect(computedNames).toContain("computed.isProcessing");
      expect(computedNames).toContain("computed.isAwaitingDecision");
      expect(computedNames).toContain("computed.canRetryPlan");
      expect(computedNames).toContain("computed.hasMoreChunks");
    });
  });

  describe("initial state", () => {
    it("should validate against schema", () => {
      const result = CompilerStateSchema.safeParse(INITIAL_STATE);
      expect(result.success).toBe(true);
    });

    it("should have correct v1.1 default values", () => {
      expect(INITIAL_STATE.status).toBe("idle");
      expect(INITIAL_STATE.sourceInput).toBeNull();
      expect(INITIAL_STATE.plan).toBeNull();
      expect(INITIAL_STATE.chunks).toEqual([]);
      expect(INITIAL_STATE.currentChunkIndex).toBe(0);
      expect(INITIAL_STATE.fragmentDrafts).toEqual([]);
      expect(INITIAL_STATE.fragments).toEqual([]);
      expect(INITIAL_STATE.domainDraft).toBeNull();
      expect(INITIAL_STATE.conflicts).toEqual([]);
      expect(INITIAL_STATE.pendingResolution).toBeNull();
      expect(INITIAL_STATE.resolutionHistory).toEqual([]);
      expect(INITIAL_STATE.planAttempts).toBe(0);
      expect(INITIAL_STATE.draftAttempts).toEqual({});
      expect(INITIAL_STATE.domainSpec).toBeNull();
      expect(INITIAL_STATE.failureReason).toBeNull();
    });

    it("should have correct config defaults", () => {
      expect(INITIAL_STATE.config.maxPlanAttempts).toBe(3);
      expect(INITIAL_STATE.config.maxDraftAttempts).toBe(5);
      expect(INITIAL_STATE.config.maxLoweringRetries).toBe(3);
      expect(INITIAL_STATE.config.recordProvenance).toBe(true);
    });
  });

  describe("diagnostics", () => {
    it("should have valid diagnostics", () => {
      expect(CompilerDomain.diagnostics).toBeDefined();
      expect(CompilerDomain.diagnostics.valid).toBe(true);
    });
  });
});
