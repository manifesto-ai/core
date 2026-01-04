/**
 * Patch Lowering
 *
 * Transforms PatchFragment[] (MEL IR) to ConditionalPatchOp[] (Core IR).
 *
 * @see SPEC v0.4.0 §17.4, §17.5
 */

import type { ExprNode as CoreExprNode } from "@manifesto-ai/core";
import type { PatchLoweringContext, ExprLoweringContext } from "./context.js";
import { lowerExprNode, MelExprNode } from "./lower-expr.js";

// ============ Input Types (from Translator) ============

/**
 * MEL TypeExpr (Translator output).
 */
export type MelTypeExpr =
  | { kind: "primitive"; name: "string" | "number" | "boolean" | "null" }
  | { kind: "array"; element: MelTypeExpr }
  | { kind: "object"; fields: MelTypeField[] }
  | { kind: "union"; members: MelTypeExpr[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };

/**
 * MEL TypeField.
 */
export type MelTypeField = {
  name: string;
  type: MelTypeExpr;
  optional?: boolean;
};

/**
 * MEL PatchOp (Translator output - schema operations).
 *
 * @see SPEC v0.4.0 §17.4
 */
export type MelPatchOp =
  | { kind: "addType"; typeName: string; typeExpr: MelTypeExpr }
  | {
      kind: "addField";
      typeName: string;
      field: MelTypeField & { defaultValue?: unknown };
    }
  | { kind: "setFieldType"; path: string; typeExpr: MelTypeExpr }
  | { kind: "setDefaultValue"; path: string; value: unknown }
  | {
      kind: "addConstraint";
      targetPath: string;
      rule: MelExprNode;
      message?: string;
    }
  | { kind: "addComputed"; name: string; expr: MelExprNode; deps?: string[] }
  | { kind: "addActionAvailable"; actionName: string; expr: MelExprNode };

/**
 * MEL PatchFragment (Translator output).
 *
 * Contains MEL IR expressions that need lowering.
 *
 * @see SPEC v0.4.0 §17.4
 */
export interface MelPatchFragment {
  /**
   * Unique fragment identifier (content-addressed).
   */
  fragmentId: string;

  /**
   * Source intent identifier.
   */
  sourceIntentId: string;

  /**
   * Fragment operation with MEL IR expressions.
   */
  op: MelPatchOp;

  /**
   * Optional condition (MEL IR).
   * Preserved in output as Core IR.
   */
  condition?: MelExprNode;

  /**
   * Confidence score (0-1).
   */
  confidence: number;

  /**
   * Evidence strings.
   */
  evidence: string[];

  /**
   * Creation timestamp (ISO 8601).
   */
  createdAt: string;
}

// ============ Output Types (for Host) ============

/**
 * Lowered TypeExpr (Core format).
 */
export type LoweredTypeExpr =
  | { kind: "primitive"; name: "string" | "number" | "boolean" | "null" }
  | { kind: "array"; element: LoweredTypeExpr }
  | { kind: "object"; fields: LoweredTypeField[] }
  | { kind: "union"; members: LoweredTypeExpr[] }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "ref"; name: string };

/**
 * Lowered TypeField.
 */
export type LoweredTypeField = {
  name: string;
  type: LoweredTypeExpr;
  optional?: boolean;
};

/**
 * Lowered PatchOp (Core IR expressions).
 *
 * Same structure as MelPatchOp but with Core IR expressions.
 */
export type LoweredPatchOp =
  | { kind: "addType"; typeName: string; typeExpr: LoweredTypeExpr }
  | {
      kind: "addField";
      typeName: string;
      field: LoweredTypeField & { defaultValue?: unknown };
    }
  | { kind: "setFieldType"; path: string; typeExpr: LoweredTypeExpr }
  | { kind: "setDefaultValue"; path: string; value: unknown }
  | {
      kind: "addConstraint";
      targetPath: string;
      rule: CoreExprNode;
      message?: string;
    }
  | { kind: "addComputed"; name: string; expr: CoreExprNode; deps?: string[] }
  | { kind: "addActionAvailable"; actionName: string; expr: CoreExprNode };

/**
 * Conditional patch operation (intermediate IR for Host).
 *
 * Preserves fragment condition for later evaluation.
 *
 * @see SPEC v0.4.0 §17.5
 */
export interface ConditionalPatchOp {
  /**
   * Fragment identifier (for tracing).
   */
  fragmentId: string;

  /**
   * Condition expression (Core IR).
   * If present, op is only applied when condition evaluates to true.
   *
   * @see FDR-MEL-073
   */
  condition?: CoreExprNode;

  /**
   * Lowered patch operation.
   */
  op: LoweredPatchOp;

  /**
   * Confidence (preserved from fragment).
   */
  confidence: number;
}

// ============ Lowering Functions ============

/**
 * Lower PatchFragment[] to ConditionalPatchOp[].
 *
 * Transforms MEL IR expressions to Core IR expressions.
 * Preserves fragment conditions for evaluation phase.
 *
 * @param fragments - MEL IR patch fragments from Translator
 * @param ctx - Patch lowering context
 * @returns Core IR conditional patch operations
 *
 * @see SPEC v0.4.0 §17.5
 */
export function lowerPatchFragments(
  fragments: MelPatchFragment[],
  ctx: PatchLoweringContext
): ConditionalPatchOp[] {
  return fragments.map((fragment) => lowerPatchFragment(fragment, ctx));
}

/**
 * Lower a single PatchFragment to ConditionalPatchOp.
 */
function lowerPatchFragment(
  fragment: MelPatchFragment,
  ctx: PatchLoweringContext
): ConditionalPatchOp {
  // Lower condition if present
  const condition = fragment.condition
    ? lowerExprNode(fragment.condition, createExprContext(ctx, "action"))
    : undefined;

  // Lower the operation
  const op = lowerPatchOp(fragment.op, ctx);

  return {
    fragmentId: fragment.fragmentId,
    condition,
    op,
    confidence: fragment.confidence,
  };
}

/**
 * Lower a MelPatchOp to LoweredPatchOp.
 *
 * Determines context per op-field per AD-COMP-LOW-002.
 */
function lowerPatchOp(op: MelPatchOp, ctx: PatchLoweringContext): LoweredPatchOp {
  switch (op.kind) {
    case "addType":
      return {
        kind: "addType",
        typeName: op.typeName,
        typeExpr: lowerTypeExpr(op.typeExpr),
      };

    case "addField":
      return {
        kind: "addField",
        typeName: op.typeName,
        field: {
          name: op.field.name,
          type: lowerTypeExpr(op.field.type),
          optional: op.field.optional,
          defaultValue: op.field.defaultValue,
        },
      };

    case "setFieldType":
      return {
        kind: "setFieldType",
        path: op.path,
        typeExpr: lowerTypeExpr(op.typeExpr),
      };

    case "setDefaultValue":
      return {
        kind: "setDefaultValue",
        path: op.path,
        value: op.value,
      };

    case "addConstraint":
      // addConstraint.rule → schema context (no $item)
      return {
        kind: "addConstraint",
        targetPath: op.targetPath,
        rule: lowerExprNode(op.rule, createExprContext(ctx, "schema")),
        message: op.message,
      };

    case "addComputed":
      // addComputed.expr → schema context (no $item)
      return {
        kind: "addComputed",
        name: op.name,
        expr: lowerExprNode(op.expr, createExprContext(ctx, "schema")),
        deps: op.deps,
      };

    case "addActionAvailable":
      // addActionAvailable.expr → schema context (no $item)
      return {
        kind: "addActionAvailable",
        actionName: op.actionName,
        expr: lowerExprNode(op.expr, createExprContext(ctx, "schema")),
      };
  }
}

/**
 * Lower TypeExpr (pass-through, no expressions inside).
 */
function lowerTypeExpr(typeExpr: MelTypeExpr): LoweredTypeExpr {
  switch (typeExpr.kind) {
    case "primitive":
      return { kind: "primitive", name: typeExpr.name };

    case "array":
      return { kind: "array", element: lowerTypeExpr(typeExpr.element) };

    case "object":
      return {
        kind: "object",
        fields: typeExpr.fields.map((f) => ({
          name: f.name,
          type: lowerTypeExpr(f.type),
          optional: f.optional,
        })),
      };

    case "union":
      return {
        kind: "union",
        members: typeExpr.members.map(lowerTypeExpr),
      };

    case "literal":
      return { kind: "literal", value: typeExpr.value };

    case "ref":
      return { kind: "ref", name: typeExpr.name };
  }
}

/**
 * Create expression lowering context from patch context.
 *
 * @see AD-COMP-LOW-002
 */
function createExprContext(
  patchCtx: PatchLoweringContext,
  mode: "schema" | "action"
): ExprLoweringContext {
  return {
    mode,
    allowSysPaths: patchCtx.allowSysPaths,
    fnTableVersion: patchCtx.fnTableVersion,
    actionName: patchCtx.actionName,
    allowItem: false, // Only true for effect.args (not in schema ops)
  };
}
