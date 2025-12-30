/**
 * @manifesto-ai/builder - DX layer for Manifesto
 *
 * Provides type-safe domain definition with Zod-first typing,
 * no string paths, and re-entry safe patterns.
 *
 * @packageDocumentation
 */

// ============ Domain Authoring ============

export { defineDomain, type DomainModule } from "./domain/define-domain.js";
export { setupDomain, validateDomain, type SetupDomainResult } from "./domain/setup-domain.js";
export { type DomainContext, type DomainOutput, type DomainOptions } from "./domain/domain-context.js";

// ============ DSL Surfaces ============

export { expr, type ExprBuilder } from "./expr/expr-builder.js";
export { type Expr, type ExprLike, isExpr } from "./expr/expr-node.js";

export { flow, type Flow, type FlowBuilder, type PatchOps, isFlow } from "./flow/flow-builder.js";
export { guard, onceNull, onceNotSet, type FlowStepContext } from "./flow/helpers.js";

// ============ Typed References ============

export { type FieldRef, createFieldRef, isFieldRef } from "./refs/field-ref.js";
export { type ComputedRef, createComputedRef, isComputedRef } from "./refs/computed-ref.js";
export { type ActionRef, type IntentBody, isActionRef } from "./refs/action-ref.js";
export { type FlowRef, createFlowRef, isFlowRef } from "./refs/flow-ref.js";

// ============ State Accessor ============

export { type StateAccessor, type RecordAccessor, type ArrayAccessor } from "./accessor/state-accessor.js";
export { buildAccessor } from "./accessor/accessor-builder.js";

// ============ Diagnostics ============

export {
  type DomainDiagnostics,
  type Diagnostic,
  type DiagnosticCode,
  type DiagnosticSeverity,
} from "./diagnostics/diagnostic-types.js";

// ============ Re-export Core Types ============

export type { DomainSchema, ExprNode, FlowNode, ActionSpec, StateSpec, FieldSpec } from "@manifesto-ai/core";
