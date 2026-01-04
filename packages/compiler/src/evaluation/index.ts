/**
 * Evaluation Module
 *
 * Evaluates Core IR expressions and conditional patches.
 *
 * @see SPEC v0.4.0 §18
 */

// Context types
export type {
  EvaluationSnapshot,
  EvaluationMeta,
  EvaluationContext,
} from "./context.js";

export {
  createEvaluationContext,
  applyPatchToWorkingSnapshot,
} from "./context.js";

// Expression evaluation
export { evaluateExpr } from "./evaluate-expr.js";

// Patch evaluation
export type {
  EvaluatedPatchOp,
  EvaluatedPatch,
  PatchEvaluationResult,
} from "./evaluate-patch.js";

export {
  evaluateConditionalPatchOps,
  evaluatePatches,
  evaluatePatchExpressions,
  evaluateCondition,
  classifyCondition,
} from "./evaluate-patch.js";
