/**
 * Integration tests for new expression types (MEL SPEC v0.2)
 *
 * These tests verify that the new expressions work correctly
 * through the full Host pipeline: dispatch → compute → apply
 */
import { describe, it, expect } from "vitest";
import { createHost } from "../host.js";
import { createIntent, type DomainSchema, hashSchemaSync } from "@manifesto-ai/core";

const BASE_STATE_FIELDS: DomainSchema["state"]["fields"] = {
  dummy: { type: "string", required: true },
  result: { type: "number", required: true },
  value: { type: "number", required: true },
  username: { type: "string", required: true },
  discount: { type: "number", required: true },
  bioLength: { type: "number", required: true },
  bioTooLong: { type: "boolean", required: true },
  message: { type: "string", required: true },
  formattedPrice: { type: "string", required: true },
};

const STRING_RESULT_FIELDS: DomainSchema["state"]["fields"] = {
  result: { type: "string", required: true },
};

const BASE_COMPUTED_FIELDS: DomainSchema["computed"]["fields"] = {
  "computed.dummy": {
    expr: { kind: "get", path: "dummy" },
    deps: ["dummy"],
  },
};

// Type for test data
type TestData = Record<string, unknown>;

// Helper to get typed data from snapshot
function getData(snapshot: { data: unknown }): TestData {
  return snapshot.data as TestData;
}

// Helper to create a minimal domain schema with custom actions
function createTestSchema(
  actions: DomainSchema["actions"],
  stateOverrides: DomainSchema["state"]["fields"] = {}
): DomainSchema {
  const stateFields = {
    ...BASE_STATE_FIELDS,
    ...stateOverrides,
  };

  const schemaWithoutHash: Omit<DomainSchema, "hash"> = {
    id: "manifesto:test",
    version: "1.0.0",
    types: {},
    state: { fields: stateFields },
    computed: { fields: BASE_COMPUTED_FIELDS },
    actions,
  };

  return {
    ...schemaWithoutHash,
    hash: hashSchemaSync(schemaWithoutHash),
  };
}

let intentCounter = 0;
const nextIntentId = () => `intent-${intentCounter++}`;
const createTestIntent = (type: string, input?: unknown) =>
  input === undefined
    ? createIntent(type, nextIntentId())
    : createIntent(type, input, nextIntentId());

// ============================================================================
// Math Expressions: neg, abs, min, max, floor, ceil, round, sqrt, pow
// ============================================================================

describe("Math Expressions via Host", () => {
  describe("neg - negate", () => {
    it("should negate positive number", async () => {
      const schema = createTestSchema({
        negate: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "neg", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("negate", { value: 5 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(-5);
    });

    it("should negate negative number", async () => {
      const schema = createTestSchema({
        negate: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "neg", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("negate", { value: -3 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(3);
    });
  });

  describe("abs - absolute value", () => {
    it("should return absolute value of negative", async () => {
      const schema = createTestSchema({
        absolute: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "abs", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("absolute", { value: -42 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(42);
    });

    it("should keep positive value unchanged", async () => {
      const schema = createTestSchema({
        absolute: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "abs", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("absolute", { value: 42 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(42);
    });
  });

  describe("min - minimum value", () => {
    it("should return minimum of multiple values", async () => {
      const schema = createTestSchema({
        findMin: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "min",
              args: [
                { kind: "get", path: "input.a" },
                { kind: "get", path: "input.b" },
                { kind: "get", path: "input.c" },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("findMin", { a: 10, b: 5, c: 15 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(5);
    });

    it("should clamp value to minimum", async () => {
      const schema = createTestSchema({
        clampMin: {
          flow: {
            kind: "patch",
            op: "set",
            path: "value",
            value: {
              kind: "max",
              args: [{ kind: "get", path: "input.value" }, { kind: "lit", value: 0 }],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("clampMin", { value: -10 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).value).toBe(0);
    });
  });

  describe("max - maximum value", () => {
    it("should return maximum of multiple values", async () => {
      const schema = createTestSchema({
        findMax: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "max",
              args: [
                { kind: "get", path: "input.a" },
                { kind: "get", path: "input.b" },
                { kind: "get", path: "input.c" },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("findMax", { a: 10, b: 25, c: 15 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(25);
    });
  });

  describe("floor, ceil, round - rounding operations", () => {
    it("floor should round down", async () => {
      const schema = createTestSchema({
        floorValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "floor", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("floorValue", { value: 3.7 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(3);
    });

    it("ceil should round up", async () => {
      const schema = createTestSchema({
        ceilValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "ceil", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("ceilValue", { value: 3.2 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(4);
    });

    it("round should round to nearest", async () => {
      const schema = createTestSchema({
        roundValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "round", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });

      let result = await host.dispatch(createTestIntent("roundValue", { value: 3.4 }));
      expect(getData(result.snapshot).result).toBe(3);

      result = await host.dispatch(createTestIntent("roundValue", { value: 3.5 }));
      expect(getData(result.snapshot).result).toBe(4);
    });
  });

  describe("sqrt - square root", () => {
    it("should compute square root", async () => {
      const schema = createTestSchema({
        sqrtValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "sqrt", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("sqrtValue", { value: 16 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(4);
    });

    it("should return null for negative input (totality)", async () => {
      const schema = createTestSchema({
        sqrtValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "sqrt", arg: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("sqrtValue", { value: -9 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(null);
    });

    it("should work with coalesce for safe sqrt", async () => {
      const schema = createTestSchema({
        safeSqrt: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "coalesce",
              args: [
                { kind: "sqrt", arg: { kind: "get", path: "input.value" } },
                { kind: "lit", value: 0 },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("safeSqrt", { value: -16 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(0);
    });
  });

  describe("pow - power/exponentiation", () => {
    it("should compute power", async () => {
      const schema = createTestSchema({
        power: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "pow",
              base: { kind: "get", path: "input.base" },
              exponent: { kind: "get", path: "input.exp" },
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("power", { base: 2, exp: 10 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(1024);
    });

    it("should compute square", async () => {
      const schema = createTestSchema({
        square: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "pow",
              base: { kind: "get", path: "input.value" },
              exponent: { kind: "lit", value: 2 },
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("square", { value: 7 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(49);
    });
  });
});

// ============================================================================
// String Expressions: trim, toLowerCase, toUpperCase, strLen
// ============================================================================

describe("String Expressions via Host", () => {
  describe("trim - remove whitespace", () => {
    it("should trim whitespace from both ends", async () => {
      const schema = createTestSchema({
        trimValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "trim", str: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("trimValue", { value: "  hello world  " }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("hello world");
    });

    it("should handle whitespace-only string", async () => {
      const schema = createTestSchema({
        trimValue: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "trim", str: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("trimValue", { value: "   " }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("");
    });
  });

  describe("toLowerCase - convert to lowercase", () => {
    it("should convert to lowercase", async () => {
      const schema = createTestSchema({
        toLower: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toLowerCase", str: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("toLower", { value: "Hello WORLD" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("hello world");
    });
  });

  describe("toUpperCase - convert to uppercase", () => {
    it("should convert to uppercase", async () => {
      const schema = createTestSchema({
        toUpper: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toUpperCase", str: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("toUpper", { value: "Hello World" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("HELLO WORLD");
    });
  });

  describe("strLen - string length", () => {
    it("should return string length", async () => {
      const schema = createTestSchema({
        getLength: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "strLen", str: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("getLength", { value: "hello" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(5);
    });

    it("should return 0 for empty string", async () => {
      const schema = createTestSchema({
        getLength: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "strLen", str: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("getLength", { value: "" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(0);
    });

    it("should handle unicode correctly", async () => {
      const schema = createTestSchema({
        getLength: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "strLen", str: { kind: "get", path: "input.value" } },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("getLength", { value: "한글" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe(2);
    });
  });
});

// ============================================================================
// Complex Scenarios: Combining multiple expressions
// ============================================================================

describe("Complex Expression Combinations via Host", () => {
  it("should normalize username: trim + toLowerCase", async () => {
    const schema = createTestSchema({
      normalizeUsername: {
        flow: {
          kind: "patch",
          op: "set",
          path: "username",
          value: {
            kind: "toLowerCase",
            str: { kind: "trim", str: { kind: "get", path: "input.username" } },
          },
        },
      },
    });

    const host = createHost(schema, { initialData: {} });
    const result = await host.dispatch(
      createTestIntent("normalizeUsername", { username: "  JohnDoe123  " })
    );

    expect(result.status).toBe("complete");
    expect(getData(result.snapshot).username).toBe("johndoe123");
  });

  it("should clamp value to range: min + max", async () => {
    const schema = createTestSchema({
      clamp: {
        flow: {
          kind: "patch",
          op: "set",
          path: "result",
          value: {
            kind: "min",
            args: [
              {
                kind: "max",
                args: [
                  { kind: "get", path: "input.value" },
                  { kind: "get", path: "input.min" },
                ],
              },
              { kind: "get", path: "input.max" },
            ],
          },
        },
      },
    });

    const host = createHost(schema, { initialData: {} });

    // Value below min
    let result = await host.dispatch(createTestIntent("clamp", { value: -10, min: 0, max: 100 }));
    expect(getData(result.snapshot).result).toBe(0);

    // Value above max
    result = await host.dispatch(createTestIntent("clamp", { value: 150, min: 0, max: 100 }));
    expect(getData(result.snapshot).result).toBe(100);

    // Value in range
    result = await host.dispatch(createTestIntent("clamp", { value: 50, min: 0, max: 100 }));
    expect(getData(result.snapshot).result).toBe(50);
  });

  it("should compute distance: sqrt + pow + add + sub", async () => {
    const schema = createTestSchema({
      distance: {
        flow: {
          kind: "patch",
          op: "set",
          path: "result",
          value: {
            kind: "sqrt",
            arg: {
              kind: "add",
              left: {
                kind: "pow",
                base: {
                  kind: "sub",
                  left: { kind: "get", path: "input.x2" },
                  right: { kind: "get", path: "input.x1" },
                },
                exponent: { kind: "lit", value: 2 },
              },
              right: {
                kind: "pow",
                base: {
                  kind: "sub",
                  left: { kind: "get", path: "input.y2" },
                  right: { kind: "get", path: "input.y1" },
                },
                exponent: { kind: "lit", value: 2 },
              },
            },
          },
        },
      },
    });

    const host = createHost(schema, { initialData: {} });
    const result = await host.dispatch(
      createTestIntent("distance", { x1: 0, y1: 0, x2: 3, y2: 4 })
    );

    expect(result.status).toBe("complete");
    expect(getData(result.snapshot).result).toBe(5);
  });

  it("should compute discount with floor rounding", async () => {
    const schema = createTestSchema({
      calculateDiscount: {
        flow: {
          kind: "patch",
          op: "set",
          path: "discount",
          value: {
            kind: "floor",
            arg: {
              kind: "mul",
              left: { kind: "get", path: "input.price" },
              right: {
                kind: "div",
                left: { kind: "get", path: "input.percent" },
                right: { kind: "lit", value: 100 },
              },
            },
          },
        },
      },
    });

    const host = createHost(schema, { initialData: {} });
    // 99 * 15% = 14.85, floor = 14
    const result = await host.dispatch(
      createTestIntent("calculateDiscount", { price: 99, percent: 15 })
    );

    expect(result.status).toBe("complete");
    expect(getData(result.snapshot).discount).toBe(14);
  });

  it("should validate bio length", async () => {
    const schema = createTestSchema({
      checkBio: {
        flow: {
          kind: "seq",
          steps: [
            {
              kind: "patch",
              op: "set",
              path: "bioLength",
              value: { kind: "strLen", str: { kind: "get", path: "input.bio" } },
            },
            {
              kind: "patch",
              op: "set",
              path: "bioTooLong",
              value: {
                kind: "gt",
                left: { kind: "strLen", str: { kind: "get", path: "input.bio" } },
                right: { kind: "lit", value: 140 },
              },
            },
          ],
        },
      },
    });

    const host = createHost(schema, { initialData: {} });

    // Short bio
    let result = await host.dispatch(createTestIntent("checkBio", { bio: "Hello world" }));
    expect(getData(result.snapshot).bioLength).toBe(11);
    expect(getData(result.snapshot).bioTooLong).toBe(false);

    // Long bio
    result = await host.dispatch(createTestIntent("checkBio", { bio: "a".repeat(141) }));
    expect(getData(result.snapshot).bioLength).toBe(141);
    expect(getData(result.snapshot).bioTooLong).toBe(true);
  });
});

// ============================================================================
// Conversion Expressions: toString
// ============================================================================

describe("Conversion Expressions via Host", () => {
  describe("toString - convert to string", () => {
    it("should convert number to string", async () => {
      const schema = createTestSchema({
        convertToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toString", arg: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("convertToString", { value: 42 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("42");
    });

    it("should convert boolean to string", async () => {
      const schema = createTestSchema({
        convertToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toString", arg: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });

      let result = await host.dispatch(createTestIntent("convertToString", { value: true }));
      expect(getData(result.snapshot).result).toBe("true");

      result = await host.dispatch(createTestIntent("convertToString", { value: false }));
      expect(getData(result.snapshot).result).toBe("false");
    });

    it("should convert null to empty string", async () => {
      const schema = createTestSchema({
        convertToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toString", arg: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("convertToString", { value: null }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("");
    });

    it("should pass through string unchanged", async () => {
      const schema = createTestSchema({
        convertToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toString", arg: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("convertToString", { value: "hello" }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("hello");
    });

    it("should convert decimal numbers correctly", async () => {
      const schema = createTestSchema({
        convertToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: { kind: "toString", arg: { kind: "get", path: "input.value" } },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("convertToString", { value: 3.14159 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("3.14159");
    });
  });

  describe("toString with expressions", () => {
    it("should convert arithmetic result to string", async () => {
      const schema = createTestSchema({
        sumToString: {
          flow: {
            kind: "patch",
            op: "set",
            path: "result",
            value: {
              kind: "toString",
              arg: {
                kind: "add",
                left: { kind: "get", path: "input.a" },
                right: { kind: "get", path: "input.b" },
              },
            },
          },
        },
      }, STRING_RESULT_FIELDS);

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("sumToString", { a: 10, b: 20 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).result).toBe("30");
    });

    it("should work with concat for building messages", async () => {
      // Simulating: concat("Count: ", toString(count))
      const schema = createTestSchema({
        buildMessage: {
          flow: {
            kind: "patch",
            op: "set",
            path: "message",
            value: {
              kind: "concat",
              args: [
                { kind: "lit", value: "Count: " },
                { kind: "toString", arg: { kind: "get", path: "input.count" } },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("buildMessage", { count: 42 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).message).toBe("Count: 42");
    });

    it("should format price with currency", async () => {
      // Simulating: concat("$", toString(price))
      const schema = createTestSchema({
        formatPrice: {
          flow: {
            kind: "patch",
            op: "set",
            path: "formattedPrice",
            value: {
              kind: "concat",
              args: [
                { kind: "lit", value: "$" },
                { kind: "toString", arg: { kind: "get", path: "input.price" } },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("formatPrice", { price: 99.99 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).formattedPrice).toBe("$99.99");
    });

    it("should build complex message with multiple values", async () => {
      // Simulating: concat("User ", toString(id), " has ", toString(points), " points")
      const schema = createTestSchema({
        buildUserMessage: {
          flow: {
            kind: "patch",
            op: "set",
            path: "message",
            value: {
              kind: "concat",
              args: [
                { kind: "lit", value: "User " },
                { kind: "toString", arg: { kind: "get", path: "input.id" } },
                { kind: "lit", value: " has " },
                { kind: "toString", arg: { kind: "get", path: "input.points" } },
                { kind: "lit", value: " points" },
              ],
            },
          },
        },
      });

      const host = createHost(schema, { initialData: {} });
      const result = await host.dispatch(createTestIntent("buildUserMessage", { id: 123, points: 500 }));

      expect(result.status).toBe("complete");
      expect(getData(result.snapshot).message).toBe("User 123 has 500 points");
    });
  });
});
