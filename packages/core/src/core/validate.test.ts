import { describe, it, expect } from "vitest";
import { validate } from "./validate.js";
import { hashSchemaSync } from "../utils/hash.js";
import type { DomainSchema } from "../schema/domain.js";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  dummy: { type: "string", required: true },
  a: { type: "number", required: true },
  b: { type: "number", required: true },
  x: { type: "number", required: true },
  count: { type: "number", required: true },
  balance: { type: "number", required: true },
  flag: { type: "boolean", required: true },
  result: { type: "string", required: true },
  items: {
    type: "array",
    required: true,
    items: {
      type: "object",
      required: true,
      fields: {
        active: { type: "boolean", required: true },
      },
    },
  },
};

const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.dummy": {
    expr: { kind: "get", path: "dummy" },
    deps: ["dummy"],
  },
};

const BASE_ACTIONS: DomainSchema["actions"] = {
  noop: { flow: { kind: "halt", reason: "noop" } },
};

// Helper to create a valid minimal schema
function createValidSchema(overrides: Partial<DomainSchema> = {}): DomainSchema {
  const { state, computed, actions: overrideActions, hash, types, ...restOverrides } = overrides;
  const stateFields = {
    ...BASE_STATE_FIELDS,
    ...(state?.fields ?? {}),
  };
  const computedFields = {
    ...BASE_COMPUTED_FIELDS,
    ...(computed?.fields ?? {}),
  };
  const actions = {
    ...BASE_ACTIONS,
    ...(overrideActions ?? {}),
  };

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:test",
    version: "1.0.0",
    ...restOverrides,
    types: types ?? {},
    state: { fields: stateFields },
    computed: { fields: computedFields },
    actions,
  };

  return {
    ...schemaWithoutHash,
    hash: hash ?? hashSchemaSync(schemaWithoutHash),
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
        id: "manifesto:test",
        version: 123, // Should be string
        hash: "test-hash",
        state: { fields: {} },
        computed: { fields: {} },
        actions: {},
      });

      expect(result.valid).toBe(false);
    });

    it("should reject schema with invalid id", () => {
      const schema = createValidSchema({ id: "not-a-uri" });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "id")).toBe(true);
    });

    it("should reject schema with invalid semver", () => {
      const schema = createValidSchema({ version: "1.0" });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "version")).toBe(true);
    });

    it("should reject schema with empty computed fields", () => {
      const schema = createValidSchema();
      schema.computed = { fields: {} };

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === "computed.fields")).toBe(true);
    });

    it("should reject schema with hash mismatch", () => {
      const schema = createValidSchema({ hash: "bad-hash" });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-008")).toBe(true);
    });

    it("should accept schemas with extra compiler fields when hash matches raw canonical", () => {
      const schemaWithoutHash = {
        id: "manifesto:test",
        version: "1.0.0",
        state: { fields: BASE_STATE_FIELDS },
        computed: { fields: BASE_COMPUTED_FIELDS },
        actions: BASE_ACTIONS,
        types: {
          CustomType: {
            name: "CustomType",
            definition: {
              kind: "object",
              fields: {
                a: { type: { kind: "primitive", type: "string" }, optional: false },
                b: { type: { kind: "primitive", type: "number" }, optional: false },
              },
            },
          },
        },
      };
      const schema = {
        ...schemaWithoutHash,
        hash: hashSchemaSync(schemaWithoutHash as Parameters<typeof hashSchemaSync>[0]),
      };

      const result = validate(schema);

      expect(result.valid).toBe(true);
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

    it("should require deps to cover all expression paths", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.sum": {
              expr: { kind: "add", left: { kind: "get", path: "a" }, right: { kind: "get", path: "b" } },
              deps: ["a"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.message.includes("Missing dependency"))).toBe(true);
    });

    it("should reject deps with unknown paths", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.sum": {
              expr: { kind: "get", path: "a" },
              deps: ["a", "missing.path"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-001")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("missing.path"))).toBe(true);
    });

    it("should reject computed expressions that read system paths", () => {
      const schema = createValidSchema({
        computed: {
          fields: {
            "computed.invalid": {
              expr: { kind: "get", path: "system.status" },
              deps: ["dummy"],
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-003")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("system.status"))).toBe(true);
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

    it("should allow meta paths in action flow", () => {
      const schema = createValidSchema({
        actions: {
          mark: {
            flow: {
              kind: "patch",
              op: "set",
              path: "dummy",
              value: { kind: "get", path: "meta.intentId" },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should reject unknown input paths in action expressions", () => {
      const schema = createValidSchema({
        actions: {
          update: {
            input: {
              type: "object",
              required: true,
              fields: {
                value: { type: "string", required: true },
              },
            },
            flow: {
              kind: "patch",
              op: "set",
              path: "dummy",
              value: { kind: "get", path: "input.missing" },
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-003")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("input.missing"))).toBe(true);
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
