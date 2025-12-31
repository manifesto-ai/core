/**
 * Effect Handler Tests (v1.1)
 */

import { describe, it, expect, vi } from "vitest";
import {
  createPlanHandler,
  createGenerateHandler,
  DEFAULT_RESOLUTION_POLICY,
} from "../effects/llm/handlers.js";
import { createBuilderValidateHandler } from "../effects/builder/validate-handler.js";
import type { LLMAdapter, FragmentType, PlanStrategy, ResolutionPolicy } from "../domain/types.js";

const MOCK_POLICY: ResolutionPolicy = {
  ...DEFAULT_RESOLUTION_POLICY,
  onPlanDecision: "auto-accept",
  onDraftDecision: "auto-accept",
};

describe("Effect Handlers", () => {
  describe("createPlanHandler", () => {
    it("should return receivePlan action on success", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            plan: {
              strategy: "by-statement" as PlanStrategy,
              chunks: [
                { content: "chunk1", expectedType: "state" as FragmentType, dependencies: [] },
              ],
              rationale: "test",
            },
          },
        }),
        generate: vi.fn(),
      };

      const handler = createPlanHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        sourceInput: {
          id: "input_1",
          type: "natural-language",
          content: "test input",
          receivedAt: Date.now(),
        },
      });

      expect(result.action).toBe("receivePlan");
      const plan = (result.input as { plan: { chunks: unknown[] } }).plan;
      expect(plan).toBeDefined();
      expect(plan.chunks).toHaveLength(1);
    });

    it("should assign IDs to plan and chunks", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            plan: {
              strategy: "by-statement" as PlanStrategy,
              chunks: [
                { content: "chunk1", expectedType: "state" as FragmentType, dependencies: [] },
                { content: "chunk2", expectedType: "action" as FragmentType, dependencies: [] },
              ],
            },
          },
        }),
        generate: vi.fn(),
      };

      const handler = createPlanHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        sourceInput: {
          id: "input_1",
          type: "natural-language",
          content: "test input",
          receivedAt: Date.now(),
        },
      });

      const plan = (result.input as { plan: { id: string; chunks: Array<{ id: string }> } }).plan;
      expect(plan.id).toBeDefined();
      expect(plan.chunks[0].id).toBeDefined();
      expect(plan.chunks[1].id).toBeDefined();
    });

    it("should return fail action on error", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn().mockResolvedValue({
          ok: false,
          error: "Planning failed",
        }),
        generate: vi.fn(),
      };

      const handler = createPlanHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        sourceInput: {
          id: "input_1",
          type: "natural-language",
          content: "test input",
          receivedAt: Date.now(),
        },
      });

      expect(result.action).toBe("fail");
      expect((result.input as { reason: string }).reason).toBe("PLANNING_FAILED");
    });
  });

  describe("createGenerateHandler", () => {
    it("should return receiveFragmentDraft action on success", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn(),
        generate: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            draft: {
              type: "state" as FragmentType,
              interpretation: {
                raw: { path: "counter", schema: { type: "number" } },
                description: "Counter",
              },
              confidence: 0.9,
            },
          },
        }),
      };

      const handler = createGenerateHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        chunk: {
          id: "chunk_1",
          content: "Track counter",
          expectedType: "state" as FragmentType,
          dependencies: [],
        },
        plan: {
          id: "plan_1",
          sourceInputId: "input_1",
          strategy: "by-statement" as PlanStrategy,
          chunks: [],
          status: "accepted",
        },
        existingFragments: [],
      });

      expect(result.action).toBe("receiveFragmentDraft");
      const draft = (result.input as { draft: { type: string } }).draft;
      expect(draft).toBeDefined();
      expect(draft.type).toBe("state");
    });

    it("should assign ID and chunkId to draft", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn(),
        generate: vi.fn().mockResolvedValue({
          ok: true,
          data: {
            draft: {
              type: "state" as FragmentType,
              interpretation: {
                raw: { path: "counter" },
              },
            },
          },
        }),
      };

      const handler = createGenerateHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        chunk: {
          id: "chunk_1",
          content: "Track counter",
          expectedType: "state" as FragmentType,
          dependencies: [],
        },
        plan: {
          id: "plan_1",
          sourceInputId: "input_1",
          strategy: "by-statement" as PlanStrategy,
          chunks: [],
          status: "accepted",
        },
        existingFragments: [],
      });

      const draft = (result.input as { draft: { id: string; chunkId: string } }).draft;
      expect(draft.id).toBeDefined();
      expect(draft.chunkId).toBe("chunk_1");
    });

    it("should return fail action on error", async () => {
      const mockAdapter: LLMAdapter = {
        plan: vi.fn(),
        generate: vi.fn().mockResolvedValue({
          ok: false,
          error: "Generation failed",
        }),
      };

      const handler = createGenerateHandler(mockAdapter, MOCK_POLICY);
      const result = await handler({
        chunk: {
          id: "chunk_1",
          content: "Track counter",
          expectedType: "state" as FragmentType,
          dependencies: [],
        },
        plan: {
          id: "plan_1",
          sourceInputId: "input_1",
          strategy: "by-statement" as PlanStrategy,
          chunks: [],
          status: "accepted",
        },
        existingFragments: [],
      });

      expect(result.action).toBe("fail");
      expect((result.input as { reason: string }).reason).toBe("GENERATION_FAILED");
    });
  });

  describe("createBuilderValidateHandler", () => {
    it("should return valid result for valid draft", async () => {
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

      expect(result.action).toBe("receiveVerification");
      expect(result.input.valid).toBe(true);
      expect(result.input.issues).toEqual([]);
    });

    it("should return issues for invalid draft", async () => {
      const handler = createBuilderValidateHandler();
      const result = await handler({
        draft: { id: "test" },
      });

      expect(result.action).toBe("receiveVerification");
      expect((result.input as { valid: boolean }).valid).toBe(false);
      expect((result.input as { issues: unknown[] }).issues.length).toBeGreaterThan(0);
    });

    it("should handle custom validation function", async () => {
      const customValidate = vi.fn().mockReturnValue({
        valid: false,
        issues: [{ severity: "error", code: "CUSTOM_ERROR", message: "Custom error" }],
      });

      const handler = createBuilderValidateHandler(customValidate);
      const result = await handler({ draft: {} });

      expect(customValidate).toHaveBeenCalled();
      expect(result.input.valid).toBe(false);
    });
  });
});
