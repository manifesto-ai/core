import { z } from "zod";
import { SemanticPath } from "./common.js";
import { ExprNodeSchema, type ExprNode } from "./expr.js";

/**
 * FlowNode - Declarative state transition programs
 * Flows do NOT execute; they describe.
 * Flows do NOT return values; they modify Snapshot.
 * Flows are NOT Turing-complete; they always terminate.
 */

export type FlowNode =
  | SeqFlow
  | IfFlow
  | PatchFlow
  | EffectFlow
  | CallFlow
  | HaltFlow
  | FailFlow;

/**
 * Patch operations
 */
export const PatchOp = z.enum(["set", "unset", "merge"]);
export type PatchOp = z.infer<typeof PatchOp>;

// ============ Flow Node Types ============

/**
 * seq - Execute steps in order
 */
export const SeqFlow: z.ZodType<{ kind: "seq"; steps: FlowNode[] }> = z.object({
  kind: z.literal("seq"),
  steps: z.array(z.lazy(() => FlowNodeSchema)),
});
export type SeqFlow = z.infer<typeof SeqFlow>;

/**
 * if - Conditional execution
 */
export const IfFlow: z.ZodType<{ kind: "if"; cond: ExprNode; then: FlowNode; else?: FlowNode }> = z.object({
  kind: z.literal("if"),
  cond: ExprNodeSchema,
  then: z.lazy(() => FlowNodeSchema),
  else: z.lazy(() => FlowNodeSchema).optional(),
});
export type IfFlow = z.infer<typeof IfFlow>;

/**
 * patch - State mutation declaration
 */
export const PatchFlow = z.object({
  kind: z.literal("patch"),
  op: PatchOp,
  path: SemanticPath,
  value: ExprNodeSchema.optional(),
});
export type PatchFlow = z.infer<typeof PatchFlow>;

/**
 * effect - External operation requirement declaration
 * Effects are NOT executed by Core. They are declarations recorded in Snapshot.
 */
export const EffectFlow = z.object({
  kind: z.literal("effect"),
  type: z.string(),
  params: z.record(z.string(), ExprNodeSchema),
});
export type EffectFlow = z.infer<typeof EffectFlow>;

/**
 * call - Invoke another flow by name
 * Does NOT pass arguments or return values.
 * The called Flow reads from the same Snapshot.
 */
export const CallFlow = z.object({
  kind: z.literal("call"),
  flow: z.string(),
});
export type CallFlow = z.infer<typeof CallFlow>;

/**
 * halt - Stop flow execution normally (not an error)
 */
export const HaltFlow = z.object({
  kind: z.literal("halt"),
  reason: z.string().optional(),
});
export type HaltFlow = z.infer<typeof HaltFlow>;

/**
 * fail - Stop flow execution with an error
 * The error is recorded in Snapshot.
 */
export const FailFlow = z.object({
  kind: z.literal("fail"),
  code: z.string(),
  message: ExprNodeSchema.optional(),
});
export type FailFlow = z.infer<typeof FailFlow>;

// ============ Combined Schema ============

export const FlowNodeSchema: z.ZodType<FlowNode> = z.union([
  SeqFlow,
  IfFlow,
  PatchFlow,
  EffectFlow,
  CallFlow,
  HaltFlow,
  FailFlow,
]) as z.ZodType<FlowNode>;

/**
 * Flow node kinds enum
 */
export const FlowKind = z.enum(["seq", "if", "patch", "effect", "call", "halt", "fail"]);
export type FlowKind = z.infer<typeof FlowKind>;
