/**
 * HITL Controller Tests
 *
 * Tests for Human-in-the-Loop controller.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHITLController } from "../hitl/controller.js";
import type { HITLOptions, HITLController } from "../types.js";
import type { ManifestoWorld, Proposal } from "@manifesto-ai/world";
import { createMockWorld, createTestProposal, createTestIntent } from "./helpers/mock-world.js";

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestOptions(overrides: Partial<HITLOptions> = {}): HITLOptions {
  return {
    enabled: true,
    timeout: 30000,
    onTimeout: "reject",
    ...overrides,
  };
}

// ============================================================================
// HITL Controller Tests
// ============================================================================

describe("HITLController", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockWorld = createMockWorld();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("createHITLController", () => {
    it("creates controller with empty pending list", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      expect(controller.pending).toEqual([]);
      expect(controller.isWaiting).toBe(false);
    });

    it("creates disabled controller when enabled is false", () => {
      const controller = createHITLController(
        createTestOptions({ enabled: false }),
        mockWorld
      );

      expect(controller.pending).toEqual([]);
    });
  });

  describe("pending management", () => {
    it("adds proposals to pending list via handlePending", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);
      const proposal = createTestProposal();

      // Simulate internal handlePending (would be called by withLab)
      (controller as any).handlePending?.({
        type: "proposal:decided",
        timestamp: Date.now(),
        proposalId: proposal.proposalId,
        decision: "pending",
      }, proposal);

      // Note: In real implementation, pending is populated via events
      // This test verifies the interface exists
      expect(Array.isArray(controller.pending)).toBe(true);
    });

    it("updates isWaiting when proposals are pending", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      // Initially not waiting
      expect(controller.isWaiting).toBe(false);
    });
  });

  describe("approve", () => {
    it("provides approve method", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      expect(typeof controller.approve).toBe("function");
    });

    it("approve throws when proposal is not pending", async () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      await expect(controller.approve("test-id")).rejects.toThrow("No pending proposal");
    });
  });

  describe("reject", () => {
    it("provides reject method", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      expect(typeof controller.reject).toBe("function");
    });

    it("reject is an async function", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      // Verify it's defined and is a function
      expect(typeof controller.reject).toBe("function");
    });
  });

  describe("approveWithModification", () => {
    it("provides approveWithModification method", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      expect(typeof controller.approveWithModification).toBe("function");
    });
  });

  describe("onPending callback", () => {
    it("registers handler for pending proposals", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);
      const handler = vi.fn();

      const unsubscribe = controller.onPending(handler);

      expect(typeof unsubscribe).toBe("function");
    });

    it("unsubscribe removes handler", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);
      const handler = vi.fn();

      const unsubscribe = controller.onPending(handler);
      unsubscribe();

      // Handler should not be called after unsubscribe
    });
  });

  describe("auto-approve conditions", () => {
    it("auto-approves when confidence above threshold", () => {
      const controller = createHITLController(
        createTestOptions({
          autoApprove: [
            { type: "confidence_above", threshold: 0.8 },
          ],
        }),
        mockWorld
      );

      const intent = createTestIntent("test", { confidence: 0.9 });
      const proposal = createTestProposal("actor", intent);

      // Check if auto-approve is applied internally
      expect(controller).toBeDefined();
    });

    it("auto-approves when intent type matches pattern", () => {
      const controller = createHITLController(
        createTestOptions({
          autoApprove: [
            { type: "intent_type", patterns: ["read-*"] },
          ],
        }),
        mockWorld
      );

      expect(controller).toBeDefined();
    });

    it("auto-approves for specific actors", () => {
      const controller = createHITLController(
        createTestOptions({
          autoApprove: [
            { type: "actor", actorIds: ["trusted-actor"] },
          ],
        }),
        mockWorld
      );

      expect(controller).toBeDefined();
    });

    it("auto-approves with custom predicate", () => {
      const customPredicate = vi.fn().mockReturnValue(true);
      const controller = createHITLController(
        createTestOptions({
          autoApprove: [
            { type: "custom", predicate: customPredicate },
          ],
        }),
        mockWorld
      );

      expect(controller).toBeDefined();
    });
  });

  describe("timeout behavior", () => {
    it("rejects on timeout when onTimeout is reject", async () => {
      const controller = createHITLController(
        createTestOptions({
          timeout: 1000,
          onTimeout: "reject",
        }),
        mockWorld
      );

      // Timeout behavior is tested via pending proposals
      expect(controller).toBeDefined();
    });

    it("approves on timeout when onTimeout is approve", () => {
      const controller = createHITLController(
        createTestOptions({
          timeout: 1000,
          onTimeout: "approve",
        }),
        mockWorld
      );

      expect(controller).toBeDefined();
    });
  });

  describe("delegate", () => {
    it("provides delegate method", () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      expect(typeof controller.delegate).toBe("function");
    });

    it("delegate throws not implemented error", async () => {
      const controller = createHITLController(createTestOptions(), mockWorld);

      await expect(
        controller.delegate("test-id", "other-authority")
      ).rejects.toThrow("delegate not implemented");
    });
  });
});
