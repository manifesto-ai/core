/**
 * @fileoverview Schema Tests
 *
 * Pure validation tests - no mocks required.
 */

import { describe, it, expect } from "vitest";
import {
  IntentIRSchema,
  parseIntentIR,
  safeParseIntentIR,
  validateIntentIR,
  ForceSchema,
  EventClassSchema,
  TermSchema,
  PredSchema,
} from "../schema/index.js";

describe("IntentIR Schema", () => {
  const validIR = {
    v: "0.2",
    force: "DO",
    event: { lemma: "CANCEL", class: "CONTROL" },
    args: {
      TARGET: {
        kind: "entity",
        entityType: "Order",
        ref: { kind: "last" },
      },
    },
  };

  it("should parse valid IntentIR", () => {
    const result = IntentIRSchema.safeParse(validIR);
    expect(result.success).toBe(true);
  });

  it("should reject invalid version", () => {
    const invalid = { ...validIR, v: "1.0" };
    const result = IntentIRSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject invalid force", () => {
    const invalid = { ...validIR, force: "INVALID" };
    const result = IntentIRSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject lowercase lemma", () => {
    const invalid = {
      ...validIR,
      event: { lemma: "cancel", class: "CONTROL" },
    };
    const result = IntentIRSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should parse empty args", () => {
    const withEmptyArgs = { ...validIR, args: {} };
    const result = IntentIRSchema.safeParse(withEmptyArgs);
    expect(result.success).toBe(true);
  });

  it("should parse with optional fields", () => {
    const withOptionals = {
      ...validIR,
      mod: "MUST",
      time: { kind: "NOW" },
      verify: { mode: "POLICY" },
      out: { type: "text", format: "markdown" },
    };
    const result = IntentIRSchema.safeParse(withOptionals);
    expect(result.success).toBe(true);
  });

  it("should reject unknown root keys", () => {
    const invalid = { ...validIR, extra: "nope" };
    const result = IntentIRSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("should reject unknown arg roles", () => {
    const invalid = {
      ...validIR,
      args: {
        TARGET: {
          kind: "entity",
          entityType: "Order",
        },
        EXTRA: { kind: "path", path: "state.extra" },
      },
    };
    const result = IntentIRSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("parseIntentIR", () => {
  it("should return parsed IR on success", () => {
    const ir = parseIntentIR({
      v: "0.2",
      force: "ASK",
      event: { lemma: "LIST", class: "OBSERVE" },
      args: {},
    });
    expect(ir.force).toBe("ASK");
  });

  it("should throw on invalid input", () => {
    expect(() => parseIntentIR({ invalid: true })).toThrow();
  });
});

describe("safeParseIntentIR", () => {
  it("should return success result", () => {
    const result = safeParseIntentIR({
      v: "0.2",
      force: "DO",
      event: { lemma: "CREATE", class: "CREATE" },
      args: {},
    });
    expect(result.success).toBe(true);
  });

  it("should return error result on failure", () => {
    const result = safeParseIntentIR({ invalid: true });
    expect(result.success).toBe(false);
  });
});

describe("validateIntentIR", () => {
  it("should return valid result with data", () => {
    const result = validateIntentIR({
      v: "0.2",
      force: "VERIFY",
      event: { lemma: "CHECK", class: "OBSERVE" },
      args: {},
    });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.data.force).toBe("VERIFY");
    }
  });

  it("should return errors on failure", () => {
    const result = validateIntentIR({});
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });
});

describe("Term Schema", () => {
  it("should parse entity term", () => {
    const term = {
      kind: "entity",
      entityType: "User",
      ref: { kind: "this" },
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should parse entity term without ref (collection scope)", () => {
    const term = {
      kind: "entity",
      entityType: "User",
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should parse entity term with quant and orderBy", () => {
    const term = {
      kind: "entity",
      entityType: "Task",
      quant: { kind: "quantity", value: 3, comparator: "gte" },
      orderBy: { kind: "path", path: "createdAt" },
      orderDir: "DESC",
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should require id when ref.kind is id", () => {
    const term = {
      kind: "entity",
      entityType: "User",
      ref: { kind: "id" }, // missing id
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(false);
  });

  it("should parse value term", () => {
    const term = {
      kind: "value",
      valueType: "number",
      shape: { range: "1-100" },
      raw: 42,
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should parse expr term with string expr", () => {
    const term = {
      kind: "expr",
      exprType: "latex",
      expr: "x^2",
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should parse list term (unordered)", () => {
    const term = {
      kind: "list",
      items: [
        { kind: "value", valueType: "string", shape: { value: "design" } },
        { kind: "value", valueType: "string", shape: { value: "build" } },
      ],
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(true);
  });

  it("should reject nested list terms", () => {
    const term = {
      kind: "list",
      items: [
        { kind: "list", items: [] },
      ],
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(false);
  });

  it("should reject orderDir without orderBy", () => {
    const term = {
      kind: "entity",
      entityType: "Order",
      orderDir: "DESC",
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(false);
  });

  it("should reject orderBy with scoped prefixes", () => {
    const term = {
      kind: "entity",
      entityType: "Order",
      orderBy: { kind: "path", path: "state.order.createdAt" },
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(false);
  });

  it("should reject expr term with wrong expr type", () => {
    const term = {
      kind: "expr",
      exprType: "ast",
      expr: "not an object", // should be object
    };
    const result = TermSchema.safeParse(term);
    expect(result.success).toBe(false);
  });
});

describe("Pred Schema", () => {
  it("should parse valid predicate", () => {
    const pred = {
      lhs: "target.status",
      op: "=",
      rhs: {
        kind: "value",
        valueType: "enum",
        shape: { value: "active" },
      },
    };
    const result = PredSchema.safeParse(pred);
    expect(result.success).toBe(true);
  });

  it("should reject invalid lhs scope", () => {
    const pred = {
      lhs: "invalid.status", // invalid scope
      op: "=",
      rhs: { kind: "value", valueType: "string", shape: {} },
    };
    const result = PredSchema.safeParse(pred);
    expect(result.success).toBe(false);
  });

  it("should accept all valid lhs prefixes", () => {
    const prefixes = ["target", "theme", "source", "dest", "state", "env", "computed"];
    for (const prefix of prefixes) {
      const pred = {
        lhs: `${prefix}.field`,
        op: "=",
        rhs: { kind: "value", valueType: "string", shape: {} },
      };
      const result = PredSchema.safeParse(pred);
      expect(result.success).toBe(true);
    }
  });

  it("should require list rhs for 'in' operator", () => {
    const valid = {
      lhs: "target.status",
      op: "in",
      rhs: {
        kind: "list",
        items: [
          { kind: "value", valueType: "enum", shape: { value: "active" } },
          { kind: "value", valueType: "enum", shape: { value: "paused" } },
        ],
      },
    };
    const invalid = {
      lhs: "target.status",
      op: "in",
      rhs: { kind: "value", valueType: "enum", shape: { value: "active" } },
    };
    expect(PredSchema.safeParse(valid).success).toBe(true);
    expect(PredSchema.safeParse(invalid).success).toBe(false);
  });
});
