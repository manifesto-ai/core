/**
 * Runtime Patch Evaluation
 *
 * Evaluates RuntimeConditionalPatchOp[] to produce concrete Patch[].
 */

import type { MergePatch, Patch, PatchPath, PatchSegment, SetPatch, UnsetPatch } from "@manifesto-ai/core";
import { mergeAtPatchPath, patchPathToDisplayString, setByPatchPath, unsetByPatchPath } from "@manifesto-ai/core";
import type { IRPatchPath, RuntimeConditionalPatchOp } from "../lowering/lower-runtime-patch.js";
import type { EvaluationContext, EvaluationSnapshot } from "./context.js";
import { evaluateExpr } from "./evaluate-expr.js";

const UNSAFE_PROP_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

type GuardScope = {
  markerPath: PatchPath;
  snapshot: EvaluationSnapshot;
};

// ============ Result Types ============

/**
 * Skip reason for runtime patches.
 */
export type RuntimePatchSkipReason = "false" | "null" | "non-boolean" | "invalid-path";

/**
 * Skipped patch info.
 */
export interface SkippedRuntimePatch {
  /**
   * Index in the original ops array.
   */
  index: number;

  /**
   * Target path (display form).
   */
  path: string;

  /**
   * Reason why patch was skipped.
   */
  reason: RuntimePatchSkipReason;
}

/**
 * Result of runtime patch evaluation with trace information.
 */
export interface RuntimePatchEvaluationResult {
  /**
   * Concrete patches that passed conditions.
   * Order is preserved from input.
   */
  patches: Patch[];

  /**
   * Patches that were skipped due to false/null/non-boolean conditions.
   */
  skipped: SkippedRuntimePatch[];

  /**
   * Non-fatal warnings collected during evaluation.
   */
  warnings: string[];

  /**
   * Final working snapshot after all evaluations.
   */
  finalSnapshot: EvaluationSnapshot;
}

// ============ Main Evaluation Functions ============

/**
 * Evaluate runtime conditional patches to concrete Patch[].
 */
export function evaluateRuntimePatches(
  ops: RuntimeConditionalPatchOp[],
  ctx: EvaluationContext
): Patch[] {
  const result = evaluateRuntimePatchesWithTrace(ops, ctx);
  return result.patches;
}

/**
 * Evaluate runtime patches with trace information.
 */
export function evaluateRuntimePatchesWithTrace(
  ops: RuntimeConditionalPatchOp[],
  ctx: EvaluationContext
): RuntimePatchEvaluationResult {
  const patches: Patch[] = [];
  const skipped: SkippedRuntimePatch[] = [];
  const warnings: string[] = [];
  let workingSnapshot = ctx.snapshot;
  const guardScopeStack: GuardScope[] = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const isScopedSet = op.op === "set" && isScopedMarkerPath(op.path);
    const isInScope = guardScopeStack.length > 0;
    const activeSnapshot = isScopedSet || !isInScope
      ? workingSnapshot
      : guardScopeStack[guardScopeStack.length - 1].snapshot;

    const evalCtx: EvaluationContext = {
      ...ctx,
      snapshot: activeSnapshot,
    };

    if (op.condition !== undefined) {
      const conditionResult = evaluateExpr(op.condition, evalCtx);

      if (conditionResult !== true) {
        const reason: RuntimePatchSkipReason =
          conditionResult === false
            ? "false"
            : conditionResult === null
              ? "null"
              : "non-boolean";

        skipped.push({
          index: i,
          path: irPathToDisplayString(op.path),
          reason,
        });
        continue;
      }
    }

    const resolvedPath = resolveIRPath(op.path, evalCtx);
    if (!resolvedPath.ok) {
      skipped.push({
        index: i,
        path: irPathToDisplayString(op.path),
        reason: "invalid-path",
      });
      warnings.push(`Skipped runtime patch at index ${i}: ${resolvedPath.warning}`);
      continue;
    }

    const concretePath = resolvedPath.path;
    const concreteValue = op.value
      ? evaluateExpr(op.value, evalCtx)
      : undefined;

    const patch = buildConcretePatch(op.op, concretePath, concreteValue);
    if (patch === null) {
      continue;
    }

    if (
      op.op === "unset"
      && isScopedMarkerPath(op.path)
      && (!isInScope
        || !isPatchPathEqual(
          guardScopeStack[guardScopeStack.length - 1].markerPath,
          concretePath
        ))
    ) {
      continue;
    }

    patches.push(patch);
    workingSnapshot = applyConcretePatchToWorkingSnapshot(workingSnapshot, patch);

    if (op.op === "set" && isScopedMarkerPath(op.path)) {
      guardScopeStack.push({
        markerPath: concretePath,
        snapshot: workingSnapshot,
      });
      continue;
    }

    if (
      op.op === "unset"
      && isScopedMarkerPath(op.path)
      && guardScopeStack.length > 0
      && isPatchPathEqual(
        guardScopeStack[guardScopeStack.length - 1].markerPath,
        concretePath
      )
    ) {
      guardScopeStack.pop();
    }
  }

  return {
    patches,
    skipped,
    warnings,
    finalSnapshot: workingSnapshot,
  };
}

// ============ Helper Functions ============

function buildConcretePatch(
  op: "set" | "unset" | "merge",
  path: PatchPath,
  value: unknown
): Patch | null {
  switch (op) {
    case "set":
      return { op: "set", path, value } as SetPatch;

    case "unset":
      return { op: "unset", path } as UnsetPatch;

    case "merge":
      if (isRecord(value)) {
        return { op: "merge", path, value } as MergePatch;
      }
      return { op: "set", path, value: null } as SetPatch;
  }
}

function applyConcretePatchToWorkingSnapshot(
  snapshot: EvaluationSnapshot,
  patch: Patch
): EvaluationSnapshot {
  const baseData = snapshot.data;

  const nextData = (() => {
    switch (patch.op) {
      case "set":
        return setByPatchPath(baseData, patch.path, patch.value);
      case "unset":
        return unsetByPatchPath(baseData, patch.path);
      case "merge":
        return mergeAtPatchPath(baseData, patch.path, patch.value);
    }
  })();

  return {
    data: nextData,
    computed: snapshot.computed,
  };
}

function resolveIRPath(
  path: IRPatchPath,
  ctx: EvaluationContext
): { ok: true; path: PatchPath } | { ok: false; warning: string } {
  if (path.length === 0) {
    return { ok: false, warning: "path is empty" };
  }

  const resolved: PatchSegment[] = [];

  for (let i = 0; i < path.length; i++) {
    const segment = path[i];

    if (segment.kind === "prop") {
      if (!isValidPropSegment(segment.name)) {
        return { ok: false, warning: `invalid prop segment '${segment.name}'` };
      }
      resolved.push({ kind: "prop", name: segment.name });
      continue;
    }

    const value = evaluateExpr(segment.expr, ctx);
    const concrete = toConcreteSegment(value);
    if (concrete === null) {
      return {
        ok: false,
        warning: `expr segment at index ${i} resolved to invalid value`,
      };
    }
    resolved.push(concrete);
  }

  return { ok: true, path: resolved as PatchPath };
}

function toConcreteSegment(value: unknown): PatchSegment | null {
  if (
    typeof value === "number"
    && Number.isInteger(value)
    && Number.isFinite(value)
    && value >= 0
  ) {
    return { kind: "index", index: value };
  }

  if (typeof value === "string" && value.length > 0 && isValidPropSegment(value)) {
    return { kind: "prop", name: value };
  }

  return null;
}

function isValidPropSegment(name: string): boolean {
  return name.length > 0 && !UNSAFE_PROP_SEGMENTS.has(name);
}

function isScopedMarkerPath(path: IRPatchPath): boolean {
  return hasPropPrefix(path, ["$mel", "__whenGuards"])
    || hasPropPrefix(path, ["$mel", "__onceScopeGuards"]);
}

function hasPropPrefix(path: IRPatchPath, prefix: string[]): boolean {
  if (path.length < prefix.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    const segment = path[i];
    if (segment.kind !== "prop" || segment.name !== prefix[i]) {
      return false;
    }
  }

  return true;
}

function isPatchPathEqual(a: PatchPath, b: PatchPath): boolean {
  if (a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.kind !== right.kind) {
      return false;
    }
    if (left.kind === "prop" && right.kind === "prop" && left.name !== right.name) {
      return false;
    }
    if (left.kind === "index" && right.kind === "index" && left.index !== right.index) {
      return false;
    }
  }

  return true;
}

function irPathToDisplayString(path: IRPatchPath): string {
  const concretePrefix: PatchSegment[] = [];

  for (const segment of path) {
    if (segment.kind === "prop") {
      concretePrefix.push({ kind: "prop", name: segment.name });
      continue;
    }

    if (concretePrefix.length === 0) {
      return "[expr]";
    }
    return `${patchPathToDisplayString(concretePrefix as PatchPath)}.[expr]`;
  }

  if (concretePrefix.length === 0) {
    return "";
  }

  return patchPathToDisplayString(concretePrefix as PatchPath);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
