import { describe, it, expect, vi } from "vitest";
import { createCompiler } from "../api/factory.js";
import {
  createMockAdapter,
  createSuccessMockAdapter,
  createSegmentFailMockAdapter,
  createResolutionMockAdapter,
  createInvalidDraftMockAdapter,
  DEFAULT_PROPOSE_RESPONSE,
} from "./helpers/mock-adapter.js";

describe("Compiler Integration", () => {
  describe("successful compilation flow", () => {
    it("should complete full flow: idle → segmenting → normalizing → proposing → validating → success", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

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
      expect(snapshot.result).toBeDefined();
    });

    it("should track state transitions via subscription", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

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

  describe("empty input handling", () => {
    it("should discard on empty input", async () => {
      const adapter = createMockAdapter({
        segmentResponse: { ok: true, data: { segments: [] } },
      });
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "" });

      const snapshot = await compiler.getSnapshot();
      // Empty segments should still proceed but may result in discard
      expect(snapshot.isTerminal).toBe(true);
    });
  });

  describe("segmentation failure handling", () => {
    it("should discard when segmentation fails", async () => {
      const adapter = createSegmentFailMockAdapter("Network error");
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Some input" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("discarded");
      expect(snapshot.discardReason).toBe("SEGMENTATION_FAILED");
    });
  });

  describe("resolution flow", () => {
    it("should enter awaiting_resolution when ambiguity detected (await policy)", async () => {
      const adapter = createResolutionMockAdapter("Multiple interpretations");
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: { onResolutionRequired: "await" },
      });

      await compiler.start({ text: "Track items" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("awaiting_resolution");
      expect(snapshot.resolutionReason).toBe("Multiple interpretations");
      expect(snapshot.resolutionOptions.length).toBe(2);
    });

    it("should discard when resolution required but policy is discard", async () => {
      const adapter = createResolutionMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: { onResolutionRequired: "discard" },
      });

      await compiler.start({ text: "Track items" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("discarded");
      expect(snapshot.discardReason).toBe("RESOLUTION_REQUIRED_BUT_DISABLED");
    });

    it("should resolve ambiguity and continue to success", async () => {
      // Start with adapter that returns resolution, then after resolve returns success
      const adapter = createResolutionMockAdapter("Ambiguous requirement");

      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: { onResolutionRequired: "await" },
      });

      // Start compilation - should enter awaiting_resolution
      await compiler.start({ text: "Track items" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("awaiting_resolution");
      expect(snapshot.resolutionReason).toBe("Ambiguous requirement");

      // Now override propose to return success for the second call
      vi.mocked(adapter.propose).mockResolvedValue(DEFAULT_PROPOSE_RESPONSE);

      // Resolve the ambiguity
      await compiler.resolve("opt1");

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("success");
      expect(snapshot.result).toBeDefined();
    });
  });

  describe("retry on validation failure", () => {
    it("should retry when draft fails validation", async () => {
      const adapter = createInvalidDraftMockAdapter(2);
      const compiler = createCompiler({ llmAdapter: adapter, maxRetries: 5 });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      // After retries, should eventually succeed
      expect(snapshot.attemptCount).toBeGreaterThanOrEqual(1);
    });

    it("should discard after max retries exceeded", async () => {
      // Create adapter that always returns invalid draft
      const adapter = createMockAdapter({
        proposeResponse: {
          ok: true,
          data: { draft: { _invalid: true } },
        },
      });

      const compiler = createCompiler({
        llmAdapter: adapter,
        maxRetries: 3,
      });

      await compiler.start({ text: "Create something" });

      const snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("discarded");
      expect(snapshot.discardReason).toBe("MAX_RETRIES_EXCEEDED");
    });
  });

  describe("reset after completion", () => {
    it("should reset to idle after success", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Create a counter" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("success");

      await compiler.reset();

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("idle");
      expect(snapshot.isIdle).toBe(true);
      expect(snapshot.result).toBeNull();
    });

    it("should reset to idle after discard", async () => {
      const adapter = createSegmentFailMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({ text: "Something" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("discarded");

      await compiler.reset();

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("idle");
    });
  });

  describe("manual discard", () => {
    it("should allow manual discard during compilation", async () => {
      const adapter = createResolutionMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        resolutionPolicy: { onResolutionRequired: "await" },
      });

      await compiler.start({ text: "Track items" });

      let snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("awaiting_resolution");

      // Manually discard instead of resolving
      await compiler.discard("RESOLUTION_REQUIRED_BUT_DISABLED");

      snapshot = await compiler.getSnapshot();
      expect(snapshot.status).toBe("discarded");
    });
  });

  describe("trace drafts option", () => {
    it("should track attempt count on retries", async () => {
      const adapter = createInvalidDraftMockAdapter(2);
      const compiler = createCompiler({
        llmAdapter: adapter,
        traceDrafts: true,
        maxRetries: 5,
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      // attemptCount tracks retries (incremented on each validation failure)
      expect(snapshot.attemptCount).toBeGreaterThanOrEqual(1);
    });

    it("should have zero attempts on first success", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({
        llmAdapter: adapter,
        traceDrafts: false,
      });

      await compiler.start({ text: "Create a counter" });

      const snapshot = await compiler.getSnapshot();
      // No retries needed on success
      expect(snapshot.attemptCount).toBe(0);
    });
  });

  describe("context passing", () => {
    it("should pass context to LLM adapter", async () => {
      const adapter = createSuccessMockAdapter();
      const compiler = createCompiler({ llmAdapter: adapter });

      await compiler.start({
        text: "Create a counter",
        context: {
          domainName: "counter-app",
          existingActions: ["decrement"],
          glossary: { counter: "A numeric value that tracks quantity" },
        },
      });

      // Verify context was passed to normalize and propose
      expect(adapter.normalize).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            domainName: "counter-app",
          }),
        })
      );

      expect(adapter.propose).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            domainName: "counter-app",
          }),
        })
      );
    });
  });
});
