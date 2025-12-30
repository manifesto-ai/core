/**
 * Intent Issuer
 *
 * Creates IntentInstance from IntentBody (projection output).
 *
 * Per Intent & Projection Specification v1.0:
 * - IntentIssuer bridges Projection output to World Protocol input
 * - IntentInstance includes intentId, intentKey, body, and meta
 * - intentKey is computed from body + schemaHash
 */
import {
  type IntentInstance,
  type IntentBody,
  type ActorRef,
  type SourceRef,
  createIntentInstance,
} from "@manifesto-ai/world";
import type { SourceEvent } from "../schema/source-event.js";
import type { ProjectionResultIntent } from "../schema/projection.js";

// ============================================================================
// Issue Request
// ============================================================================

/**
 * Request to issue an IntentInstance
 */
export interface IssueRequest {
  /** Projection ID that produced the result */
  projectionId: string;

  /** Schema hash for intentKey computation */
  schemaHash: string;

  /** Actor responsible for the intent */
  actor: ActorRef;

  /** Source event that triggered the projection */
  source: SourceEvent;

  /** Intent body from projection result */
  body: IntentBody;

  /** Optional note for debugging */
  note?: string;
}

// ============================================================================
// Intent Issuer Interface
// ============================================================================

/**
 * Intent issuer interface
 *
 * Converts projection output (IntentBody) to World Protocol input (IntentInstance).
 */
export interface IntentIssuer {
  /**
   * Issue an IntentInstance from an IssueRequest
   *
   * @param req - Issue request containing body, actor, source, etc.
   * @returns IntentInstance ready for World Protocol submission
   */
  issue(req: IssueRequest): Promise<IntentInstance>;

  /**
   * Issue an IntentInstance from a ProjectionResultIntent
   *
   * Convenience method that extracts body from the result.
   *
   * @param result - Projection result with intent
   * @param projectionId - Which projection produced this
   * @param schemaHash - Schema hash for intentKey computation
   * @param actor - Who is acting
   * @param source - What triggered this
   * @param note - Optional note
   * @returns IntentInstance ready for World Protocol submission
   */
  issueFromResult(
    result: ProjectionResultIntent,
    projectionId: string,
    schemaHash: string,
    actor: ActorRef,
    source: SourceEvent,
    note?: string
  ): Promise<IntentInstance>;
}

// ============================================================================
// Default Implementation
// ============================================================================

/**
 * Default intent issuer implementation
 *
 * Uses createIntentInstance from World package to create IntentInstances.
 */
export class DefaultIntentIssuer implements IntentIssuer {
  /**
   * Issue an IntentInstance from an IssueRequest
   */
  async issue(req: IssueRequest): Promise<IntentInstance> {
    const { projectionId, schemaHash, actor, source, body, note } = req;

    // Convert SourceEvent to SourceRef (World's format)
    const sourceRef: SourceRef = {
      kind: source.kind,
      eventId: source.eventId,
    };

    // Create IntentInstance using World's factory
    return createIntentInstance({
      body,
      schemaHash,
      projectionId,
      source: sourceRef,
      actor,
      note,
    });
  }

  /**
   * Issue an IntentInstance from a ProjectionResultIntent
   */
  async issueFromResult(
    result: ProjectionResultIntent,
    projectionId: string,
    schemaHash: string,
    actor: ActorRef,
    source: SourceEvent,
    note?: string
  ): Promise<IntentInstance> {
    return this.issue({
      projectionId,
      schemaHash,
      actor,
      source,
      body: result.body,
      note,
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new intent issuer
 */
export function createIntentIssuer(): IntentIssuer {
  return new DefaultIntentIssuer();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert SourceEvent to SourceRef
 *
 * SourceRef is the World package's minimal source reference format.
 */
export function toSourceRef(source: SourceEvent): SourceRef {
  return {
    kind: source.kind,
    eventId: source.eventId,
  };
}
