import { z } from "zod";
import { SemanticPath } from "./common.js";
import { Patch } from "./patch.js";
import { ErrorValue, Requirement, SystemState } from "./snapshot.js";
import { TraceGraph, TraceNode } from "./trace.js";

/**
 * ComputeStatus - Result of a compute() call
 */
export const ComputeStatus = z.enum([
  "complete", // Flow finished, no pending requirements
  "pending",  // Flow encountered effect, waiting for Host
  "halted",   // Flow explicitly halted
  "error",    // Flow encountered error
]);
export type ComputeStatus = z.infer<typeof ComputeStatus>;

/**
 * SystemDelta - Declarative system transition emitted by compute().
 */
export const SystemDelta = z.object({
  status: SystemState.shape.status.optional(),
  currentAction: z.string().nullable().optional(),
  lastError: ErrorValue.nullable().optional(),
  addRequirements: z.array(Requirement),
  removeRequirementIds: z.array(z.string()),
});
export type SystemDelta = z.infer<typeof SystemDelta>;

/**
 * NamespaceDelta - Declarative namespace transition.
 *
 * Patch paths are rooted at snapshot.namespaces[namespace].
 */
export const NamespaceDelta = z.object({
  namespace: z.string().min(1),
  patches: z.array(Patch),
});
export type NamespaceDelta = z.infer<typeof NamespaceDelta>;

/**
 * ComputeResult - Result of compute() call
 */
export const ComputeResult = z.object({
  /**
   * Domain patches rooted at snapshot.state
   */
  patches: z.array(Patch),

  /**
   * Namespace transitions rooted at snapshot.namespaces[namespace].
   */
  namespaceDelta: z.array(NamespaceDelta).optional(),

  /**
   * System transition to be applied separately
   */
  systemDelta: SystemDelta,

  /**
   * Computation trace
   */
  trace: TraceGraph,

  /**
   * Computation status
   */
  status: ComputeStatus,
});
export type ComputeResult = z.infer<typeof ComputeResult>;

/**
 * ValidationError - Single validation error
 */
export const ValidationError = z.object({
  /**
   * Error code (e.g., "V-001", "V-002")
   */
  code: z.string(),

  /**
   * Human-readable message
   */
  message: z.string(),

  /**
   * Path in the schema where error occurred
   */
  path: z.string().optional(),
});
export type ValidationError = z.infer<typeof ValidationError>;

/**
 * ValidationResult - Result of validate() call
 */
export const ValidationResult = z.object({
  /**
   * Whether the schema is valid
   */
  valid: z.boolean(),

  /**
   * List of validation errors (empty if valid)
   */
  errors: z.array(ValidationError),
});
export type ValidationResult = z.infer<typeof ValidationResult>;

/**
 * ExplainResult - Result of explain() call
 */
export const ExplainResult = z.object({
  /**
   * The value at the path
   */
  value: z.unknown(),

  /**
   * Trace showing how the value was computed
   */
  trace: TraceNode,

  /**
   * Dependencies that affect this value
   */
  deps: z.array(SemanticPath),
});
export type ExplainResult = z.infer<typeof ExplainResult>;

/**
 * Create a successful validation result
 */
export function validResult(): ValidationResult {
  return { valid: true, errors: [] };
}

/**
 * Create a failed validation result
 */
export function invalidResult(errors: ValidationError[]): ValidationResult {
  return { valid: false, errors };
}
