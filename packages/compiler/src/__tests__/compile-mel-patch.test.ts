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

  it("extracts patch ops from guarded blocks while keeping op.condition undefined", () => {
    const melText = `
      when gt(input.increment, 0) {
        patch inGuard = input.increment
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
    expect(result.ops).toHaveLength(2);
    expect(result.ops[0]).toMatchObject({ op: "set", path: "inGuard" });
    expect(result.ops[1]).toMatchObject({ op: "set", path: "onceValue" });
    expect(result.ops.every((op) => op.condition === undefined)).toBe(true);
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
    expect(result.warnings).toEqual([]);
    expect(result.ops).toHaveLength(0);
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
