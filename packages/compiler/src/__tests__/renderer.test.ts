/**
 * MEL Renderer Tests
 */

import { describe, it, expect } from "vitest";
import {
  renderTypeExpr,
  renderTypeField,
  renderValue,
  renderExprNode,
  renderPatchOp,
  renderFragment,
  renderFragments,
  renderAsDomain,
  type TypeExpr,
  type TypeField,
  type ExprNode,
  type PatchOp,
  type PatchFragment,
} from "../renderer/index.js";

describe("renderTypeExpr", () => {
  it("should render primitive types", () => {
    expect(renderTypeExpr({ kind: "primitive", name: "string" })).toBe("string");
    expect(renderTypeExpr({ kind: "primitive", name: "number" })).toBe("number");
    expect(renderTypeExpr({ kind: "primitive", name: "boolean" })).toBe("boolean");
    expect(renderTypeExpr({ kind: "primitive", name: "null" })).toBe("null");
  });

  it("should render literal types", () => {
    expect(renderTypeExpr({ kind: "literal", value: "active" })).toBe('"active"');
    expect(renderTypeExpr({ kind: "literal", value: 42 })).toBe("42");
    expect(renderTypeExpr({ kind: "literal", value: true })).toBe("true");
    expect(renderTypeExpr({ kind: "literal", value: null })).toBe("null");
  });

  it("should render ref types", () => {
    expect(renderTypeExpr({ kind: "ref", name: "Todo" })).toBe("Todo");
    expect(renderTypeExpr({ kind: "ref", name: "User" })).toBe("User");
  });

  it("should render array types", () => {
    expect(renderTypeExpr({
      kind: "array",
      element: { kind: "primitive", name: "string" }
    })).toBe("Array<string>");

    expect(renderTypeExpr({
      kind: "array",
      element: { kind: "ref", name: "Todo" }
    })).toBe("Array<Todo>");
  });

  it("should render record types", () => {
    expect(renderTypeExpr({
      kind: "record",
      key: { kind: "primitive", name: "string" },
      value: { kind: "primitive", name: "number" }
    })).toBe("Record<string, number>");
  });

  it("should render union types", () => {
    expect(renderTypeExpr({
      kind: "union",
      members: [
        { kind: "literal", value: "idle" },
        { kind: "literal", value: "loading" },
        { kind: "literal", value: "done" }
      ]
    })).toBe('"idle" | "loading" | "done"');

    expect(renderTypeExpr({
      kind: "union",
      members: [
        { kind: "primitive", name: "string" },
        { kind: "primitive", name: "null" }
      ]
    })).toBe("string | null");
  });

  it("should render object types", () => {
    expect(renderTypeExpr({
      kind: "object",
      fields: [
        { name: "id", optional: false, type: { kind: "primitive", name: "string" } },
        { name: "title", optional: false, type: { kind: "primitive", name: "string" } },
        { name: "completed", optional: true, type: { kind: "primitive", name: "boolean" } }
      ]
    })).toBe("{ id: string, title: string, completed?: boolean }");
  });

  it("should render empty object type", () => {
    expect(renderTypeExpr({ kind: "object", fields: [] })).toBe("{}");
  });
});

describe("renderTypeField", () => {
  it("should render required field", () => {
    const field: TypeField = {
      name: "title",
      optional: false,
      type: { kind: "primitive", name: "string" }
    };
    expect(renderTypeField(field)).toBe("title: string");
  });

  it("should render optional field", () => {
    const field: TypeField = {
      name: "description",
      optional: true,
      type: { kind: "primitive", name: "string" }
    };
    expect(renderTypeField(field)).toBe("description?: string");
  });

  it("should render field with default value", () => {
    const field: TypeField = {
      name: "count",
      optional: false,
      type: { kind: "primitive", name: "number" }
    };
    expect(renderTypeField(field, 0)).toBe("count: number = 0");
  });

  it("should render field with string default", () => {
    const field: TypeField = {
      name: "status",
      optional: false,
      type: { kind: "literal", value: "idle" }
    };
    expect(renderTypeField(field, "idle")).toBe('status: "idle" = "idle"');
  });
});

describe("renderValue", () => {
  it("should render primitive values", () => {
    expect(renderValue(null)).toBe("null");
    expect(renderValue("hello")).toBe('"hello"');
    expect(renderValue(42)).toBe("42");
    expect(renderValue(true)).toBe("true");
    expect(renderValue(false)).toBe("false");
  });

  it("should render arrays", () => {
    expect(renderValue([1, 2, 3])).toBe("[1, 2, 3]");
    expect(renderValue(["a", "b"])).toBe('["a", "b"]');
  });

  it("should render objects", () => {
    expect(renderValue({ x: 1, y: 2 })).toBe("{ x: 1, y: 2 }");
  });

  it("should escape strings", () => {
    expect(renderValue('hello "world"')).toBe('"hello \\"world\\""');
    expect(renderValue("line1\nline2")).toBe('"line1\\nline2"');
  });
});

describe("renderExprNode", () => {
  it("should render literal expressions", () => {
    expect(renderExprNode({ kind: "lit", value: 5 })).toBe("5");
    expect(renderExprNode({ kind: "lit", value: "hello" })).toBe('"hello"');
    expect(renderExprNode({ kind: "lit", value: true })).toBe("true");
    expect(renderExprNode({ kind: "lit", value: null })).toBe("null");
  });

  it("should render get expressions", () => {
    expect(renderExprNode({ kind: "get", path: "count" })).toBe("count");
    expect(renderExprNode({ kind: "get", path: "data.user.name" })).toBe("user.name");
    expect(renderExprNode({ kind: "get", path: "$meta.intentId" })).toBe("$meta.intentId");
  });

  it("should render comparison expressions", () => {
    const left: ExprNode = { kind: "get", path: "count" };
    const right: ExprNode = { kind: "lit", value: 0 };

    expect(renderExprNode({ kind: "eq", left, right })).toBe("eq(count, 0)");
    expect(renderExprNode({ kind: "neq", left, right })).toBe("neq(count, 0)");
    expect(renderExprNode({ kind: "gt", left, right })).toBe("gt(count, 0)");
    expect(renderExprNode({ kind: "gte", left, right })).toBe("gte(count, 0)");
    expect(renderExprNode({ kind: "lt", left, right })).toBe("lt(count, 0)");
    expect(renderExprNode({ kind: "lte", left, right })).toBe("lte(count, 0)");
  });

  it("should render logical expressions", () => {
    const arg1: ExprNode = { kind: "get", path: "isValid" };
    const arg2: ExprNode = { kind: "get", path: "isReady" };

    expect(renderExprNode({ kind: "and", args: [arg1, arg2] })).toBe("and(isValid, isReady)");
    expect(renderExprNode({ kind: "or", args: [arg1, arg2] })).toBe("or(isValid, isReady)");
    expect(renderExprNode({ kind: "not", arg: arg1 })).toBe("not(isValid)");
  });

  it("should render arithmetic expressions", () => {
    const left: ExprNode = { kind: "get", path: "count" };
    const right: ExprNode = { kind: "lit", value: 1 };

    expect(renderExprNode({ kind: "add", left, right })).toBe("add(count, 1)");
    expect(renderExprNode({ kind: "sub", left, right })).toBe("sub(count, 1)");
    expect(renderExprNode({ kind: "mul", left, right })).toBe("mul(count, 1)");
    expect(renderExprNode({ kind: "div", left, right })).toBe("div(count, 1)");
    expect(renderExprNode({ kind: "mod", left, right })).toBe("mod(count, 1)");
  });

  it("should render string expressions", () => {
    const str: ExprNode = { kind: "get", path: "name" };

    expect(renderExprNode({
      kind: "concat",
      args: [{ kind: "lit", value: "Hello, " }, str]
    })).toBe('concat("Hello, ", name)');

    expect(renderExprNode({ kind: "trim", str })).toBe("trim(name)");
  });

  it("should render collection expressions", () => {
    const arr: ExprNode = { kind: "get", path: "items" };

    expect(renderExprNode({ kind: "len", arg: arr })).toBe("len(items)");
    expect(renderExprNode({ kind: "first", array: arr })).toBe("first(items)");
    expect(renderExprNode({ kind: "last", array: arr })).toBe("last(items)");
  });

  it("should render isNull expression", () => {
    expect(renderExprNode({
      kind: "isNull",
      arg: { kind: "get", path: "value" }
    })).toBe("isNull(value)");
  });

  it("should render nested expressions", () => {
    const expr: ExprNode = {
      kind: "and",
      args: [
        { kind: "gt", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 0 } },
        { kind: "not", arg: { kind: "get", path: "isLocked" } }
      ]
    };
    expect(renderExprNode(expr)).toBe("and(gt(count, 0), not(isLocked))");
  });
});

describe("renderPatchOp", () => {
  it("should render addType operation", () => {
    const op: PatchOp = {
      kind: "addType",
      typeName: "Todo",
      typeExpr: {
        kind: "object",
        fields: [
          { name: "id", optional: false, type: { kind: "primitive", name: "string" } },
          { name: "title", optional: false, type: { kind: "primitive", name: "string" } }
        ]
      }
    };
    const result = renderPatchOp(op);
    expect(result).toContain("type Todo {");
    expect(result).toContain("id: string");
    expect(result).toContain("title: string");
  });

  it("should render addField operation", () => {
    const op: PatchOp = {
      kind: "addField",
      typeName: "Todo",
      field: {
        name: "completed",
        optional: false,
        type: { kind: "primitive", name: "boolean" }
      }
    };
    expect(renderPatchOp(op)).toBe("completed: boolean");
  });

  it("should render addField with default value", () => {
    const op: PatchOp = {
      kind: "addField",
      typeName: "Todo",
      field: {
        name: "status",
        optional: false,
        type: { kind: "literal", value: "idle" },
        defaultValue: "idle"
      }
    };
    expect(renderPatchOp(op)).toBe('status: "idle" = "idle"');
  });

  it("should render setDefaultValue operation", () => {
    const op: PatchOp = {
      kind: "setDefaultValue",
      path: "Todo.count",
      value: 0
    };
    expect(renderPatchOp(op)).toBe("count = 0");
  });

  it("should render addComputed operation", () => {
    const op: PatchOp = {
      kind: "addComputed",
      name: "doubled",
      expr: {
        kind: "mul",
        left: { kind: "get", path: "count" },
        right: { kind: "lit", value: 2 }
      }
    };
    expect(renderPatchOp(op)).toBe("computed doubled = mul(count, 2)");
  });

  it("should render addConstraint operation", () => {
    const op: PatchOp = {
      kind: "addConstraint",
      targetPath: "User.age",
      rule: {
        kind: "gte",
        left: { kind: "get", path: "age" },
        right: { kind: "lit", value: 18 }
      },
      message: "Must be at least 18"
    };
    const result = renderPatchOp(op);
    expect(result).toContain("Constraint on User.age");
    expect(result).toContain("gte(age, 18)");
    expect(result).toContain("Must be at least 18");
  });

  it("should render addActionAvailable operation", () => {
    const op: PatchOp = {
      kind: "addActionAvailable",
      actionName: "submit",
      expr: {
        kind: "and",
        args: [
          { kind: "get", path: "isValid" },
          { kind: "not", arg: { kind: "get", path: "isSubmitting" } }
        ]
      }
    };
    const result = renderPatchOp(op);
    expect(result).toContain("action submit() available when and(isValid, not(isSubmitting))");
  });
});

describe("renderFragment", () => {
  const fragment: PatchFragment = {
    fragmentId: "frag-123",
    sourceIntentId: "intent-456",
    op: {
      kind: "addField",
      typeName: "Todo",
      field: {
        name: "priority",
        optional: false,
        type: { kind: "primitive", name: "number" }
      }
    },
    confidence: 0.95,
    evidence: ["User mentioned priority field"],
    createdAt: new Date().toISOString()
  };

  it("should render fragment with metadata", () => {
    const result = renderFragment(fragment);
    expect(result).toContain("Confidence: 95%");
    expect(result).toContain("priority: number");
  });

  it("should render fragment without metadata", () => {
    const result = renderFragment(fragment, { includeMetadata: false });
    expect(result).not.toContain("Confidence");
    expect(result).toBe("priority: number");
  });

  it("should include evidence when requested", () => {
    const result = renderFragment(fragment, { includeEvidence: true });
    expect(result).toContain("Evidence:");
    expect(result).toContain("User mentioned priority field");
  });
});

describe("renderFragments", () => {
  const fragments: PatchFragment[] = [
    {
      fragmentId: "frag-1",
      sourceIntentId: "intent-1",
      op: {
        kind: "addField",
        typeName: "Todo",
        field: { name: "title", optional: false, type: { kind: "primitive", name: "string" } }
      },
      confidence: 0.9,
      evidence: [],
      createdAt: new Date().toISOString()
    },
    {
      fragmentId: "frag-2",
      sourceIntentId: "intent-1",
      op: {
        kind: "addComputed",
        name: "count",
        expr: { kind: "len", arg: { kind: "get", path: "items" } }
      },
      confidence: 0.85,
      evidence: [],
      createdAt: new Date().toISOString()
    }
  ];

  it("should render multiple fragments", () => {
    const result = renderFragments(fragments, { includeMetadata: false });
    expect(result).toContain("title: string");
    expect(result).toContain("computed count = len(items)");
  });
});

describe("renderAsDomain", () => {
  const fragments: PatchFragment[] = [
    {
      fragmentId: "frag-1",
      sourceIntentId: "intent-1",
      op: {
        kind: "addField",
        typeName: "Counter",
        field: { name: "count", optional: false, type: { kind: "primitive", name: "number" }, defaultValue: 0 } as any
      },
      confidence: 0.95,
      evidence: [],
      createdAt: new Date().toISOString()
    },
    {
      fragmentId: "frag-2",
      sourceIntentId: "intent-1",
      op: {
        kind: "addComputed",
        name: "doubled",
        expr: { kind: "mul", left: { kind: "get", path: "count" }, right: { kind: "lit", value: 2 } }
      },
      confidence: 0.9,
      evidence: [],
      createdAt: new Date().toISOString()
    }
  ];

  it("should render fragments as a domain", () => {
    const result = renderAsDomain("Counter", fragments);
    expect(result).toContain("domain Counter {");
    expect(result).toContain("state {");
    expect(result).toContain("count: number = 0");
    expect(result).toContain("computed doubled = mul(count, 2)");
    expect(result).toContain("}");
  });
});
