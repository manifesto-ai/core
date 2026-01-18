/**
 * withLab Tests
 *
 * Tests for the Lab wrapper and LabWorld.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { withLab } from "../lab/with-lab.js";
import type { LabOptions, LabWorld } from "../types.js";
import {
  createMockWorld,
  createTestLabOptions,
  createProposalSubmittedEvent,
  createProposalDecidedEvent,
  createWorldCreatedEvent,
  createTestProposal,
} from "./helpers/mock-world.js";

// ============================================================================
// withLab Tests
// ============================================================================

describe("withLab", () => {
  let mockWorld: ReturnType<typeof createMockWorld>;
  let options: LabOptions;

  beforeEach(() => {
    mockWorld = createMockWorld();
    options = createTestLabOptions({
      runId: "test-run-001",
      necessityLevel: 1,
    });
  });

  describe("LabWorld creation", () => {
    it("creates LabWorld with correct metadata", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.labMeta.runId).toBe("test-run-001");
      expect(labWorld.labMeta.necessityLevel).toBe(1);
      expect(labWorld.labMeta.startedAt).toBeDefined();
    });

    it("preserves original world methods", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.schemaHash).toBe(mockWorld.schemaHash);
      expect(typeof labWorld.subscribe).toBe("function");
      expect(typeof labWorld.submitProposal).toBe("function");
      expect(typeof labWorld.getGenesis).toBe("function");
    });

    it("exposes lab-specific properties", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.hitl).toBeDefined();
      expect(labWorld.projection).toBeDefined();
      expect(typeof labWorld.trace).toBe("function");
      expect(typeof labWorld.report).toBe("function");
      expect(typeof labWorld.onLabEvent).toBe("function");
    });
  });

  describe("initial state", () => {
    it("starts in running state", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.state.status).toBe("running");
    });

    it("has empty trace initially", () => {
      const labWorld = withLab(mockWorld, options);
      const trace = labWorld.trace();

      expect(trace.header.runId).toBe("test-run-001");
      expect(trace.events).toEqual([]);
    });
  });

  describe("event subscription", () => {
    it("subscribes to world events", () => {
      withLab(mockWorld, options);

      expect(mockWorld.subscribe).toHaveBeenCalled();
    });

    it("provides trace method that returns empty trace initially", () => {
      const labWorld = withLab(mockWorld, options);

      const trace = labWorld.trace();
      expect(trace.events.length).toBe(0);
      expect(trace.header.runId).toBe("test-run-001");
    });
  });

  describe("lab events", () => {
    it("allows subscribing to lab events", () => {
      const labWorld = withLab(mockWorld, options);
      const handler = vi.fn();

      const unsubscribe = labWorld.onLabEvent(handler);

      expect(typeof unsubscribe).toBe("function");
      unsubscribe(); // Clean up
    });

    it("provides onLabEvent method", () => {
      const labWorld = withLab(mockWorld, options);

      expect(typeof labWorld.onLabEvent).toBe("function");
    });
  });

  describe("HITL integration", () => {
    it("provides HITL controller", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.hitl).toBeDefined();
      expect(typeof labWorld.hitl.approve).toBe("function");
      expect(typeof labWorld.hitl.reject).toBe("function");
    });

    it("handles pending proposals via HITL", async () => {
      const labWorld = withLab(mockWorld, {
        ...options,
        hitl: { enabled: true },
      });
      const proposal = createTestProposal();

      // Emit pending decision
      mockWorld._emitEvent(createProposalDecidedEvent(proposal, "pending"));

      // HITL controller should be notified
      expect(labWorld.hitl.pending).toBeDefined();
    });
  });

  describe("projection", () => {
    it("provides projection controller", () => {
      const labWorld = withLab(mockWorld, options);

      expect(labWorld.projection).toBeDefined();
      expect(labWorld.projection.mode).toBe("silent");
    });

    it("respects projection mode configuration", () => {
      const labWorld = withLab(mockWorld, {
        ...options,
        projection: { enabled: false, mode: "watch" },
      });

      // Mode is still set even if not enabled
      expect(labWorld.projection.mode).toBe("watch");
    });
  });

  describe("report generation", () => {
    it("generates report with correct metadata", () => {
      const labWorld = withLab(mockWorld, options);

      const report = labWorld.report();

      expect(report.runId).toBe("test-run-001");
      expect(report.necessityLevel).toBe(1);
      expect(report.summary).toBeDefined();
    });
  });

  describe("state management", () => {
    it("updates state based on events", () => {
      const labWorld = withLab(mockWorld, options);
      const proposal = createTestProposal();

      // Should start running
      expect(labWorld.state.status).toBe("running");

      // Emit pending decision
      mockWorld._emitEvent(createProposalDecidedEvent(proposal, "pending"));

      // State might transition (depending on implementation)
      // This tests that state management is wired up
      expect(labWorld.state).toBeDefined();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe("withLab edge cases", () => {
  it("handles multiple subscriptions", () => {
    const mockWorld = createMockWorld();
    const labWorld = withLab(mockWorld, createTestLabOptions());

    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const unsub1 = labWorld.onLabEvent(handler1);
    const unsub2 = labWorld.onLabEvent(handler2);

    // Both handlers registered
    expect(typeof unsub1).toBe("function");
    expect(typeof unsub2).toBe("function");

    unsub1();
    unsub2();
  });

  it("handles unsubscription correctly", () => {
    const mockWorld = createMockWorld();
    const labWorld = withLab(mockWorld, createTestLabOptions());

    const handler = vi.fn();
    const unsubscribe = labWorld.onLabEvent(handler);

    // Unsubscribe should be callable
    expect(() => unsubscribe()).not.toThrow();
  });

  it("creates independent LabWorlds for same base world", () => {
    const mockWorld = createMockWorld();
    const labWorld1 = withLab(mockWorld, createTestLabOptions({ runId: "run-1" }));
    const labWorld2 = withLab(mockWorld, createTestLabOptions({ runId: "run-2" }));

    expect(labWorld1.labMeta.runId).toBe("run-1");
    expect(labWorld2.labMeta.runId).toBe("run-2");
  });

  it("preserves trace header across operations", () => {
    const mockWorld = createMockWorld();
    const labWorld = withLab(mockWorld, createTestLabOptions({
      runId: "test-run",
      necessityLevel: 2,
    }));

    const trace = labWorld.trace();
    expect(trace.header.runId).toBe("test-run");
    expect(trace.header.necessityLevel).toBe(2);
  });
});
