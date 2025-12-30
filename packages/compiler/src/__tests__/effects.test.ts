import { describe, it, expect, vi } from "vitest";
import {
  createSegmentHandler,
  createNormalizeHandler,
  createProposeHandler,
} from "../effects/llm/handlers.js";
import { createBuilderValidateHandler } from "../effects/builder/validate-handler.js";
import type { LLMAdapter } from "../effects/llm/adapter.js";

describe("Effect Handlers", () => {
  describe("createSegmentHandler", () => {
    it("should return receiveSegments action on success", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn().mockResolvedValue({
          ok: true,
          data: { segments: ["seg1", "seg2"] },
        }),
        normalize: vi.fn(),
        propose: vi.fn(),
      };

      const handler = createSegmentHandler(mockAdapter);
      const result = await handler({ text: "test input" });

      expect(result.action).toBe("receiveSegments");
      expect(result.input.segments).toEqual(["seg1", "seg2"]);
    });

    it("should return requestResolution action on resolution", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn().mockResolvedValue({
          ok: "resolution",
          reason: "Ambiguous",
          options: [{ id: "opt1", description: "Option 1" }],
        }),
        normalize: vi.fn(),
        propose: vi.fn(),
      };

      const handler = createSegmentHandler(mockAdapter);
      const result = await handler({ text: "test input" });

      expect(result.action).toBe("requestResolution");
      expect(result.input.reason).toBe("Ambiguous");
    });

    it("should return discard action on error", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn().mockResolvedValue({
          ok: false,
          error: "Failed",
        }),
        normalize: vi.fn(),
        propose: vi.fn(),
      };

      const handler = createSegmentHandler(mockAdapter);
      const result = await handler({ text: "test input" });

      expect(result.action).toBe("discard");
      expect(result.input.reason).toBe("SEGMENTATION_FAILED");
    });
  });

  describe("createNormalizeHandler", () => {
    it("should return receiveIntents action on success", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn(),
        normalize: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            intents: [{ kind: "state", description: "test", confidence: 0.9 }],
          },
        }),
        propose: vi.fn(),
      };

      const handler = createNormalizeHandler(mockAdapter, { onResolutionRequired: "await" });
      const result = await handler({ segments: ["seg1"], schema: null });

      expect(result.action).toBe("receiveIntents");
      expect(result.input.intents).toHaveLength(1);
    });

    it("should respect discard policy on resolution", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn(),
        normalize: vi.fn().mockResolvedValue({
          ok: "resolution",
          reason: "Ambiguous",
          options: [],
        }),
        propose: vi.fn(),
      };

      const handler = createNormalizeHandler(mockAdapter, { onResolutionRequired: "discard" });
      const result = await handler({ segments: ["seg1"], schema: null });

      expect(result.action).toBe("discard");
      expect(result.input.reason).toBe("RESOLUTION_REQUIRED_BUT_DISABLED");
    });
  });

  describe("createProposeHandler", () => {
    it("should return receiveDraft action on success", async () => {
      const mockAdapter: LLMAdapter = {
        segment: vi.fn(),
        normalize: vi.fn(),
        propose: vi.fn().mockResolvedValue({
          ok: true,
          data: { draft: { id: "test" } },
        }),
      };

      const handler = createProposeHandler(mockAdapter, { onResolutionRequired: "await" });
      const result = await handler({
        schema: null,
        intents: [],
        history: [],
      });

      expect(result.action).toBe("receiveDraft");
      expect(result.input.draft).toEqual({ id: "test" });
    });
  });

  describe("createBuilderValidateHandler", () => {
    it("should return receiveValidation with valid result", async () => {
      const handler = createBuilderValidateHandler();
      const result = await handler({
        draft: {
          id: "test",
          version: "1.0.0",
          hash: "",
          state: { fields: {} },
          computed: { fields: {} },
          actions: {},
        },
      });

      expect(result.action).toBe("receiveValidation");
      expect(result.input.valid).toBe(true);
      expect(result.input.schemaHash).toBeDefined();
    });

    it("should return receiveValidation with invalid result for missing fields", async () => {
      const handler = createBuilderValidateHandler();
      const result = await handler({
        draft: { id: "test" },
      });

      expect(result.action).toBe("receiveValidation");
      expect(result.input.valid).toBe(false);
      expect(result.input.diagnostics).toBeDefined();
    });

    it("should handle custom validation function", async () => {
      const customValidate = vi.fn().mockReturnValue({
        valid: false,
        diagnostics: {
          valid: false,
          errors: [{ code: "CUSTOM_ERROR", message: "Custom error" }],
          warnings: [],
        },
      });

      const handler = createBuilderValidateHandler(customValidate);
      const result = await handler({ draft: {} });

      expect(customValidate).toHaveBeenCalled();
      expect(result.input.valid).toBe(false);
    });
  });
});
