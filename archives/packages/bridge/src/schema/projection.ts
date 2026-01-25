/**
 * Projection Types
 *
 * Defines the Projection interface and related types.
 *
 * Per Intent & Projection Specification v1.0 (Section 7):
 * - Projection maps (SourceEvent, SnapshotView, Actor) to IntentBody (or none)
 * - Projection is a weak interpreter (selection, not domain logic)
 * - Projection MUST be deterministic
 * - Projection MUST NOT execute, patch, or apply
 */
import { z } from "zod";
import { IntentBody, ActorRef } from "@manifesto-ai/world";
import type { SnapshotView } from "./snapshot-view.js";
import type { SourceEvent } from "./source-event.js";
import { deepFreeze } from "../utils/snapshot-adapter.js";

// ============================================================================
// Projection Result
// ============================================================================

/**
 * Projection result - none (no intent)
 */
export const ProjectionResultNone = z.object({
  kind: z.literal("none"),
  reason: z.string().optional(),
});
export type ProjectionResultNone = z.infer<typeof ProjectionResultNone>;

/**
 * Projection result - intent
 */
export const ProjectionResultIntent = z.object({
  kind: z.literal("intent"),
  body: IntentBody,
});
export type ProjectionResultIntent = z.infer<typeof ProjectionResultIntent>;

/**
 * Projection result - either none or intent
 */
export const ProjectionResult = z.discriminatedUnion("kind", [
  ProjectionResultNone,
  ProjectionResultIntent,
]);
export type ProjectionResult = z.infer<typeof ProjectionResult>;

// ============================================================================
// Projection Request
// ============================================================================

/**
 * Projection request - input to projection
 *
 * Contains all the information needed for projection:
 * - schemaHash: For intentKey computation reference
 * - snapshot: Read-only view of semantic state
 * - actor: Who is acting
 * - source: What triggered this
 */
export interface ProjectionRequest {
  /** Schema hash for intentKey computation reference */
  readonly schemaHash: string;

  /** Read-only view of semantic state */
  readonly snapshot: SnapshotView;

  /** Who is acting */
  readonly actor: ActorRef;

  /** What triggered this */
  readonly source: SourceEvent;
}

// ============================================================================
// Projection Interface
// ============================================================================

/**
 * Projection interface
 *
 * A Projection maps (SourceEvent, SnapshotView, Actor) to IntentBody (or none).
 *
 * Invariants:
 * - INV-P1: Projection never patches, applies, or executes effects
 * - INV-P2: Projection is deterministic for IntentBody
 * - INV-P3: Projection reads SnapshotView (data + computed) read-only
 * - INV-P4: Projection is weak interpreter only (selection, not domain logic)
 * - INV-P5: Projection MUST NOT depend on non-deterministic inputs
 */
export interface Projection {
  /** Unique identifier for this projection */
  readonly projectionId: string;

  /**
   * Project a source event to an intent body (or none)
   *
   * @param req - Projection request containing snapshot, actor, source
   * @returns ProjectionResult - either { kind: 'none' } or { kind: 'intent', body }
   */
  project(req: ProjectionRequest): ProjectionResult;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a projection result with no intent
 */
export function noneResult(reason?: string): ProjectionResultNone {
  return reason ? { kind: "none", reason } : { kind: "none" };
}

/**
 * Create a projection result with an intent
 */
export function intentResult(body: IntentBody): ProjectionResultIntent {
  return deepFreeze({ kind: "intent", body });
}

/**
 * Create a simple projection that always returns the same intent
 */
export function createSimpleProjection(
  projectionId: string,
  handler: (req: ProjectionRequest) => ProjectionResult
): Projection {
  return {
    projectionId,
    project: handler,
  };
}
