import { describe, it, expect } from "vitest";
import { validate } from "./validate.js";
import type { DomainSchema } from "../schema/domain.js";

// Helper to create a valid minimal schema
function createValidSchema(overrides: Partial<DomainSchema> = {}): DomainSchema {
  return {
    id: "test",
    version: "1.0.0",
    hash: "test-hash",
    state: { fields: {} },
    computed: { fields: {} },
    actions: {},
    ...overrides,
  };
}

describe("validate", () => {
  describe("Basic Schema Validation", () => {
    it("should validate a valid schema", () => {
      const schema = createValidSchema();
      const result = validate(schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it("should reject non-object input", () => {
      const result = validate(null);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject schema without required fields", () => {
      const result = validate({});

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "SCHEMA_ERROR")).toBe(true);
    });

    it("should reject schema with invalid version format", () => {
      const result = validate({
        id: "test",
        version: 123, // Should be string
        hash: "test-hash",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      });

      expect(result.valid).toBe(false);
    });
  });

  describe("Computed Field Validation", () => {
    it("should validate schema with computed fields", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.total": {
              expr: { kind: "add", left: { kind: "get", path: "a" }, right: { kind: "get", path: "b" } },
              deps: ["a", "b"],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should detect cyclic dependencies in computed fields (V-002)", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.a": {
              expr: { kind: "get", path: "computed.b" },
              deps: ["computed.b"],
            },
            "computed.b": {
              expr: { kind: "get", path: "computed.a" },
              deps: ["computed.a"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-002")).toBe(true);
    });

    it("should detect self-referential computed fields", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.self": {
              expr: { kind: "get", path: "computed.self" },
              deps: ["computed.self"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-002")).toBe(true);
    });

    it("should detect complex cyclic dependencies", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.a": {
              expr: { kind: "get", path: "computed.b" },
              deps: ["computed.b"],
            },
            "computed.b": {
              expr: { kind: "get", path: "computed.c" },
              deps: ["computed.c"],
            },
            "computed.c": {
              expr: { kind: "get", path: "computed.a" },
              deps: ["computed.a"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-002")).toBe(true);
    });

    it("should allow valid dependency chains", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.a": {
              expr: { kind: "get", path: "x" },
              deps: ["x"],
            },
            "computed.b": {
              expr: { kind: "get", path: "computed.a" },
              deps: ["computed.a"],
            },
            "computed.c": {
              expr: { kind: "get", path: "computed.b" },
              deps: ["computed.b"],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Action Validation", () => {
    it("should validate schema with actions", () => {
      const schema = createValidSchema({
        actions: {
          increment: {
            flow: {
              kind: "patch",
              op: "set",
              path: "count",
              value: { kind: "lit", value: 1 },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate action with availability condition", () => {
      const schema = createValidSchema({
        actions: {
          withdraw: {
            available: {
              kind: "gt",
              left: { kind: "get", path: "balance" },
              right: { kind: "lit", value: 0 },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "balance",
              value: { kind: "lit", value: 0 },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Call Reference Validation (V-004)", () => {
    it("should detect unknown call references", () => {
      const schema = createValidSchema({
        actions: {
          main: {
            flow: {
              kind: "call",
              flow: "nonexistent",
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-004")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("nonexistent"))).toBe(true);
    });

    it("should allow valid call references", () => {
      const schema = createValidSchema({
        actions: {
          helper: {
            flow: { kind: "patch", op: "set", path: "x", value: { kind: "lit", value: 1 } },
          },
          main: {
            flow: {
              kind: "call",
              flow: "helper",
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should detect unknown calls in nested flows", () => {
      const schema = createValidSchema({
        actions: {
          main: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "x", value: { kind: "lit", value: 1 } },
                {
                  kind: "if",
                  cond: { kind: "lit", value: true },
                  then: { kind: "call", flow: "unknown" },
                },
              ],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-004")).toBe(true);
    });
  });

  describe("Call Graph Cycle Detection (V-005)", () => {
    it("should detect direct recursive calls", () => {
      const schema = createValidSchema({
        actions: {
          recursive: {
            flow: {
              kind: "call",
              flow: "recursive",
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-005")).toBe(true);
    });

    it("should detect indirect recursive calls", () => {
      const schema = createValidSchema({
        actions: {
          a: {
            flow: { kind: "call", flow: "b" },
          },
          b: {
            flow: { kind: "call", flow: "c" },
          },
          c: {
            flow: { kind: "call", flow: "a" },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-005")).toBe(true);
    });

    it("should allow non-recursive call chains", () => {
      const schema = createValidSchema({
        actions: {
          step1: {
            flow: { kind: "patch", op: "set", path: "x", value: { kind: "lit", value: 1 } },
          },
          step2: {
            flow: { kind: "call", flow: "step1" },
          },
          main: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "call", flow: "step1" },
                { kind: "call", flow: "step2" },
              ],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Flow Node Validation", () => {
    it("should validate seq flow", () => {
      const schema = createValidSchema({
        actions: {
          test: {
            flow: {
              kind: "seq",
              steps: [
                { kind: "patch", op: "set", path: "a", value: { kind: "lit", value: 1 } },
                { kind: "patch", op: "set", path: "b", value: { kind: "lit", value: 2 } },
              ],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate if flow", () => {
      const schema = createValidSchema({
        actions: {
          test: {
            flow: {
              kind: "if",
              cond: { kind: "get", path: "flag" },
              then: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "yes" } },
              else: { kind: "patch", op: "set", path: "result", value: { kind: "lit", value: "no" } },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate effect flow", () => {
      const schema = createValidSchema({
        actions: {
          test: {
            flow: {
              kind: "effect",
              type: "http",
              params: {
                url: { kind: "lit", value: "https://api.example.com" },
              },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate halt flow", () => {
      const schema = createValidSchema({
        actions: {
          test: {
            flow: { kind: "halt", reason: "stopped" },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate fail flow", () => {
      const schema = createValidSchema({
        actions: {
          test: {
            flow: {
              kind: "fail",
              code: "ERROR",
              message: { kind: "lit", value: "Something went wrong" },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Expression Validation", () => {
    it("should validate nested expressions", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.complex": {
              expr: {
                kind: "if",
                cond: {
                  kind: "and",
                  args: [
                    { kind: "gt", left: { kind: "get", path: "x" }, right: { kind: "lit", value: 0 } },
                    { kind: "lt", left: { kind: "get", path: "x" }, right: { kind: "lit", value: 100 } },
                  ],
                },
                then: {
                  kind: "mul",
                  left: { kind: "get", path: "x" },
                  right: { kind: "lit", value: 2 },
                },
                else: { kind: "lit", value: 0 },
              },
              deps: ["x"],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate collection expressions", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.filtered": {
              expr: {
                kind: "filter",
                array: { kind: "get", path: "items" },
                predicate: { kind: "get", path: "$item.active" },
              },
              deps: ["items"],
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });
  });

  describe("Multiple Errors", () => {
    it("should report multiple validation errors", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.a": {
              expr: { kind: "get", path: "computed.b" },
              deps: ["computed.b"],
            },
            "computed.b": {
              expr: { kind: "get", path: "computed.a" },
              deps: ["computed.a"],
            },
          },
        },
        actions: {
          test: {
            flow: { kind: "call", flow: "nonexistent" },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      // Should have both cycle error and unknown flow error
      expect(result.errors.some((e) => e.code === "V-002")).toBe(true);
      expect(result.errors.some((e) => e.code === "V-004")).toBe(true);
    });
  });
});
