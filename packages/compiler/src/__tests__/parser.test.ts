/**
 * Parser Tests (v1.1)
 */

import { describe, it, expect } from "vitest";
import {
  parseJSONResponse,
  extractAmbiguity,
  validatePlanResponse,
  validateFragmentDraftResponse,
} from "../effects/llm/parser.js";

describe("Parser", () => {
  describe("parseJSONResponse", () => {
    it("should parse raw JSON", () => {
      const result = parseJSONResponse<{ foo: string }>('{"foo": "bar"}');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.foo).toBe("bar");
      }
    });

    it("should parse JSON in markdown code block", () => {
      const input = '```json\n{"foo": "bar"}\n```';
      const result = parseJSONResponse<{ foo: string }>(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.foo).toBe("bar");
      }
    });

    it("should parse JSON with leading text", () => {
      const input = 'Here is the result:\n{"foo": "bar"}';
      const result = parseJSONResponse<{ foo: string }>(input);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.foo).toBe("bar");
      }
    });

    it("should return error for invalid JSON", () => {
      const result = parseJSONResponse<unknown>("not json");
      expect(result.ok).toBe(false);
    });

    it("should return error for non-object JSON", () => {
      const result = parseJSONResponse<unknown>('"just a string"');
      expect(result.ok).toBe(false);
    });
  });

  describe("extractAmbiguity", () => {
    it("should extract ambiguity from response", () => {
      const data = {
        ambiguous: true,
        reason: "Unclear requirement",
        alternatives: [
          { plan: { strategy: "by-statement", chunks: [] } },
          { plan: { strategy: "by-entity", chunks: [] } },
        ],
      };

      const result = extractAmbiguity<{ plan: unknown }>(data);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe("Unclear requirement");
      expect(result?.alternatives).toHaveLength(2);
    });

    it("should return null for non-ambiguous response", () => {
      const data = { plan: { strategy: "by-statement", chunks: [] } };
      const result = extractAmbiguity<unknown>(data);
      expect(result).toBeNull();
    });
  });

  describe("validatePlanResponse", () => {
    it("should validate valid plan", () => {
      const result = validatePlanResponse({
        plan: {
          strategy: "by-statement",
          chunks: [
            { content: "Track counter", expectedType: "state", dependencies: [] },
          ],
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.plan.strategy).toBe("by-statement");
        expect(result.data.plan.chunks).toHaveLength(1);
      }
    });

    it("should reject missing plan", () => {
      const result = validatePlanResponse({});
      expect(result.ok).toBe(false);
    });

    it("should reject invalid strategy", () => {
      const result = validatePlanResponse({
        plan: {
          strategy: "invalid-strategy",
          chunks: [],
        },
      });
      expect(result.ok).toBe(false);
    });

    it("should reject missing chunks", () => {
      const result = validatePlanResponse({
        plan: {
          strategy: "by-statement",
        },
      });
      expect(result.ok).toBe(false);
    });

    it("should validate all strategy types", () => {
      const strategies = ["by-statement", "by-entity", "by-layer", "single"];
      for (const strategy of strategies) {
        const result = validatePlanResponse({
          plan: { strategy, chunks: [] },
        });
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("validateFragmentDraftResponse", () => {
    it("should validate valid fragment draft", () => {
      const result = validateFragmentDraftResponse({
        draft: {
          type: "state",
          interpretation: {
            raw: { path: "counter", schema: { type: "number" } },
            description: "Counter value",
          },
          confidence: 0.9,
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.draft.type).toBe("state");
        expect(result.data.draft.interpretation.raw).toBeDefined();
      }
    });

    it("should reject missing draft", () => {
      const result = validateFragmentDraftResponse({});
      expect(result.ok).toBe(false);
    });

    it("should reject invalid type", () => {
      const result = validateFragmentDraftResponse({
        draft: {
          type: "invalid-type",
          interpretation: { raw: {} },
        },
      });
      expect(result.ok).toBe(false);
    });

    it("should reject missing interpretation", () => {
      const result = validateFragmentDraftResponse({
        draft: {
          type: "state",
        },
      });
      expect(result.ok).toBe(false);
    });

    it("should validate all fragment types", () => {
      const types = ["state", "computed", "action", "constraint", "effect", "flow"];
      for (const type of types) {
        const result = validateFragmentDraftResponse({
          draft: {
            type,
            interpretation: { raw: { test: true } },
          },
        });
        expect(result.ok).toBe(true);
      }
    });

    it("should allow alternatives in draft", () => {
      const result = validateFragmentDraftResponse({
        draft: {
          type: "state",
          interpretation: { raw: { path: "counter" } },
          alternatives: [
            { raw: { path: "value" } },
            { raw: { path: "count" } },
          ],
        },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.draft.alternatives).toHaveLength(2);
      }
    });
  });
});
