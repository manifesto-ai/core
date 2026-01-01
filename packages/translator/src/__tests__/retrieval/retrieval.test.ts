/**
 * Retrieval Tests
 * TDD: Tests first, implementation follows
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { GlossaryEntry, Token, AnchorCandidate, TypeIndex, ResolvedType } from "../../types/index.js";
import {
  buildIndex,
  search,
  buildAliasTable,
  type SchemaInfo,
  type RetrievalIndex,
} from "../../retrieval/index.js";

// Sample schema info for testing
const sampleSchemaInfo: SchemaInfo = {
  fields: {
    "User.age": {
      name: "age",
      description: "User's age in years",
      type: { kind: "primitive", name: "number" },
    },
    "User.email": {
      name: "email",
      description: "User's email address",
      type: { kind: "primitive", name: "string" },
    },
    "User.name": {
      name: "name",
      description: "User's full name",
      type: { kind: "primitive", name: "string" },
    },
    "Profile.age": {
      name: "age",
      description: "Profile age field",
      type: { kind: "primitive", name: "number" },
    },
    "Order.status": {
      name: "status",
      description: "Order status: pending, active, or done",
      type: { kind: "primitive", name: "string" },
    },
  },
};

// Sample glossary for testing
const sampleGlossary: GlossaryEntry[] = [
  {
    semanticId: "field.age",
    canonical: "age",
    aliases: {
      ko: ["나이", "연령"],
      en: ["age", "years old"],
    },
    anchorHints: ["User.age", "Profile.age"],
  },
  {
    semanticId: "field.email",
    canonical: "email",
    aliases: {
      ko: ["이메일", "메일"],
      en: ["email", "mail address"],
    },
  },
  {
    semanticId: "field.name",
    canonical: "name",
    aliases: {
      ko: ["이름", "성명"],
      en: ["name", "full name"],
    },
  },
];

describe("Retrieval Module", () => {
  describe("Alias Table", () => {
    it("builds alias table from glossary", () => {
      const aliasTable = buildAliasTable(sampleGlossary, sampleSchemaInfo);

      // Should have entries for all aliases
      expect(aliasTable.get("나이")).toBeDefined();
      expect(aliasTable.get("age")).toBeDefined();
      expect(aliasTable.get("이메일")).toBeDefined();
    });

    it("maps aliases to correct schema paths", () => {
      const aliasTable = buildAliasTable(sampleGlossary, sampleSchemaInfo);

      // 나이 should map to User.age and Profile.age
      const agePaths = aliasTable.get("나이");
      expect(agePaths).toContain("User.age");
      expect(agePaths).toContain("Profile.age");
    });

    it("includes canonical forms as aliases", () => {
      const aliasTable = buildAliasTable(sampleGlossary, sampleSchemaInfo);

      // canonical "age" should also be in the table
      expect(aliasTable.get("age")).toBeDefined();
    });
  });

  describe("Index Builder", () => {
    let index: RetrievalIndex;

    beforeEach(() => {
      index = buildIndex(sampleSchemaInfo, sampleGlossary);
    });

    it("indexes field names from schema", () => {
      expect(index).toBeDefined();
      expect(index.lunrIndex).toBeDefined();
    });

    it("indexes field descriptions", () => {
      // Search for a word from description
      const results = search(index, ["years"]);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toBe("User.age");
    });

    it("indexes glossary aliases", () => {
      // Search for Korean alias
      const results = search(index, ["나이"]);
      expect(results.length).toBeGreaterThan(0);
    });

    it("builds deterministic index", () => {
      const index1 = buildIndex(sampleSchemaInfo, sampleGlossary);
      const index2 = buildIndex(sampleSchemaInfo, sampleGlossary);

      // Search results should be the same
      const results1 = search(index1, ["age"]);
      const results2 = search(index2, ["age"]);

      expect(results1.length).toBe(results2.length);
      expect(results1.map((r) => r.path)).toEqual(results2.map((r) => r.path));
    });
  });

  describe("Search", () => {
    let index: RetrievalIndex;

    beforeEach(() => {
      index = buildIndex(sampleSchemaInfo, sampleGlossary);
    });

    it("returns AnchorCandidate[] sorted by score", () => {
      const results = search(index, ["age"]);

      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // Check sorting
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it("respects maxCandidates limit", () => {
      const results = search(index, ["age"], { maxCandidates: 1 });

      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("marks matchType as exact for field name match", () => {
      const results = search(index, ["age"]);

      // Should find at least one exact match
      const exactMatches = results.filter((r) => r.matchType === "exact");
      expect(exactMatches.length).toBeGreaterThan(0);
    });

    it("marks matchType as alias for glossary match", () => {
      const results = search(index, ["나이"]);

      // Should find alias matches
      expect(results.length).toBeGreaterThan(0);
      const aliasMatches = results.filter((r) => r.matchType === "alias");
      expect(aliasMatches.length).toBeGreaterThan(0);
    });

    it("handles multi-term queries", () => {
      const results = search(index, ["user", "age"]);

      expect(results.length).toBeGreaterThan(0);
      // User.age should score higher than Profile.age
      expect(results[0].path).toBe("User.age");
    });

    it("scores partial matches lower", () => {
      // Search for "ag" which partially matches "age"
      const exactResults = search(index, ["age"]);
      const fuzzyResults = search(index, ["ag"]);

      // Exact match should score higher (if found)
      if (fuzzyResults.length > 0 && exactResults.length > 0) {
        expect(exactResults[0].score).toBeGreaterThanOrEqual(fuzzyResults[0].score);
      }
    });
  });

  describe("Scoring", () => {
    let index: RetrievalIndex;

    beforeEach(() => {
      index = buildIndex(sampleSchemaInfo, sampleGlossary);
    });

    it("applies weighted scoring", () => {
      const results = search(index, ["email"]);

      expect(results.length).toBeGreaterThan(0);
      // Score should be normalized to 0.0-1.0
      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1);
      }
    });

    it("boosts alias matches", () => {
      // Search with glossary canonical form
      const results = search(index, ["email"]);

      // Email has an exact field match
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toBe("User.email");
    });

    it("includes typeHint from schema", () => {
      const results = search(index, ["age"]);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].typeHint).toBeDefined();
      if (results[0].typeHint?.kind === "primitive") {
        expect(results[0].typeHint.name).toBe("number");
      }
    });
  });

  describe("Edge Cases", () => {
    let index: RetrievalIndex;

    beforeEach(() => {
      index = buildIndex(sampleSchemaInfo, sampleGlossary);
    });

    it("returns empty array for no matches", () => {
      const results = search(index, ["xyznonexistent"]);
      expect(results).toEqual([]);
    });

    it("handles empty query", () => {
      const results = search(index, []);
      expect(results).toEqual([]);
    });

    it("handles special characters in query", () => {
      const results = search(index, ["User.age"]);
      // Should still find matches
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
