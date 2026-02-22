/**
 * Runtime Patch Evaluation
 *
 * Evaluates RuntimeConditionalPatchOp[] to produce concrete Patch[].
 *
 * Implements:
 * - SPEC v0.4.0 §18.5: Sequential evaluation with working snapshot
 * - SPEC v0.4.0 §18.6: Boolean-only conditions
 * - SPEC v0.4.0 A35: Total function (returns null on error, never throws)
 *
 * @see SPEC v0.4.0 §20
 */

import type { Patch, SetPatch, UnsetPatch, MergePatch } from "@manifesto-ai/core";
import type { RuntimeConditionalPatchOp } from "../lowering/lower-runtime-patch.js";
import type { EvaluationContext, EvaluationSnapshot } from "./context.js";
import { applyPatchToWorkingSnapshot } from "./context.js";
import { evaluateExpr } from "./evaluate-expr.js";
import { parsePath } from "@manifesto-ai/core";

// ============ Result Types ============

/**
 * Skip reason for runtime patches.
 */
export type RuntimePatchSkipReason = "false" | "null" | "non-boolean";

/**
 * Skipped patch info.
 */
export interface SkippedRuntimePatch {
  /**
   * Index in the original ops array.
   */
  index: number;

  /**
   * Target path.
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
   * Final working snapshot after all evaluations.
   */
  finalSnapshot: EvaluationSnapshot;
}

// ============ Main Evaluation Functions ============

/**
 * Evaluate runtime conditional patches to concrete Patch[].
 *
 * This is the main API for Host integration. It transforms
 * RuntimeConditionalPatchOp[] (with Core IR expressions) to
 * concrete Patch[] (with evaluated values) that can be passed
 * directly to core.apply().
 *
 * Implements:
 * - §18.5: Sequential evaluation with working snapshot
 * - §18.6: Boolean-only conditions (non-boolean → skip)
 * - A35: Total function (expression errors → null value)
 *
 * @param ops - Runtime conditional patch operations
 * @param ctx - Evaluation context
 * @returns Concrete patches that passed conditions
 *
 * @see SPEC v0.4.0 §20.2
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
 *
 * Returns additional information about skipped patches and
 * final snapshot state.
 *
 * @param ops - Runtime conditional patch operations
 * @param ctx - Evaluation context
 * @returns Evaluation result with patches, skipped, and finalSnapshot
 */
export function evaluateRuntimePatchesWithTrace(
  ops: RuntimeConditionalPatchOp[],
  ctx: EvaluationContext
): RuntimePatchEvaluationResult {
  const patches: Patch[] = [];
  const skipped: SkippedRuntimePatch[] = [];
  let workingSnapshot = ctx.snapshot;

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];

    // Create context with current working snapshot
    const evalCtx: EvaluationContext = {
      ...ctx,
      snapshot: workingSnapshot,
    };

    // Evaluate condition if present (boolean-only per §18.6)
    if (op.condition !== undefined) {
      const conditionResult = evaluateExpr(op.condition, evalCtx);

      if (conditionResult !== true) {
        // Skip this patch
        const reason: RuntimePatchSkipReason =
          conditionResult === false
            ? "false"
            : conditionResult === null
              ? "null"
              : "non-boolean";

        skipped.push({ index: i, path: op.path, reason });
        continue;
      }
    }

    // Evaluate value expression to concrete value (A35: null on error)
    const concreteValue = op.value
      ? evaluateExpr(op.value, evalCtx)
      : undefined;

    // Build concrete patch
    const patch = buildConcretePatch(op.op, op.path, concreteValue);
    if (patch !== null) {
      patches.push(patch);

      // Update working snapshot for sequential semantics (§18.5)
      if (op.op !== "unset") {
        workingSnapshot = applyPatchToWorkingSnapshot(
          workingSnapshot,
          op.path,
          concreteValue
        );
      } else {
        // For unset, we need to remove the value
        workingSnapshot = applyUnsetToWorkingSnapshot(workingSnapshot, op.path);
      }
    }
  }

  return {
    patches,
    skipped,
    finalSnapshot: workingSnapshot,
  };
}

// ============ Helper Functions ============

/**
 * Build a concrete Patch from operation type, path, and value.
 *
 * @param op - Operation type
 * @param path - Target path
 * @param value - Evaluated value
 * @returns Concrete patch or null if invalid
 */
function buildConcretePatch(
  op: "set" | "unset" | "merge",
  path: string,
  value: unknown
): Patch | null {
  switch (op) {
    case "set":
      return { op: "set", path, value } as SetPatch;

    case "unset":
      return { op: "unset", path } as UnsetPatch;

    case "merge":
      // Merge requires an object value
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return { op: "merge", path, value: value as Record<string, unknown> } as MergePatch;
      }
      // Invalid merge value - fallback to set with null (A35: no throw)
      return { op: "set", path, value: null } as SetPatch;
  }
}

/**
 * Apply unset to working snapshot.
 *
 * Removes the value at path in the working snapshot.
 */
function applyUnsetToWorkingSnapshot(
  snapshot: EvaluationSnapshot,
  path: string
): EvaluationSnapshot {
  // Deep clone data
  const newData = structuredClone(snapshot.data) as Record<string, unknown>;

  // Remove value at path
  removeValueAtPath(newData, path);

  return {
    data: newData,
    computed: snapshot.computed,
  };
}

/**
 * Remove value at a dot-separated path.
 */
function removeValueAtPath(obj: Record<string, unknown>, path: string): void {
  const parts = parsePath(path);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== "object" || current[part] === null) {
      return; // Path doesn't exist, nothing to remove
    }
    current = current[part] as Record<string, unknown>;
  }

  const lastPart = parts[parts.length - 1];
  delete current[lastPart];
}
