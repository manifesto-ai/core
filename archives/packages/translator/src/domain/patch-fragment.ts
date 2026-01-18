/**
 * PatchFragment and PatchOp (SPEC-1.1.1v §6.6-6.7)
 *
 * PatchFragment represents schema-level semantic changes.
 * PatchOp defines the v1 operator set (strictly monotonic).
 */

import { z } from "zod";
import type { ExprNode } from "./expr-node.js";
import { ExprNodeSchema } from "./expr-node.js";
import type { TypeExpr } from "./type-expr.js";
import { TypeExprSchema } from "./type-expr.js";
import type { IntentId, JsonValue, SemanticPath } from "./types.js";
import { JsonValueSchema } from "./types.js";

// =============================================================================
// Action Types
// =============================================================================

/** Action parameter specification */
export interface ActionParamSpec {
  type: TypeExpr;
  optional: boolean;
  defaultValue?: JsonValue;
}

/** Guard types */
export interface ActionGuardWhen {
  guardKind: "when";
  condition: ExprNode;
}

export interface ActionGuardOnce {
  guardKind: "once";
  marker: SemanticPath;
}

export type ActionGuard = ActionGuardWhen | ActionGuardOnce;

/** Action statement (what can appear inside a guarded block) */
export interface ActionStmtPatch {
  kind: "patch";
  target: SemanticPath;
  value: ExprNode;
}

export interface ActionStmtEffect {
  kind: "effect";
  effectId: string;
  args: Record<string, ExprNode>;
}

export interface ActionStmtNested {
  kind: "nested";
  block: GuardedBlock;
}

export type ActionStmt = ActionStmtPatch | ActionStmtEffect | ActionStmtNested;

/** Guarded block: guard owns its statements */
export interface GuardedBlock {
  guard: ActionGuard;
  body: ActionStmt[];
}

/** Action body: sequence of guarded blocks */
export interface ActionBody {
  blocks: GuardedBlock[];
}

// =============================================================================
// PatchOp (v1 Operator Set - Monotonic)
// =============================================================================

/** Define a new type */
export interface PatchOpDefineType {
  kind: "defineType";
  typeName: string;
  definition: TypeExpr;
}

/** Add a field to state */
export interface PatchOpAddField {
  kind: "addField";
  path: SemanticPath;
  fieldType: TypeExpr;
  defaultValue?: JsonValue;
}

/** Add a constraint to a field */
export interface PatchOpAddConstraint {
  kind: "addConstraint";
  path: SemanticPath;
  constraintId: string;
  rule: ExprNode;
  message?: string;
}

/** Set default value for a field */
export interface PatchOpSetDefaultValue {
  kind: "setDefaultValue";
  path: SemanticPath;
  value: JsonValue;
}

/** Widen field type (monotonic type expansion) */
export interface PatchOpWidenFieldType {
  kind: "widenFieldType";
  path: SemanticPath;
  newType: TypeExpr;
}

/** Add a computed value */
export interface PatchOpAddComputed {
  kind: "addComputed";
  path: SemanticPath;
  expr: ExprNode;
  returnType?: TypeExpr;
}

/** Add a new action */
export interface PatchOpAddAction {
  kind: "addAction";
  actionName: string;
  params: Record<string, ActionParamSpec>;
  body: ActionBody;
}

/** Add a parameter to an existing action */
export interface PatchOpAddActionParam {
  kind: "addActionParam";
  actionName: string;
  paramName: string;
  param: ActionParamSpec;
}

/** Add availability condition to an action */
export interface PatchOpAddActionAvailable {
  kind: "addActionAvailable";
  actionName: string;
  expr: ExprNode;
}

/** Add a guard block to an action */
export interface PatchOpAddActionGuard {
  kind: "addActionGuard";
  actionName: string;
  block: GuardedBlock;
}

/**
 * PatchOp: v1 operator set (strictly monotonic)
 *
 * All operators are add-only. Destructive changes (remove, rename, narrow)
 * are NOT available in v1.
 */
export type PatchOp =
  | PatchOpDefineType
  | PatchOpAddField
  | PatchOpAddConstraint
  | PatchOpSetDefaultValue
  | PatchOpWidenFieldType
  | PatchOpAddComputed
  | PatchOpAddAction
  | PatchOpAddActionParam
  | PatchOpAddActionAvailable
  | PatchOpAddActionGuard;

// =============================================================================
// PatchFragment
// =============================================================================

/**
 * PatchFragment represents schema-level semantic changes
 *
 * Identity Rule: fragmentId = sha256(intentId + ':' + canonicalize(op))
 * where canonicalize() follows RFC 8785 (JCS).
 */
export interface PatchFragment {
  /** Content-addressed: sha256(intentId + ':' + canonicalize(op)) */
  fragmentId: string;
  /** Source intent that produced this fragment */
  sourceIntentId: IntentId;
  /** The semantic operation */
  op: PatchOp;
  /** Confidence score [0, 1] */
  confidence: number;
  /** Evidence strings supporting this fragment */
  evidence: string[];
  /** ISO 8601 timestamp (observational metadata) */
  createdAt: string;
}

// =============================================================================
// Zod Schemas
// =============================================================================

export const ActionParamSpecSchema = z.object({
  type: TypeExprSchema,
  optional: z.boolean(),
  defaultValue: JsonValueSchema.optional(),
});

export const ActionGuardSchema: z.ZodType<ActionGuard> = z.union([
  z.object({
    guardKind: z.literal("when"),
    condition: ExprNodeSchema,
  }),
  z.object({
    guardKind: z.literal("once"),
    marker: z.string(),
  }),
]);

export const ActionStmtSchema: z.ZodType<ActionStmt> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("patch"),
      target: z.string(),
      value: ExprNodeSchema,
    }),
    z.object({
      kind: z.literal("effect"),
      effectId: z.string(),
      args: z.record(ExprNodeSchema),
    }),
    z.object({
      kind: z.literal("nested"),
      block: GuardedBlockSchema,
    }),
  ])
);

export const GuardedBlockSchema: z.ZodType<GuardedBlock> = z.lazy(() =>
  z.object({
    guard: ActionGuardSchema,
    body: z.array(ActionStmtSchema),
  })
);

export const ActionBodySchema = z.object({
  blocks: z.array(GuardedBlockSchema),
});

export const PatchOpSchema: z.ZodType<PatchOp> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("defineType"),
    typeName: z.string(),
    definition: TypeExprSchema,
  }),
  z.object({
    kind: z.literal("addField"),
    path: z.string(),
    fieldType: TypeExprSchema,
    defaultValue: JsonValueSchema.optional(),
  }),
  z.object({
    kind: z.literal("addConstraint"),
    path: z.string(),
    constraintId: z.string(),
    rule: ExprNodeSchema,
    message: z.string().optional(),
  }),
  z.object({
    kind: z.literal("setDefaultValue"),
    path: z.string(),
    value: JsonValueSchema,
  }),
  z.object({
    kind: z.literal("widenFieldType"),
    path: z.string(),
    newType: TypeExprSchema,
  }),
  z.object({
    kind: z.literal("addComputed"),
    path: z.string(),
    expr: ExprNodeSchema,
    returnType: TypeExprSchema.optional(),
  }),
  z.object({
    kind: z.literal("addAction"),
    actionName: z.string(),
    params: z.record(ActionParamSpecSchema),
    body: ActionBodySchema,
  }),
  z.object({
    kind: z.literal("addActionParam"),
    actionName: z.string(),
    paramName: z.string(),
    param: ActionParamSpecSchema,
  }),
  z.object({
    kind: z.literal("addActionAvailable"),
    actionName: z.string(),
    expr: ExprNodeSchema,
  }),
  z.object({
    kind: z.literal("addActionGuard"),
    actionName: z.string(),
    block: GuardedBlockSchema,
  }),
]);

export const PatchFragmentSchema = z.object({
  fragmentId: z.string(),
  sourceIntentId: z.string(),
  op: PatchOpSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  createdAt: z.string(),
});
