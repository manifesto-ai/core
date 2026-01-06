/**
 * Lowering Module
 *
 * Transforms MEL IR to Core IR.
 *
 * @see SPEC v0.4.0 §17
 */

// Context types
export type {
  AllowedSysPrefix,
  ExprLoweringContext,
  PatchLoweringContext,
} from "./context.js";

export {
  DEFAULT_SCHEMA_CONTEXT,
  DEFAULT_ACTION_CONTEXT,
  EFFECT_ARGS_CONTEXT,
  DEFAULT_PATCH_CONTEXT,
} from "./context.js";

// Error types
export type { LoweringErrorCode } from "./errors.js";

export {
  LoweringError,
  invalidKindForContext,
  unknownCallFn,
  invalidSysPath,
  unsupportedBase,
  invalidShape,
  unknownNodeKind,
} from "./errors.js";

// Expression lowering
export type {
  MelPrimitive,
  MelPathSegment,
  MelPathNode,
  MelSystemPath,
  MelObjField,
  MelExprNode,
} from "./lower-expr.js";

export { lowerExprNode } from "./lower-expr.js";

// Schema patch lowering
export type {
  MelTypeExpr,
  MelTypeField,
  MelPatchOp,
  MelPatchFragment,
  LoweredTypeExpr,
  LoweredTypeField,
  LoweredPatchOp,
  SchemaConditionalPatchOp,
  /** @deprecated Use SchemaConditionalPatchOp */
  ConditionalPatchOp,
} from "./lower-patch.js";

export { lowerPatchFragments } from "./lower-patch.js";

// Runtime patch lowering
export type {
  MelRuntimePatchOp,
  MelRuntimePatch,
  RuntimeConditionalPatchOp,
} from "./lower-runtime-patch.js";

export { lowerRuntimePatches, lowerRuntimePatch } from "./lower-runtime-patch.js";
