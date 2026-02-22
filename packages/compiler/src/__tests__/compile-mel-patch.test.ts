/**
 * compileMelPatch Regression Tests
 *
 * Issue: Implement compileMelPatch() text parsing path.
 */

import { describe, it, expect } from "vitest";
import { compileMelPatch } from "../api/index.js";
import { createEvaluationContext, evaluateRuntimePatches } from "../evaluation/index.js";

describe("compileMelPatch", () => {
  it("compiles patch text into runtime patch ops and lowers expressions", () => {
    const melText = `
      patch score = add(input.increment, 1)
      patch status = { ready: true }
      patch obsolete unset
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-valid",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(3);
    expect(result.ops.map((op) => op.path)).toEqual([
      "score",
      "status",
      "obsolete",
    ]);
    expect(result.ops.every((op) => op.condition === undefined)).toBe(true);

    const concretePatches = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-1" },
        snapshot: {
          data: {},
          computed: {},
        },
        input: { increment: 2 },
      })
    );

    expect(concretePatches).toEqual([
      {
        op: "set",
        path: "score",
        value: 3,
      },
      {
        op: "set",
        path: "status",
        value: { ready: true },
      },
      {
        op: "unset",
        path: "obsolete",
      },
    ]);
  });

  it("preserves guard conditions when collecting patch statements", () => {
    const melText = `
      when gt(input.increment, 0) {
        patch inGuard = input.increment
      }

      when false {
        patch never = 1
      }

      onceIntent {
        patch onceValue = 1
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-guards",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(3);
    expect(result.ops.every((op) => op.condition !== undefined)).toBe(true);

    const positiveMatch = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-2" },
        snapshot: {
          data: {},
          computed: {},
        },
        input: { increment: 2 },
      })
    );

    expect(positiveMatch).toEqual([
      {
        op: "set",
        path: "inGuard",
        value: 2,
      },
      {
        op: "set",
        path: "onceValue",
        value: 1,
      },
    ]);

    const zeroMatch = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-2" },
        snapshot: {
          data: {},
          computed: {},
        },
        input: { increment: 0 },
      })
    );

    expect(zeroMatch).toEqual([
      {
        op: "set",
        path: "onceValue",
        value: 1,
      },
    ]);
  });

  it("supports non-static property access in patch expressions", () => {
    const melText = `
      patch firstTitle = first(records).title
      patch nested = at(records, 0).meta.level
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-property-access",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(2);

    const concretePatches = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-3" },
        snapshot: {
          data: {
            records: [{ title: "A", meta: { level: 3 } }],
          },
          computed: {},
        },
        input: {},
      })
    );

    expect(concretePatches).toEqual([
      {
        op: "set",
        path: "firstTitle",
        value: "A",
      },
      {
        op: "set",
        path: "nested",
        value: 3,
      },
    ]);
  });

  it("supports unary minus in patch expressions", () => {
    const melText = `
      patch delta = -input.amount
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-unary-minus",
    });

    expect(result.errors).toHaveLength(0);

    const concretePatches = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-4" },
        snapshot: {
          data: {},
          computed: {},
        },
        input: { amount: 7 },
      })
    );

    expect(concretePatches).toEqual([
      {
        op: "set",
        path: "delta",
        value: -7,
      },
    ]);
  });

  it("keeps literal index access semantics for dotted expression keys", () => {
    const melText = `
      patch title = record["a.b"]
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-dotted-index-access",
    });

    expect(result.errors).toHaveLength(0);

    const concretePatches = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-5" },
        snapshot: {
          data: {
            record: {
              "a.b": "outer",
              a: { b: "nested" },
            },
          },
          computed: {},
        },
        input: {},
      })
    );

    expect(concretePatches).toEqual([
      {
        op: "set",
        path: "title",
        value: "outer",
      },
    ]);
  });

  it("preserves dotted key segments in patch target paths", () => {
    const result = compileMelPatch(`patch data.history.files["file:///proof.lean"] = 1`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-dotted-target-path",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toEqual({
      op: "set",
      path: "data.history.files.file:///proof\\.lean",
      value: { kind: "lit", value: 1 },
    });
  });

  it("rejects unsupported statement types in patch text", () => {
    const melText = `
      when true {
        effect api.fetch({ url: "/users", into: result })
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-unsupported",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("E_UNSUPPORTED_STMT");
    expect(result.ops).toHaveLength(0);
  });

  it("rejects syntax errors during parsing", () => {
    const melText = `patch missingEquals 1`;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-parse-error",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].location.start.line).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.ops).toHaveLength(0);
  });

  it("rejects malformed wrapper-escaping syntax instead of producing empty ops", () => {
    const result = compileMelPatch(`}`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-wrapper-integrity",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("E_PATCH_WRAPPER");
    expect(result.errors[0].location.start.line).toBe(1);
    expect(result.ops).toHaveLength(0);
  });

  it("rejects patch text that escapes synthetic wrapper and adds extra top-level statements", () => {
    const result = compileMelPatch(
      `patch a = 1\n}\nwhen true { patch b = 2 }`,
      {
        mode: "patch",
        actionName: "regression-compileMelPatch-wrapper-escape",
      }
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("E_PATCH_WRAPPER");
  });

  it("clamps parse diagnostics to patch text range when wrapper parsing fails", () => {
    const melText = `patch score = 1\n}\n}`;
    const patchLines = melText.split("\n");

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-wrapper-error",
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(
      result.errors.every(
        (error) =>
          error.location.start.line >= 1 && error.location.start.line <= patchLines.length
      )
    ).toBe(true);
  });

  it("rejects dynamic patch-path indexes", () => {
    const result = compileMelPatch(`patch items[input.i] = 1`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-dynamic-path-index",
    });

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("E_DYNAMIC_PATCH_PATH");
  });

  it("rejects forbidden $system paths by default", () => {
    const melText = `
      patch requestId = $system.uuid
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-system-path",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].code).toBe("INVALID_SYS_PATH");
    expect(result.ops).toHaveLength(0);
  });
});
