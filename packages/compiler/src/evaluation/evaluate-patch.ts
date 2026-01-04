/**
 * Patch Evaluation
 *
 * Evaluates ConditionalPatchOp[] to produce concrete schema operations.
 *
 * @see SPEC v0.4.0 §18.5, §18.6
 */

import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
import type { ConditionalPatchOp, LoweredPatchOp } from "../lowering/lower-patch.js";
import type { EvaluationContext, EvaluationSnapshot } from "./context.js";
import { applyPatchToWorkingSnapshot } from "./context.js";
import { evaluateExpr } from "./evaluate-expr.js";

// ============ Evaluated Patch Types ============

/**
 * Evaluated schema patch operation.
 *
 * All conditions have been evaluated and values resolved where appropriate.
 * Expressions in addComputed, addConstraint, addActionAvailable are preserved
 * for runtime evaluation by Core.
 */
export type EvaluatedPatchOp = LoweredPatchOp;

/**
 * Result of evaluating a conditional patch.
 */
export interface EvaluatedPatch {
  /**
   * Fragment identifier (for tracing).
   */
  fragmentId: string;

  /**
   * The evaluated operation.
   */
  op: EvaluatedPatchOp;

  /**
   * Confidence (preserved from fragment).
   */
  confidence: number;

  /**
   * Whether condition was evaluated (true) or there was no condition.
   */
  conditionEvaluated: boolean;
}

/**
 * Result of patch evaluation.
 */
export interface PatchEvaluationResult {
  /**
   * Patches that passed their conditions.
   */
  patches: EvaluatedPatch[];

  /**
   * Patches that were skipped due to false/null conditions.
   */
  skipped: Array<{
    fragmentId: string;
    reason: "false" | "null" | "non-boolean";
  }>;

  /**
   * Final working snapshot after all evaluations.
   */
  finalSnapshot: EvaluationSnapshot;
}

// ============ Main Evaluation Function ============

/**
 * Evaluate conditional patch operations.
 *
 * Implements sequential evaluation semantics: later patches see effects
 * of earlier patches via working snapshot.
 *
 * Conditions are boolean-only: true applies, false/null/non-boolean skips.
 *
 * @param ops - Conditional patch operations from lowering phase
 * @param ctx - Initial evaluation context
 * @returns Evaluation result with applied and skipped patches
 *
 * @see SPEC v0.4.0 §18.5, FDR-MEL-070, FDR-MEL-073
 */
export function evaluateConditionalPatchOps(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): PatchEvaluationResult {
  const patches: EvaluatedPatch[] = [];
  const skipped: PatchEvaluationResult["skipped"] = [];
  let workingSnapshot = ctx.snapshot;

  for (const op of ops) {
    // Create context with current working snapshot
    const evalCtx: EvaluationContext = {
      ...ctx,
      snapshot: workingSnapshot,
    };

    // Evaluate condition if present
    if (op.condition !== undefined) {
      const conditionResult = evaluateExpr(op.condition, evalCtx);

      if (conditionResult !== true) {
        // Skip this patch
        const reason =
          conditionResult === false
            ? "false"
            : conditionResult === null
              ? "null"
              : "non-boolean";

        skipped.push({ fragmentId: op.fragmentId, reason });
        continue;
      }
    }

    // Evaluate the operation and add to result
    const evaluated: EvaluatedPatch = {
      fragmentId: op.fragmentId,
      op: op.op,
      confidence: op.confidence,
      conditionEvaluated: op.condition !== undefined,
    };

    patches.push(evaluated);

    // Update working snapshot for sequential semantics
    workingSnapshot = updateWorkingSnapshot(workingSnapshot, op.op, evalCtx);
  }

  return {
    patches,
    skipped,
    finalSnapshot: workingSnapshot,
  };
}

/**
 * Simple evaluation: returns patches that pass conditions.
 *
 * Does not track skipped patches or maintain sequential semantics.
 * Use this for stateless condition evaluation.
 *
 * @param ops - Conditional patch operations
 * @param ctx - Evaluation context
 * @returns Patches that passed their conditions
 */
export function evaluatePatches(
  ops: ConditionalPatchOp[],
  ctx: EvaluationContext
): EvaluatedPatch[] {
  return ops
    .filter((op) => {
      if (op.condition === undefined) {
        return true;
      }
      return evaluateExpr(op.condition, ctx) === true;
    })
    .map((op) => ({
      fragmentId: op.fragmentId,
      op: op.op,
      confidence: op.confidence,
      conditionEvaluated: op.condition !== undefined,
    }));
}

// ============ Working Snapshot Update ============

/**
 * Update working snapshot based on patch operation.
 *
 * For schema operations, most don't affect the snapshot directly.
 * Only setDefaultValue affects the data model.
 *
 * @see FDR-MEL-070
 */
function updateWorkingSnapshot(
  snapshot: EvaluationSnapshot,
  op: LoweredPatchOp,
  _ctx: EvaluationContext
): EvaluationSnapshot {
  // Most schema operations don't affect the working snapshot
  // They modify the schema, not the runtime state

  switch (op.kind) {
    case "setDefaultValue":
      // Apply default value to working snapshot data
      // This enables sequential evaluation where later ops can see the default
      return applyPatchToWorkingSnapshot(snapshot, op.path, op.value);

    case "addType":
    case "addField":
    case "setFieldType":
    case "addConstraint":
    case "addComputed":
    case "addActionAvailable":
      // These don't affect runtime data, only schema structure
      return snapshot;
  }
}

// ============ Expression Evaluation in Patch Values ============

/**
 * Evaluate expressions in a patch operation to concrete values.
 *
 * Use this when you need fully concrete values (no expressions).
 *
 * Note: addComputed.expr, addConstraint.rule, and addActionAvailable.expr
 * are meant to remain as expressions for runtime evaluation by Core.
 *
 * @param op - Lowered patch operation
 * @param ctx - Evaluation context
 * @returns Patch operation with evaluated expressions
 */
export function evaluatePatchExpressions(
  op: LoweredPatchOp,
  ctx: EvaluationContext
): LoweredPatchOp {
  switch (op.kind) {
    case "addType":
    case "addField":
    case "setFieldType":
    case "setDefaultValue":
      // These don't have runtime expressions to evaluate
      return op;

    case "addConstraint":
      // rule is evaluated at runtime, but we can evaluate for preview
      return {
        ...op,
        // Keep rule as expression - it's evaluated at runtime by Core
      };

    case "addComputed":
      // expr is evaluated at runtime, but we can evaluate for preview
      return {
        ...op,
        // Keep expr as expression - it's evaluated at runtime by Core
      };

    case "addActionAvailable":
      // expr is evaluated at runtime
      return {
        ...op,
        // Keep expr as expression - it's evaluated at runtime by Core
      };
  }
}

// ============ Condition Utilities ============

/**
 * Check if a condition evaluates to true.
 *
 * Boolean-only: only true returns true.
 * false, null, and non-boolean values return false.
 *
 * @param condition - Condition expression (or undefined for always-true)
 * @param ctx - Evaluation context
 * @returns True if condition passes
 *
 * @see FDR-MEL-073
 */
export function evaluateCondition(
  condition: CoreExprNode | undefined,
  ctx: EvaluationContext
): boolean {
  if (condition === undefined) {
    return true;
  }

  const result = evaluateExpr(condition, ctx);
  return result === true;
}

/**
 * Classify a condition evaluation result.
 *
 * @param condition - Condition expression
 * @param ctx - Evaluation context
 * @returns Classification of condition result
 */
export function classifyCondition(
  condition: CoreExprNode | undefined,
  ctx: EvaluationContext
): { passes: boolean; reason: "no-condition" | "true" | "false" | "null" | "non-boolean" } {
  if (condition === undefined) {
    return { passes: true, reason: "no-condition" };
  }

  const result = evaluateExpr(condition, ctx);

  if (result === true) {
    return { passes: true, reason: "true" };
  }

  if (result === false) {
    return { passes: false, reason: "false" };
  }

  if (result === null) {
    return { passes: false, reason: "null" };
  }

  return { passes: false, reason: "non-boolean" };
}
