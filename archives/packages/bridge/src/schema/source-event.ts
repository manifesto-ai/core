/**
 * Source Event Schema
 *
 * Defines the raw external trigger that Projection receives.
 *
 * Per Intent & Projection Specification v1.0 (Section 3.2):
 * - SourceEvent is the raw external trigger that Projection receives
 * - occurredAt is OPTIONAL and MUST NOT affect semantic projection
 */
import { z } from "zod";

// ============================================================================
// Source Kind
// ============================================================================

/**
 * Source kind - where the event originated
 *
 * Note: This is different from SourceKind in @manifesto-ai/world which is
 * used for IntentOrigin.source. This is for the raw SourceEvent.
 */
export const SourceKind = z.enum(["ui", "api", "agent", "system"]);
export type SourceKind = z.infer<typeof SourceKind>;

// ============================================================================
// Source Event
// ============================================================================

/**
 * Source event - the raw external trigger
 *
 * Rules:
 * - eventId should be stable identifier if available
 * - payload contains raw input from source
 * - occurredAt is OPTIONAL and MUST NOT affect projection
 */
export const SourceEvent = z.object({
  /** Kind of source (ui, api, agent, system) */
  kind: SourceKind,

  /** Stable identifier for the event */
  eventId: z.string(),

  /** Raw input from source */
  payload: z.unknown(),

  /** Optional timestamp - MUST NOT affect semantic projection */
  occurredAt: z.number().optional(),
});
export type SourceEvent = z.infer<typeof SourceEvent>;

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a SourceEvent
 */
export function createSourceEvent(
  kind: SourceKind,
  eventId: string,
  payload: unknown,
  occurredAt?: number
): SourceEvent {
  return {
    kind,
    eventId,
    payload,
    occurredAt,
  };
}

/**
 * Create a UI source event
 */
export function createUISourceEvent(
  eventId: string,
  payload: unknown
): SourceEvent {
  return createSourceEvent("ui", eventId, payload);
}

/**
 * Create an API source event
 */
export function createAPISourceEvent(
  eventId: string,
  payload: unknown
): SourceEvent {
  return createSourceEvent("api", eventId, payload);
}

/**
 * Create an agent source event
 */
export function createAgentSourceEvent(
  eventId: string,
  payload: unknown
): SourceEvent {
  return createSourceEvent("agent", eventId, payload);
}

/**
 * Create a system source event
 */
export function createSystemSourceEvent(
  eventId: string,
  payload: unknown
): SourceEvent {
  return createSourceEvent("system", eventId, payload);
}
