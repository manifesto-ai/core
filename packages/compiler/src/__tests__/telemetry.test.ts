/**
 * Telemetry Tests (v1.1)
 */

import { describe, it, expect, vi } from "vitest";
import { createCompiler } from "../api/factory.js";
import {
  createSuccessMockAdapter,
  createPlanFailMockAdapter,
  createMockAdapter,
} from "./helpers/mock-adapter.js";
import type { CompilerTelemetry, CompilerStatus } from "../domain/types.js";

describe("CompilerTelemetry", () => {
  describe("onPhaseChange", () => {
    it("should call onPhaseChange for each status transition", async () => {
      const onPhaseChange = vi.fn();
      const telemetry: CompilerTelemetry = { onPhaseChange };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      // Should have been called for transitions
      expect(onPhaseChange).toHaveBeenCalled();

      // Verify v1.1 transitions
      const calls = onPhaseChange.mock.calls as [CompilerStatus, CompilerStatus][];
      const transitions = calls.map(([from, to]) => `${from}→${to}`);

      expect(transitions).toContain("idle→planning");
    });
  });

  describe("onComplete", () => {
    it("should call onComplete on success", async () => {
      const onComplete = vi.fn();
      const telemetry: CompilerTelemetry = { onComplete };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "success",
          isTerminal: true,
        })
      );
    });

    it("should call onComplete on failure", async () => {
      const onComplete = vi.fn();
      const telemetry: CompilerTelemetry = { onComplete };

      const adapter = createPlanFailMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
      });

      await compiler.start({ text: "Something" });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "failed",
          isTerminal: true,
        })
      );
    });
  });

  describe("onPlanReceived", () => {
    it("should call onPlanReceived when plan is received", async () => {
      const onPlanReceived = vi.fn();
      const telemetry: CompilerTelemetry = { onPlanReceived };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track counter" });

      expect(onPlanReceived).toHaveBeenCalledTimes(1);
      expect(onPlanReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          strategy: expect.any(String),
          chunks: expect.any(Array),
        })
      );
    });
  });

  describe("onDraftReceived", () => {
    it("should call onDraftReceived when draft is received", async () => {
      const onDraftReceived = vi.fn();
      const telemetry: CompilerTelemetry = { onDraftReceived };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Track counter" });

      expect(onDraftReceived).toHaveBeenCalled();
      expect(onDraftReceived).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: expect.any(String),
        })
      );
    });
  });

  describe("onEffectStart and onEffectEnd", () => {
    it("should call onEffectStart before each effect", async () => {
      const onEffectStart = vi.fn();
      const telemetry: CompilerTelemetry = { onEffectStart };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      expect(onEffectStart).toHaveBeenCalled();

      // Check that v1.1 effect types were started
      const effectTypes = (onEffectStart.mock.calls as [string, Record<string, unknown>][]).map(([type]) => type);
      expect(effectTypes).toContain("llm:plan");
      expect(effectTypes).toContain("llm:generate");
    });

    it("should call onEffectEnd after each effect", async () => {
      const onEffectEnd = vi.fn();
      const telemetry: CompilerTelemetry = { onEffectEnd };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      expect(onEffectEnd).toHaveBeenCalled();

      // Check that effects completed with results
      const effectResults = (onEffectEnd.mock.calls as [string, { action: string }][]).map(
        ([type, result]) => ({
          type,
          action: result.action,
        })
      );

      expect(effectResults).toContainEqual({
        type: "llm:plan",
        action: "receivePlan",
      });
    });
  });

  describe("onError", () => {
    it("should call onError on effect failure", async () => {
      const onError = vi.fn();
      const telemetry: CompilerTelemetry = { onError };

      // Create adapter that throws an error
      const adapter = {
        plan: vi.fn().mockRejectedValue(new Error("Network failure")),
        generate: vi.fn(),
      };

      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
      });

      await expect(compiler.start({ text: "Create a counter" })).rejects.toThrow("Network failure");

      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "Network failure" }),
        expect.stringContaining("effect:llm:plan")
      );
    });
  });

  describe("full telemetry integration", () => {
    it("should call all telemetry hooks in a successful flow", async () => {
      const telemetry: CompilerTelemetry = {
        onPhaseChange: vi.fn(),
        onComplete: vi.fn(),
        onPlanReceived: vi.fn(),
        onDraftReceived: vi.fn(),
        onEffectStart: vi.fn(),
        onEffectEnd: vi.fn(),
      };

      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        telemetry,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
      });

      await compiler.start({ text: "Create a counter" });

      // All hooks should have been called
      expect(telemetry.onPhaseChange).toHaveBeenCalled();
      expect(telemetry.onComplete).toHaveBeenCalled();
      expect(telemetry.onPlanReceived).toHaveBeenCalled();
      expect(telemetry.onDraftReceived).toHaveBeenCalled();
      expect(telemetry.onEffectStart).toHaveBeenCalled();
      expect(telemetry.onEffectEnd).toHaveBeenCalled();
    });

    it("should work without telemetry (telemetry is optional)", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: {
          onPlanDecision: "auto-accept",
          onDraftDecision: "auto-accept",
          onConflictResolution: "await",
        },
        // No telemetry provided
      });

      // Should not throw
      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("success");
    });
  });
});
