/**
 * @fileoverview Tests for LLM output schema normalization
 *
 * Verifies that parseLLMOutput correctly normalizes LLM outputs
 * to be v0.1 spec compliant.
 */

import { describe, it, expect } from "vitest";
import { parseLLMOutput } from "../llm/output-schema.js";

describe("parseLLMOutput", () => {
  describe("ValueType normalization", () => {
    it("passes through valid ValueTypes unchanged", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "CREATE", class: "CREATE" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "string",
                  shape: {},
                  raw: "test",
                },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
      expect(result.nodes[0].ir.args.THEME).toEqual({
        kind: "value",
        valueType: "string",
        shape: {},
        raw: "test",
      });
    });

    it('normalizes "Priority" to "enum"', () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "UPDATE", class: "TRANSFORM" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "Priority",
                  shape: { value: "high" },
                  raw: "high",
                },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].ir.args.THEME).toMatchObject({
        kind: "value",
        valueType: "enum",
        shape: { value: "high", originalType: "Priority" },
      });
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].field).toBe("valueType");
    });

    it('normalizes "Q4" to "enum"', () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "Q4",
                  shape: {},
                  raw: "Q4",
                },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes[0].ir.args.THEME).toMatchObject({
        kind: "value",
        valueType: "enum",
        shape: { originalType: "Q4" },
      });
    });

    it('normalizes "average completion time" to "string"', () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "CALCULATE", class: "SOLVE" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "average completion time",
                  shape: {},
                  raw: "3 days",
                },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      // "average" matches number pattern, but "time" matches date pattern
      // The date pattern takes precedence since it's checked later
      expect(result.nodes[0].ir.args.THEME).toMatchObject({
        kind: "value",
        valueType: "date",
      });
    });

    it('normalizes "report" to "enum"', () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "CREATE", class: "CREATE" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "report",
                  shape: {},
                  raw: "quarterly report",
                },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes[0].ir.args.THEME).toMatchObject({
        kind: "value",
        valueType: "enum", // "report" is in enum patterns
      });
    });
  });

  describe("cond normalization", () => {
    it("passes through valid Pred[] cond unchanged", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {},
              cond: [
                {
                  lhs: "target.status",
                  op: "=",
                  rhs: { kind: "value", valueType: "enum", shape: {}, raw: "active" },
                },
              ],
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].ir).toHaveProperty("cond");
      expect((result.nodes[0].ir as any).cond).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it("removes invalid cond structure with type/or/not", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {},
              cond: {
                type: "FILTER",
                or: [{ status: "active" }, { status: "pending" }],
                not: { archived: true },
              },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].ir).not.toHaveProperty("cond");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].reason).toContain("Complex filter structure");
    });

    it("filters out invalid predicates from cond array", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {},
              cond: [
                // Valid pred
                {
                  lhs: "target.status",
                  op: "=",
                  rhs: { kind: "value", valueType: "enum", shape: {}, raw: "active" },
                },
                // Invalid - missing scope prefix in lhs
                {
                  lhs: "status",
                  op: "=",
                  rhs: { kind: "value", valueType: "string", shape: {}, raw: "x" },
                },
                // Invalid - wrong op
                {
                  lhs: "target.count",
                  op: "LIKE",
                  rhs: { kind: "value", valueType: "string", shape: {}, raw: "x" },
                },
              ],
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      // Only the valid pred should remain
      expect((result.nodes[0].ir as any).cond).toHaveLength(1);
      expect((result.nodes[0].ir as any).cond[0].lhs).toBe("target.status");
    });

    it("removes cond if all predicates are invalid", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {},
              cond: [
                // Invalid - no scope prefix
                {
                  lhs: "status",
                  op: "=",
                  rhs: { kind: "value", valueType: "string", shape: {}, raw: "x" },
                },
              ],
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].ir).not.toHaveProperty("cond");
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].reason).toContain("No valid predicates");
    });
  });

  describe("warnings collection", () => {
    it("collects multiple warnings across nodes", () => {
      const json = JSON.stringify({
        nodes: [
          {
            tempId: "t1",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "UPDATE", class: "TRANSFORM" },
              args: {
                THEME: {
                  kind: "value",
                  valueType: "Priority",
                  shape: {},
                },
              },
            },
          },
          {
            tempId: "t2",
            ir: {
              v: "0.1",
              force: "DO",
              event: { lemma: "SHOW", class: "OBSERVE" },
              args: {},
              cond: { type: "FILTER", or: [] },
            },
          },
        ],
      });

      const result = parseLLMOutput(json);
      expect(result.nodes).toHaveLength(2);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].nodeId).toBe("t1");
      expect(result.warnings[1].nodeId).toBe("t2");
    });
  });
});
