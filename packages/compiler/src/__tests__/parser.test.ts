import { describe, it, expect } from "vitest";
import {
  parseJSONResponse,
  extractResolutionRequest,
  validateSegmentsResponse,
  validateIntentsResponse,
  validateDraftResponse,
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

  describe("extractResolutionRequest", () => {
    it("should extract resolution request", () => {
      const input = JSON.stringify({
        resolution_required: true,
        reason: "Ambiguous requirement",
        options: [
          { id: "opt1", description: "Option 1" },
          { id: "opt2", description: "Option 2" },
        ],
      });

      const result = extractResolutionRequest(input);
      expect(result).not.toBeNull();
      expect(result?.reason).toBe("Ambiguous requirement");
      expect(result?.options).toHaveLength(2);
    });

    it("should return null for non-resolution response", () => {
      const input = JSON.stringify({ segments: ["a", "b"] });
      const result = extractResolutionRequest(input);
      expect(result).toBeNull();
    });
  });

  describe("validateSegmentsResponse", () => {
    it("should validate valid segments", () => {
      const result = validateSegmentsResponse({ segments: ["a", "b", "c"] });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.segments).toEqual(["a", "b", "c"]);
      }
    });

    it("should reject missing segments", () => {
      const result = validateSegmentsResponse({});
      expect(result.ok).toBe(false);
    });

    it("should reject non-string segments", () => {
      const result = validateSegmentsResponse({ segments: [1, 2, 3] });
      expect(result.ok).toBe(false);
    });
  });

  describe("validateIntentsResponse", () => {
    it("should validate valid intents", () => {
      const result = validateIntentsResponse({
        intents: [
          { kind: "state", description: "Track name", confidence: 0.9 },
          { kind: "action", description: "Update profile", confidence: 0.8 },
        ],
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.intents).toHaveLength(2);
      }
    });

    it("should reject invalid kind", () => {
      const result = validateIntentsResponse({
        intents: [{ kind: "invalid", description: "Test", confidence: 0.9 }],
      });
      expect(result.ok).toBe(false);
    });

    it("should reject invalid confidence", () => {
      const result = validateIntentsResponse({
        intents: [{ kind: "state", description: "Test", confidence: 1.5 }],
      });
      expect(result.ok).toBe(false);
    });
  });

  describe("validateDraftResponse", () => {
    it("should validate valid draft", () => {
      const result = validateDraftResponse({
        draft: { id: "test", version: "1.0.0" },
      });
      expect(result.ok).toBe(true);
    });

    it("should reject missing draft", () => {
      const result = validateDraftResponse({});
      expect(result.ok).toBe(false);
    });

    it("should reject non-object draft", () => {
      const result = validateDraftResponse({ draft: "not an object" });
      expect(result.ok).toBe(false);
    });
  });
});
