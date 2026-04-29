import { describe, it, expect } from "vitest";
import { validate } from "./validate.js";
import { collectGetPathsFromExpr, getFieldSpecAtPath, pathExistsInFieldSpec } from "./validation-utils.js";
import { hashSchemaSync } from "../utils/hash.js";
import { semanticPathToPatchPath } from "../utils/patch-path.js";
import type { DomainSchema } from "../schema/domain.js";
import type { ExprNode } from "../schema/expr.js";
import type { FieldSpec } from "../schema/field.js";

const pp = (path: string) => semanticPathToPatchPath(path);

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
  "dummy": {
    expr: { kind: "get", path: "x" },
    deps: ["x"],
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
    state: {
      fields: stateFields,
      ...(state?.fieldTypes ? { fieldTypes: state.fieldTypes } : {}),
    },
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
            "total": {
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
            "sum": {
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
            "sum": {
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
            "invalid": {
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
            "a": {
              expr: { kind: "get", path: "b" },
              deps: ["b"],
            },
            "b": {
              expr: { kind: "get", path: "a" },
              deps: ["a"],
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
            "self": {
              expr: { kind: "get", path: "self" },
              deps: ["self"],
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
            "a": {
              expr: { kind: "get", path: "b" },
              deps: ["b"],
            },
            "b": {
              expr: { kind: "get", path: "c" },
              deps: ["c"],
            },
            "c": {
              expr: { kind: "get", path: "a" },
              deps: ["a"],
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
            "a": {
              expr: { kind: "get", path: "x" },
              deps: ["x"],
            },
            "b": {
              expr: { kind: "get", path: "a" },
              deps: ["a"],
            },
            "c": {
              expr: { kind: "get", path: "b" },
              deps: ["b"],
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
              op: "set", path: pp("count"),
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
              op: "set", path: pp("balance"),
              value: { kind: "lit", value: 0 },
            },
          },
        },
      });

      const result = validate(schema);
      expect(result.valid).toBe(true);
    });

    it("should validate action with dispatchability condition", () => {
      const schema = createValidSchema({
        actions: {
          withdraw: {
            input: {
              type: "object",
              required: true,
              fields: {
                amount: { type: "number", required: true },
              },
            },
            dispatchable: {
              kind: "gte",
              left: { kind: "get", path: "balance" },
              right: { kind: "get", path: "input.amount" },
            },
            flow: {
              kind: "patch",
              op: "set", path: pp("balance"),
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
              op: "set", path: pp("dummy"),
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
              op: "set", path: pp("dummy"),
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

    it("should reject unknown input paths in dispatchable expressions", () => {
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
            dispatchable: { kind: "get", path: "input.missing" },
            flow: {
              kind: "patch",
              op: "set", path: pp("dummy"),
              value: { kind: "get", path: "input.value" },
            },
          },
        },
      });

      const result = validate(schema);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "V-003")).toBe(true);
      expect(result.errors.some((e) => e.message.includes("input.missing"))).toBe(true);
    });

    it("should allow numeric object keys in inputType-backed action paths", () => {
      const schema = createValidSchema({
        actions: {
          update: {
            inputType: {
              kind: "object",
              fields: {
                payload: {
                  type: {
                    kind: "object",
                    fields: {
                      "0": {
                        type: { kind: "primitive", type: "string" },
                        optional: false,
                      },
                    },
                  },
                  optional: false,
                },
              },
            },
            flow: {
              kind: "patch",
              op: "set", path: pp("dummy"),
              value: { kind: "get", path: "input.payload.0" },
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
            flow: { kind: "patch", op: "set", path: pp("x"), value: { kind: "lit", value: 1 } },
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
                { kind: "patch", op: "set", path: pp("x"), value: { kind: "lit", value: 1 } },
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
            flow: { kind: "patch", op: "set", path: pp("x"), value: { kind: "lit", value: 1 } },
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
                { kind: "patch", op: "set", path: pp("a"), value: { kind: "lit", value: 1 } },
                { kind: "patch", op: "set", path: pp("b"), value: { kind: "lit", value: 2 } },
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
              then: { kind: "patch", op: "set", path: pp("result"), value: { kind: "lit", value: "yes" } },
              else: { kind: "patch", op: "set", path: pp("result"), value: { kind: "lit", value: "no" } },
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
            "complex": {
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
            "filtered": {
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
            "a": {
              expr: { kind: "get", path: "b" },
              deps: ["b"],
            },
            "b": {
              expr: { kind: "get", path: "a" },
              deps: ["a"],
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

// ============================================================
// collectGetPathsFromExpr — SPEC v2.0.3 expression coverage
// ============================================================

describe("collectGetPathsFromExpr", () => {
  const get = (path: string): ExprNode => ({ kind: "get", path });
  const lit = (value: unknown): ExprNode => ({ kind: "lit", value });

  it("collects paths from pow (base + exponent)", () => {
    const expr: ExprNode = { kind: "pow", base: get("data.x"), exponent: get("data.y") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.x", "data.y"]);
  });

  it("collects paths from min/max (args array)", () => {
    const expr: ExprNode = { kind: "min", args: [get("data.a"), get("data.b"), lit(0)] };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.a", "data.b"]);
  });

  it("collects paths from unary math (abs, neg, floor, ceil, round, sqrt)", () => {
    for (const kind of ["abs", "neg", "floor", "ceil", "round", "sqrt"] as const) {
      const expr: ExprNode = { kind, arg: get(`data.${kind}`) };
      expect(collectGetPathsFromExpr(expr)).toEqual([`data.${kind}`]);
    }
  });

  it("collects paths from conversion (toString, toNumber, toBoolean)", () => {
    for (const kind of ["toString", "toNumber", "toBoolean"] as const) {
      const expr: ExprNode = { kind, arg: get(`data.${kind}`) };
      expect(collectGetPathsFromExpr(expr)).toEqual([`data.${kind}`]);
    }
  });

  it("collects paths from array-only unary (reverse, unique, flat, sumArray, minArray, maxArray)", () => {
    for (const kind of ["reverse", "unique", "flat", "sumArray", "minArray", "maxArray"] as const) {
      const expr: ExprNode = { kind, array: get(`data.${kind}`) };
      expect(collectGetPathsFromExpr(expr)).toEqual([`data.${kind}`]);
    }
  });

  it("collects paths from string-only unary (toLowerCase, toUpperCase, strLen)", () => {
    for (const kind of ["toLowerCase", "toUpperCase", "strLen"] as const) {
      const expr: ExprNode = { kind, str: get(`data.${kind}`) };
      expect(collectGetPathsFromExpr(expr)).toEqual([`data.${kind}`]);
    }
  });

  it("collects paths from startsWith", () => {
    const expr: ExprNode = { kind: "startsWith", str: get("data.s"), prefix: get("data.p") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.s", "data.p"]);
  });

  it("collects paths from endsWith", () => {
    const expr: ExprNode = { kind: "endsWith", str: get("data.s"), suffix: get("data.p") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.s", "data.p"]);
  });

  it("collects paths from strIncludes / indexOf", () => {
    for (const kind of ["strIncludes", "indexOf"] as const) {
      const expr: ExprNode = { kind, str: get("data.s"), search: get("data.q") };
      expect(collectGetPathsFromExpr(expr)).toEqual(["data.s", "data.q"]);
    }
  });

  it("collects paths from replace", () => {
    const expr: ExprNode = {
      kind: "replace",
      str: get("data.s"),
      search: get("data.from"),
      replacement: get("data.to"),
    };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.s", "data.from", "data.to"]);
  });

  it("collects paths from split", () => {
    const expr: ExprNode = { kind: "split", str: get("data.s"), delimiter: get("data.d") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.s", "data.d"]);
  });

  it("collects paths from hasKey", () => {
    const expr: ExprNode = { kind: "hasKey", obj: get("data.o"), key: get("data.k") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.o", "data.k"]);
  });

  it("collects paths from pick / omit", () => {
    for (const kind of ["pick", "omit"] as const) {
      const expr: ExprNode = { kind, obj: get("data.o"), keys: get("data.ks") };
      expect(collectGetPathsFromExpr(expr)).toEqual(["data.o", "data.ks"]);
    }
  });

  it("collects paths from fromEntries", () => {
    const expr: ExprNode = { kind: "fromEntries", entries: get("data.e") };
    expect(collectGetPathsFromExpr(expr)).toEqual(["data.e"]);
  });
});

describe("validation-utils path lookup", () => {
  it("preserves numeric object keys for string paths", () => {
    const spec: FieldSpec = {
      type: "object",
      required: true,
      fields: {
        input: {
          type: "object",
          required: true,
          fields: {
            "2024": { type: "string", required: false },
          },
        },
      },
    };

    expect(pathExistsInFieldSpec(spec, "input.2024")).toBe(true);
    expect(getFieldSpecAtPath(spec, "input.2024")).toEqual({ type: "string", required: false });
  });

  it("still treats numeric segments as array indices when traversing array specs", () => {
    const spec: FieldSpec = {
      type: "object",
      required: true,
      fields: {
        items: {
          type: "array",
          required: true,
          items: {
            type: "object",
            required: true,
            fields: {
              title: { type: "string", required: true },
            },
          },
        },
      },
    };

    expect(pathExistsInFieldSpec(spec, "items.0.title")).toBe(true);
    expect(pathExistsInFieldSpec(spec, "items.foo.title")).toBe(false);
    expect(getFieldSpecAtPath(spec, "items.0.title")).toEqual({ type: "string", required: true });
    expect(getFieldSpecAtPath(spec, "items.foo.title")).toBeNull();
  });
});

describe("V-009: default type validation", () => {
  it("should fail when string field has number default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          name: { type: "string", required: false, default: 42 },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should fail when number field has string default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          age: { type: "number", required: false, default: "hello" },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should fail when boolean field has string default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          flag: { type: "boolean", required: false, default: "yes" },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should fail when required string field has null default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          name: { type: "string", required: true, default: null },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should pass when optional string field has null default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          name: { type: "string", required: false, default: null },
        },
      },
    });
    const result = validate(schema);
    const v009Errors = result.errors.filter((e) => e.code === "V-009");
    expect(v009Errors).toHaveLength(0);
  });

  it("should pass when required fieldTypes allow nullable defaults", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          selectedId: { type: "string", required: true, default: null },
        },
        fieldTypes: {
          selectedId: {
            kind: "union",
            types: [
              { kind: "primitive", type: "string" },
              { kind: "literal", value: null },
            ],
          },
        },
      },
    });
    const result = validate(schema);
    const v009Errors = result.errors.filter((e) => e.code === "V-009");
    expect(v009Errors).toHaveLength(0);
  });

  it("should fail when fieldTypes keep a required field non-nullable", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          selectedId: { type: "string", required: true, default: null },
        },
        fieldTypes: {
          selectedId: { kind: "primitive", type: "string" },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009", path: "state.fields.selectedId" })
    );
  });

  it("should fail when state.fieldTypes contains roots missing from state.fields", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          count: { type: "number", required: true, default: 0 },
        },
        fieldTypes: {
          ghost: { kind: "primitive", type: "string" },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "state.fieldTypes.ghost" }),
    );
  });

  it("should fail when state.fieldTypes contains unresolved refs", () => {
    const schema = createValidSchema({
      state: {
        fields: {},
        fieldTypes: {
          count: { kind: "ref", name: "MissingType" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "state.fieldTypes.count" }),
    );
  });

  it("should fail when action.inputType contains unresolved refs", () => {
    const schema = createValidSchema({
      actions: {
        submit: {
          inputType: { kind: "ref", name: "MissingInput" },
          flow: { kind: "halt", reason: "submit" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "actions.submit.inputType" }),
    );
  });

  it("should fail when action.params do not match the declared inputType fields", () => {
    const schema = createValidSchema({
      actions: {
        submit: {
          params: ["x", "y"],
          inputType: {
            kind: "object",
            fields: {
              x: { type: { kind: "primitive", type: "string" }, optional: false },
            },
          },
          flow: { kind: "halt", reason: "submit" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "actions.submit.params.1" }),
    );
  });

  it("should accept nullable inputType object carriers that resolve null refs through aliases", () => {
    const schema = createValidSchema({
      types: {
        InputObj: {
          name: "InputObj",
          definition: {
            kind: "object",
            fields: {
              x: { type: { kind: "primitive", type: "string" }, optional: false },
            },
          },
        },
        NullAlias: {
          name: "NullAlias",
          definition: { kind: "literal", value: null },
        },
        MaybeInput: {
          name: "MaybeInput",
          definition: {
            kind: "union",
            types: [
              { kind: "ref", name: "InputObj" },
              { kind: "ref", name: "NullAlias" },
            ],
          },
        },
      },
      actions: {
        submit: {
          params: ["x"],
          inputType: { kind: "ref", name: "MaybeInput" },
          flow: { kind: "halt", reason: "submit" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(true);
  });

  it("should reject cyclic nullable inputType aliases without overflowing validation", () => {
    const schema = createValidSchema({
      types: {
        CyclicMaybeInput: {
          name: "CyclicMaybeInput",
          definition: {
            kind: "union",
            types: [
              { kind: "ref", name: "CyclicMaybeInput" },
              { kind: "literal", value: null },
            ],
          },
        },
      },
      actions: {
        submit: {
          params: ["x"],
          inputType: { kind: "ref", name: "CyclicMaybeInput" },
          flow: { kind: "halt", reason: "submit" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "actions.submit.params" }),
    );
  });

  it("should fail when action.params contains duplicate names", () => {
    const schema = createValidSchema({
      actions: {
        submit: {
          params: ["x", "x"],
          inputType: {
            kind: "object",
            fields: {
              x: { type: { kind: "primitive", type: "string" }, optional: false },
            },
          },
          flow: { kind: "halt", reason: "submit" },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "actions.submit.params.1" }),
    );
  });

  it("should fail when typing seams declare record keys that are not strings", () => {
    const schema = createValidSchema({
      state: {
        fields: {},
        fieldTypes: {
          count: {
            kind: "record",
            key: { kind: "primitive", type: "number" },
            value: { kind: "primitive", type: "string" },
          },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-010", path: "state.fieldTypes.count.key" }),
    );
  });

  it("should keep FieldSpec default validation for roots missing fieldTypes", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          selectedId: { type: "string", required: true, default: 42 as unknown as string },
        },
        fieldTypes: {
          count: { kind: "primitive", type: "number" },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009", path: "state.fields.selectedId" }),
    );
  });

  it("should still require optional defaults when fieldTypes are present", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          settings: {
            type: "object",
            required: true,
            default: {},
            fields: {
              theme: { type: "string", required: false },
            },
          },
        },
        fieldTypes: {
          settings: {
            kind: "object",
            fields: {
              theme: { type: { kind: "primitive", type: "string" }, optional: true },
            },
          },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "SCHEMA_ERROR", path: "state.fields.settings.theme" }),
    );
  });

  it("should accept escaped state paths when fieldTypes drive path validation", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          files: {
            type: "object",
            required: true,
            default: {},
          },
        },
        fieldTypes: {
          files: {
            kind: "record",
            key: { kind: "primitive", type: "string" },
            value: {
              kind: "object",
              fields: {
                status: { type: { kind: "primitive", type: "string" }, optional: false },
              },
            },
          },
        },
      },
      computed: {
        fields: {
          statusForProof: {
            expr: { kind: "get", path: String.raw`files.file:///proof\.lean.status` },
            deps: [String.raw`files.file:///proof\.lean.status`],
          },
        },
      },
    });

    const result = validate(schema);

    expect(result.valid).toBe(true);
  });

  it("should fail when nested object field has wrong nested default type", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          profile: {
            type: "object",
            required: false,
            default: { age: "not-a-number" },
            fields: {
              age: { type: "number", required: true },
            },
          },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should fail when array field has wrong item types in default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          tags: {
            type: "array",
            required: false,
            default: [1, 2, 3],
            items: { type: "string", required: true },
          },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should fail when enum field has out-of-range default", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          color: {
            type: { enum: ["red", "green", "blue"] },
            required: false,
            default: "yellow",
          },
        },
      },
    });
    const result = validate(schema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ code: "V-009" })
    );
  });

  it("should pass with valid defaults for each type", () => {
    const schema = createValidSchema({
      state: {
        fields: {
          name: { type: "string", required: false, default: "hello" },
          age: { type: "number", required: false, default: 42 },
          active: { type: "boolean", required: false, default: true },
          color: {
            type: { enum: ["red", "green", "blue"] },
            required: false,
            default: "red",
          },
          tags: {
            type: "array",
            required: false,
            default: ["a", "b"],
            items: { type: "string", required: true },
          },
          profile: {
            type: "object",
            required: false,
            default: { age: 25 },
            fields: {
              age: { type: "number", required: true },
            },
          },
        },
      },
    });
    const result = validate(schema);
    const v009Errors = result.errors.filter((e) => e.code === "V-009");
    expect(v009Errors).toHaveLength(0);
  });
});
