/**
 * Job Types for Host v2.0.1
 *
 * Defines the Job union type for the mailbox-based execution model.
 *
 * @see host-SPEC-v2.0.1.md Appendix C: Job Type Reference
 */

import type { Intent, Patch } from "@manifesto-ai/core";

/**
 * Job types as defined in SPEC Appendix C
 */
export type JobType =
  | "StartIntent"
  | "ContinueCompute"
  | "FulfillEffect"
  | "ApplyPatches";

/**
 * Base interface for all jobs
 */
interface JobBase {
  /**
   * Unique job ID for tracing
   */
  readonly id: string;
}

/**
 * StartIntent job - initiates processing of a new intent.
 *
 * @see SPEC §10.2.2 Job Handler Await Ban
 */
export interface StartIntentJob extends JobBase {
  readonly type: "StartIntent";

  /**
   * The intent ID being processed
   */
  readonly intentId: string;

  /**
   * The intent to process
   */
  readonly intent: Intent;
}

/**
 * ContinueCompute job - re-invokes compute after effect completion.
 *
 * @see SPEC §10.7.1 FULFILL-3
 */
export interface ContinueComputeJob extends JobBase {
  readonly type: "ContinueCompute";

  /**
   * The intent ID being continued
   */
  readonly intentId: string;

  /**
   * The original intent for re-entry (optional, for type and input)
   */
  readonly intent?: Intent;

  /**
   * Iteration counter for tracing (optional)
   */
  readonly iteration?: number;
}

/**
 * FulfillEffect job - applies effect result and clears requirement.
 *
 * @see SPEC §10.7 FulfillEffect Job Contract
 */
export interface FulfillEffectJob extends JobBase {
  readonly type: "FulfillEffect";

  /**
   * The intent ID this effect belongs to
   */
  readonly intentId: string;

  /**
   * The original intent for re-entry (optional)
   */
  readonly intent?: Intent;

  /**
   * Core-generated requirement ID
   */
  readonly requirementId: string;

  /**
   * Concrete patches from effect execution (NOT expressions)
   */
  readonly resultPatches: Patch[];

  /**
   * Effect execution error (if any)
   */
  readonly effectError?: EffectErrorInfo;
}

/**
 * Effect execution error info
 */
export interface EffectErrorInfo {
  readonly code: string;
  readonly message: string;
}

/**
 * ApplyPatches job - applies patches directly without requirement clearing.
 *
 * Used for direct state mutations (rare), not for Core Requirements.
 *
 * @see SPEC Appendix C.3
 */
export interface ApplyPatchesJob extends JobBase {
  readonly type: "ApplyPatches";

  /**
   * Patches to apply
   */
  readonly patches: Patch[];

  /**
   * Source identifier for tracing/debugging
   */
  readonly source: string;
}

/**
 * Union type of all job types
 *
 * @see SPEC Appendix C.1 Reference Job Union
 */
export type Job =
  | StartIntentJob
  | ContinueComputeJob
  | FulfillEffectJob
  | ApplyPatchesJob;

/**
 * Generate a unique job ID
 */
export function generateJobId(type: JobType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a StartIntent job
 */
export function createStartIntentJob(intent: Intent): StartIntentJob {
  return {
    type: "StartIntent",
    id: generateJobId("StartIntent"),
    intentId: intent.intentId,
    intent,
  };
}

/**
 * Create a ContinueCompute job
 */
export function createContinueComputeJob(
  intentId: string,
  iteration?: number,
  intent?: Intent
): ContinueComputeJob {
  return {
    type: "ContinueCompute",
    id: generateJobId("ContinueCompute"),
    intentId,
    intent,
    iteration,
  };
}

/**
 * Create a FulfillEffect job
 */
export function createFulfillEffectJob(
  intentId: string,
  requirementId: string,
  resultPatches: Patch[],
  intent?: Intent,
  effectError?: EffectErrorInfo
): FulfillEffectJob {
  return {
    type: "FulfillEffect",
    id: generateJobId("FulfillEffect"),
    intentId,
    intent,
    requirementId,
    resultPatches,
    effectError,
  };
}

/**
 * Create an ApplyPatches job
 */
export function createApplyPatchesJob(
  patches: Patch[],
  source: string
): ApplyPatchesJob {
  return {
    type: "ApplyPatches",
    id: generateJobId("ApplyPatches"),
    patches,
    source,
  };
}
