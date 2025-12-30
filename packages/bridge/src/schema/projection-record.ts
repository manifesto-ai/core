/**
 * Projection Record Schema
 *
 * Defines the record structure for audit and debugging.
 *
 * Per Intent & Projection Specification v1.0 (Section 12):
 * - Projection outputs SHOULD be recorded for debugging, replay, and audit
 * - Recording MUST NOT mutate semantic state
 */
import { z } from "zod";
import { ActorRef } from "@manifesto-ai/world";
import { SourceEvent } from "./source-event.js";
import { ProjectionResult } from "./projection.js";

// ============================================================================
// Projection Record
// ============================================================================

/**
 * Projection record - audit log entry
 *
 * Per SPEC section 12.2:
 * - recordId: Unique record identifier
 * - createdAt: Timestamp (non-deterministic OK for recording)
 * - projectionId: Which projection
 * - actor: Who acted
 * - source: What triggered
 * - snapshotVersion: Optional snapshot reference
 * - result: What was produced
 * - intentId: If issued
 * - intentKey: If issued
 */
export const ProjectionRecord = z.object({
  /** Unique record identifier */
  recordId: z.string(),

  /** Timestamp when recorded (non-deterministic OK) */
  createdAt: z.number(),

  /** Which projection produced this */
  projectionId: z.string(),

  /** Who acted */
  actor: ActorRef,

  /** What triggered */
  source: SourceEvent,

  /** Optional snapshot version reference */
  snapshotVersion: z.number().optional(),

  /** What was produced */
  result: ProjectionResult,

  /** Intent ID if issued */
  intentId: z.string().optional(),

  /** Intent key if issued */
  intentKey: z.string().optional(),
});
export type ProjectionRecord = z.infer<typeof ProjectionRecord>;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a projection record
 */
export function createProjectionRecord(
  projectionId: string,
  actor: ActorRef,
  source: SourceEvent,
  result: ProjectionResult,
  options?: {
    snapshotVersion?: number;
    intentId?: string;
    intentKey?: string;
  }
): ProjectionRecord {
  return {
    recordId: `record-${crypto.randomUUID()}`,
    createdAt: Date.now(),
    projectionId,
    actor,
    source,
    result,
    snapshotVersion: options?.snapshotVersion,
    intentId: options?.intentId,
    intentKey: options?.intentKey,
  };
}
