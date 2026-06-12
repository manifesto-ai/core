/**
 * compileMelPatch Regression Tests
 *
 * Issue: Implement compileMelPatch() text parsing path.
 */

import { describe, it, expect } from "vitest";
import { compileMelPatch } from "../api/compile-mel.js";
import { patchPathToDisplayString, semanticPathToPatchPath, type Patch } from "@manifesto-ai/core";
import { createEvaluationContext } from "../evaluation/context.js";
import {
  evaluateRuntimePatches,
  evaluateRuntimePatchesWithTrace,
} from "../evaluation/evaluate-runtime-patch.js";
import type { RuntimeConditionalPatchOp } from "../lowering/lower-runtime-patch.js";

type LegacyPatch = {
  op: Patch["op"];
  path: string;
  value?: unknown;
};

const _pp = semanticPathToPatchPath;

function toLegacyPatches(ops: Patch[]): LegacyPatch[] {
  return ops.map((op) => {
    if (op.op === "set") {
      return { op: "set", path: patchPathToDisplayString(op.path), value: op.value };
    }
    if (op.op === "merge") {
      return { op: "merge", path: patchPathToDisplayString(op.path), value: op.value };
    }
    return { op: "unset", path: patchPathToDisplayString(op.path) };
  });
}

function renderRuntimePath(path: RuntimeConditionalPatchOp["path"]): string {
  const rendered: string[] = [];

  for (const segment of path) {
    if (segment.kind === "prop") {
      rendered.push(escapePathSegment(segment.name));
      continue;
    }

    if (segment.expr.kind === "lit" && typeof segment.expr.value === "string") {
      rendered.push(escapePathSegment(segment.expr.value));
      continue;
    }

    if (segment.expr.kind === "lit" && typeof segment.expr.value === "number") {
      rendered.push(String(segment.expr.value));
      continue;
    }

    rendered.push("[expr]");
  }

  return rendered.join(".");
}

function escapePathSegment(segment: string): string {
  return segment.replaceAll("\\", "\\\\").replaceAll(".", "\\.");
}

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
    expect(result.ops.map((op) => renderRuntimePath(op.path))).toEqual([
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
          state: {},
          computed: {},
        },
        input: { increment: 2 },
      }),
    );

    expect(toLegacyPatches(concretePatches)).toEqual([
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

  it("rejects when guards in patch text", () => {
    const melText = `
      when gt(input.increment, 0) {
        patch inGuard = input.increment
      }

      when false {
        patch never = 1
      }

    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-guards",
    });

    expect(result.errors).toHaveLength(2);
    expect(result.errors).toEqual([
      expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" }),
      expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" }),
    ]);
    expect(result.ops).toHaveLength(0);
  });

  it("rejects definitely nonprimitive equality in patch compiler expressions", () => {
    const melText = `
      patch sameObject = eq({ a: 1 }, { a: 1 })
      patch sameArray = eq([], [])
      patch sameKeys = eq(keys({ a: 1 }), [])
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-a15-invalid",
    });

    expect(result.errors.filter((error) => error.code === "E_TYPE_MISMATCH")).toHaveLength(3);
    expect(
      result.errors.every((error) => error.code !== "E_LOWER" && error.code !== "E_PARSE"),
    ).toBe(true);
  });

  it("allows primitive and unknown-surface equality in patch compiler expressions", () => {
    const melText = `
      patch sameNull = eq(null, marker)
      patch empty = eq(len(items), 0)
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-a15-valid",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops.length).toBeGreaterThan(0);
  });

  it("rejects when guards instead of emitting MEL namespace markers", () => {
    const melText = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "updated"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-when-block-reuse",
    });

    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
    expect(result.ops).toHaveLength(0);
  });

  it("rejects nested when guards in patch-only compilation", () => {
    const melText = `
      when eq(count, 0) {
        patch count = add(count, 1)
        patch flag = eq(count, 0)
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-when-entry-snapshot",
    });

    expect(result.errors).toEqual([expect.objectContaining({ code: "E_UNSUPPORTED_CONTROL" })]);
    expect(result.ops).toHaveLength(0);
  });

  it("rejects once guards in patch text", () => {
    const melText = `
      once(onceMarker) {
        patch onceValue = 1
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-once",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ code: "E_UNSUPPORTED_CONTROL" });
    expect(result.ops).toHaveLength(0);
  });

  it("rejects conditional once guards in patch text", () => {
    const melText = `
      once(onceMarker) when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "done"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-once-single-eval",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ code: "E_UNSUPPORTED_CONTROL" });
    expect(result.ops).toHaveLength(0);
  });

  it("rejects onceIntent guards in patch text", () => {
    const melText = `
      onceIntent when eq(count, 0) {
        patch count = add(count, 1)
        patch status = "done"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-onceIntent-single-eval",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ code: "E_UNSUPPORTED_CONTROL" });
    expect(result.ops).toHaveLength(0);
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
          state: {
            records: [{ title: "A", meta: { level: 3 } }],
          },
          computed: {},
        },
        input: {},
      }),
    );

    expect(toLegacyPatches(concretePatches)).toEqual([
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

  it("supports object spread in patch expressions and lowers through merge", () => {
    const melText = `
      patch draft = {
        ...draft,
        customerId: input.customerId,
        submissionState: "submitted"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-object-spread",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({
      op: "set",
      value: {
        kind: "merge",
        objects: [
          { kind: "get", path: "draft" },
          {
            kind: "object",
            fields: {
              customerId: { kind: "get", path: "input.customerId" },
              submissionState: { kind: "lit", value: "submitted" },
            },
          },
        ],
      },
    });

    const concretePatches = evaluateRuntimePatches(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-object-spread" },
        snapshot: {
          state: {
            draft: {
              customerId: "customer-1",
              appliedCouponId: "coupon-1",
              submissionState: "idle",
            },
          },
          computed: {},
        },
        input: { customerId: "customer-2" },
      }),
    );

    expect(toLegacyPatches(concretePatches)).toEqual([
      {
        op: "set",
        path: "draft",
        value: {
          customerId: "customer-2",
          appliedCouponId: "coupon-1",
          submissionState: "submitted",
        },
      },
    ]);
  });

  it("rejects definitely invalid object spread operands in patch expressions", () => {
    const melText = `
      patch draft = {
        ...1,
        submissionState: "submitted"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-object-spread-invalid",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("rejects empty-array object spread operands in patch expressions", () => {
    const melText = `
      patch draft = {
        ...[],
        submissionState: "submitted"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-empty-array-object-spread",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("rejects object spread operands that deterministically yield arrays in patch expressions", () => {
    const melText = `
      patch draft = {
        ...coalesce([], []),
        submissionState: "submitted"
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-array-valued-object-spread",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("rejects merge operands that deterministically yield arrays in patch expressions", () => {
    const melText = `
      patch draft = merge(cond(true, [], []))
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-array-valued-merge",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("rejects array-first coalesce object spread operands in patch expressions", () => {
    const melText = `
      patch draft = {
        ...coalesce([], { a: 1 })
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-array-first-coalesce-spread",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("rejects array-first coalesce merge operands in patch expressions", () => {
    const melText = `
      patch draft = merge(coalesce([], { a: 1 }))
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-array-first-coalesce-merge",
    });

    expect(result.ops).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E_TYPE_MISMATCH",
      message: "Object spread operands must be object-shaped or T | null where T is object-shaped",
    });
  });

  it("accepts object-first coalesce object spread operands with unreachable array fallbacks in patch expressions", () => {
    const melText = `
      patch draft = {
        ...coalesce(merge({ a: 1 }), [])
      }
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-object-first-coalesce-spread",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
  });

  it("accepts object-first coalesce merge operands with unreachable array fallbacks in patch expressions", () => {
    const melText = `
      patch draft = merge(coalesce(merge({ a: 1 }), []))
    `;

    const result = compileMelPatch(melText, {
      mode: "patch",
      actionName: "regression-compileMelPatch-object-first-coalesce-merge",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
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
          state: {},
          computed: {},
        },
        input: { amount: 7 },
      }),
    );

    expect(toLegacyPatches(concretePatches)).toEqual([
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
          state: {
            record: {
              "a.b": "outer",
              a: { b: "nested" },
            },
          },
          computed: {},
        },
        input: {},
      }),
    );

    expect(toLegacyPatches(concretePatches)).toEqual([
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
    expect(result.ops[0]).toMatchObject({
      op: "set",
      value: { kind: "lit", value: 1 },
    });
    expect(renderRuntimePath(result.ops[0].path)).toBe("data.history.files.file:///proof\\.lean");
  });

  it("preserves empty-string key segments in patch target paths", () => {
    const result = compileMelPatch(`patch data.history.files[""] = 1`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-empty-segment-target-path",
    });

    expect(result.errors).toHaveLength(0);
    expect(result.ops).toHaveLength(1);
    expect(result.ops[0]).toMatchObject({
      op: "set",
      value: { kind: "lit", value: 1 },
    });
    expect(renderRuntimePath(result.ops[0].path)).toBe("data.history.files.");
  });

  it("rejects unsupported statement types in patch text", () => {
    const melText = `
      effect api.fetch({ url: "/users", into: result })
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
    const result = compileMelPatch(`patch a = 1\n}\nwhen true { patch b = 2 }`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-wrapper-escape",
    });

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
        (error) => error.location.start.line >= 1 && error.location.start.line <= patchLines.length,
      ),
    ).toBe(true);
  });

  it("supports dynamic patch-path indexes and resolves them at evaluation time", () => {
    const result = compileMelPatch(`patch items[input.i] = 1`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-dynamic-path-index",
    });

    expect(result.errors).toHaveLength(0);

    const evaluation = evaluateRuntimePatchesWithTrace(
      result.ops,
      createEvaluationContext({
        meta: { intentId: "intent-dynamic-path-index" },
        snapshot: { state: { items: [] }, computed: {} },
        input: { i: 0 },
      }),
    );

    expect(toLegacyPatches(evaluation.patches)).toEqual([
      { op: "set", path: "items[0]", value: 1 },
    ]);
    expect(evaluation.warnings).toHaveLength(0);
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
    expect(result.errors[0].code).toBe("E003");
    expect(result.ops).toHaveLength(0);
  });

  it("rejects invalid $runtime paths during patch-only analysis", () => {
    const result = compileMelPatch(`patch requestId = $runtime.nope`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-invalid-runtime-path",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E003",
    });
    expect(result.errors[0].message).toContain("Invalid runtime value");
    expect(result.ops).toHaveLength(0);
  });

  it("derives deterministic runtime UUIDs during patch evaluation", () => {
    const result = compileMelPatch(
      `
      patch firstId = $runtime.random.uuid
      patch secondId = $runtime.random.uuid
    `,
      {
        mode: "patch",
        actionName: "regression-compileMelPatch-runtime-uuid",
      },
    );
    const context = {
      meta: { intentId: "intent-runtime-uuid" },
      snapshot: { state: {}, computed: {} },
      runtime: {
        intent: { id: "intent-runtime-uuid", action: "create" },
        random: { seed: "seed-runtime-uuid" },
      },
    };
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

    expect(result.errors).toHaveLength(0);

    const firstEvaluation = toLegacyPatches(
      evaluateRuntimePatches(result.ops, createEvaluationContext(context)),
    );
    const secondEvaluation = toLegacyPatches(
      evaluateRuntimePatches(result.ops, createEvaluationContext(context)),
    );

    expect(firstEvaluation).toEqual(secondEvaluation);
    expect(firstEvaluation[0]?.value).toMatch(uuidPattern);
    expect(firstEvaluation[1]?.value).toMatch(uuidPattern);
    expect(firstEvaluation[0]?.value).not.toBe(firstEvaluation[1]?.value);
  });

  it("resolves prototype-named state fields as own state, not inherited computed", () => {
    const ops = [
      {
        op: "set",
        path: [{ kind: "prop", name: "copied" }],
        value: { kind: "get", path: "toString" },
      },
    ] satisfies readonly RuntimeConditionalPatchOp[];
    const patches = evaluateRuntimePatches(
      ops,
      createEvaluationContext({
        meta: { intentId: "intent-prototype-field" },
        snapshot: {
          state: { toString: "domain-value" },
          computed: {},
        },
      }),
    );

    expect(toLegacyPatches(patches)).toEqual([
      { op: "set", path: "copied", value: "domain-value" },
    ]);
  });

  it("rejects $context paths without a domain context declaration in patch-only mode", () => {
    const result = compileMelPatch(`patch locale = $context.locale`, {
      mode: "patch",
      actionName: "regression-compileMelPatch-context-without-domain",
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      code: "E003",
      message: "Cannot use $context.* without a domain context declaration",
    });
    expect(result.ops).toHaveLength(0);
  });
});
