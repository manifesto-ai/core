/**
 * Runtime Patch Lowering
 *
 * Transforms MEL runtime patches (set/unset/merge) to Core IR.
 *
 * @see SPEC v0.4.0 §17.5
 */

import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
import type { ExprLoweringContext } from "./context.js";
import type { MelExprNode } from "./lower-expr.js";
import { lowerExprNode } from "./lower-expr.js";

// ============ MEL Runtime Patch Types (Input) ============

/**
 * MEL runtime patch operation type.
 *
 * @see SPEC v0.4.0 §17.5
 */
export type MelRuntimePatchOp = "set" | "unset" | "merge";

/**
 * MEL runtime patch (Translator output for action patches).
 *
 * Contains MEL IR expressions that need lowering to Core IR.
 */
export interface MelRuntimePatch {
  /**
   * Optional condition (MEL IR).
   * If present, patch is only applied when condition evaluates to true.
   */
  condition?: MelExprNode;

  /**
   * Patch operation type.
   */
  op: MelRuntimePatchOp;

  /**
   * Target path in snapshot.
   * Uses Core path convention (no $ prefix for data paths).
   */
  path: string;

  /**
   * Value expression (MEL IR) for set/merge operations.
   * Required for "set" and "merge", forbidden for "unset".
   */
  value?: MelExprNode;
}

// ============ Core Runtime Patch Types (Output) ============

/**
 * Runtime ConditionalPatchOp for snapshot state mutations.
 *
 * This is the intermediate representation between Translator output
 * and final concrete Patch[]. Host must call evaluateRuntimePatches()
 * to get concrete values.
 *
 * @see SPEC v0.4.0 §17.5, §20
 */
export interface RuntimeConditionalPatchOp {
  /**
   * Optional condition expression (Core IR).
   * If present, patch is only applied when condition evaluates to true.
   *
   * @see SPEC v0.4.0 §18.6 (boolean-only conditions)
   */
  condition?: CoreExprNode;

  /**
   * Patch operation type.
   */
  op: "set" | "unset" | "merge";

  /**
   * Target path in snapshot.
   *
   * @see SPEC v0.4.0 §18.7 for path resolution rules
   */
  path: string;

  /**
   * Value expression (Core IR) for set/merge operations.
   * Required for "set" and "merge", undefined for "unset".
   */
  value?: CoreExprNode;
}

// ============ Lowering Function ============

/**
 * Lower MEL runtime patches to Core IR.
 *
 * Transforms MEL IR expressions to Core IR expressions.
 * The returned patches still contain expressions that need to be
 * evaluated by evaluateRuntimePatches() to get concrete values.
 *
 * @param patches - MEL IR runtime patches from Translator
 * @param ctx - Expression lowering context
 * @returns Core IR runtime conditional patches
 *
 * @see SPEC v0.4.0 §17.5
 */
export function lowerRuntimePatches(
  patches: MelRuntimePatch[],
  ctx: ExprLoweringContext
): RuntimeConditionalPatchOp[] {
  return patches.map((patch) => lowerRuntimePatch(patch, ctx));
}

/**
 * Lower a single MEL runtime patch to Core IR.
 */
function lowerRuntimePatch(
  patch: MelRuntimePatch,
  ctx: ExprLoweringContext
): RuntimeConditionalPatchOp {
  // Lower condition if present
  const condition = patch.condition
    ? lowerExprNode(patch.condition, ctx)
    : undefined;

  // Lower value if present (required for set/merge, forbidden for unset)
  const value = patch.value ? lowerExprNode(patch.value, ctx) : undefined;

  return {
    condition,
    op: patch.op,
    path: patch.path,
    value,
  };
}

/**
 * Lower a single MEL runtime patch to Core IR.
 *
 * Exported for cases where individual patch lowering is needed.
 */
export { lowerRuntimePatch };
