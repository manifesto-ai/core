/**
 * @manifesto-ai/core
 *
 * Manifesto Core - A Pure Semantic Calculator for Domain State
 *
 * Core computes. Host executes. These concerns never mix.
 */

// ============ Core API ============

import type { DomainSchema } from "./schema/domain.js";
import type { Snapshot } from "./schema/snapshot.js";
import type { Intent, Patch } from "./schema/patch.js";
import type { SemanticPath } from "./schema/common.js";
import type { ComputeResult, ValidationResult, ExplainResult } from "./schema/result.js";
import type { HostContext } from "./schema/host-context.js";

import { compute, computeSync } from "./core/compute.js";
import { apply } from "./core/apply.js";
import { validate } from "./core/validate.js";
import { explain } from "./core/explain.js";

/**
 * ManifestoCore interface
 */
export interface ManifestoCore {
  /**
   * Compute the result of dispatching an intent.
   *
   * This is the ONLY entry point for computation.
   * Each call is independent - there is no suspended context.
   */
  compute(
    schema: DomainSchema,
    snapshot: Snapshot,
    intent: Intent,
    context: HostContext
  ): Promise<ComputeResult>;

  /**
   * Compute the result of dispatching an intent (synchronous).
   */
  computeSync(
    schema: DomainSchema,
    snapshot: Snapshot,
    intent: Intent,
    context: HostContext
  ): ComputeResult;

  /**
   * Apply patches to a snapshot.
   * Returns new snapshot with recomputed values.
   */
  apply(
    schema: DomainSchema,
    snapshot: Snapshot,
    patches: readonly Patch[],
    context: HostContext
  ): Snapshot;

  /**
   * Validate a schema.
   */
  validate(schema: unknown): ValidationResult;

  /**
   * Explain why a value is what it is.
   */
  explain(
    schema: DomainSchema,
    snapshot: Snapshot,
    path: SemanticPath
  ): ExplainResult;
}

/**
 * Create a ManifestoCore instance
 */
export function createCore(): ManifestoCore {
  return {
    compute,
    computeSync,
    apply,
    validate,
    explain,
  };
}

// ============ Re-exports ============

// Schema types
export * from "./schema/index.js";

// Utilities
export * from "./utils/index.js";

// Evaluators (for advanced usage)
export * from "./evaluator/index.js";

// Errors
export * from "./errors.js";

// Factories
export * from "./factories.js";

// Core functions (for direct usage)
export { compute, computeSync, apply, validate, explain };
