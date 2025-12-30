/**
 * Intent Schema for World Protocol
 *
 * Defines IntentInstance and related types per Intent & Projection Specification v1.0.
 *
 * Intent Structure:
 * - IntentBody: Semantic content (type, input, scopeProposal)
 * - IntentMeta: Non-semantic metadata (origin)
 * - IntentInstance: Complete intent for World Protocol
 *
 * Key Principles:
 * - Intent is a Command (not an event)
 * - IntentBody is immutable once produced
 * - IntentInstance is immutable once issued
 * - intentKey is computed from body + schemaHash (deterministic)
 * - intentId is unique per processing attempt
 */
import { z } from "zod";
import { sha256, toCanonical } from "@manifesto-ai/core";
import { ActorRef } from "./actor.js";

// ============================================================================
// Intent Scope
// ============================================================================

/**
 * Intent scope - defines proposed/approved write boundaries
 *
 * Per spec:
 * - Scope proposal is a suggestion from Projection, not a guarantee
 * - Authority decides the approved scope
 * - Host may enforce or ignore per trust model (v1.0)
 */
export const IntentScope = z.object({
  /** Path patterns allowed to write (e.g., "data.profile.*") */
  allowedPaths: z.array(z.string()).optional(),

  /** Optional human description */
  note: z.string().optional(),
});
export type IntentScope = z.infer<typeof IntentScope>;

// ============================================================================
// Source Types
// ============================================================================

/**
 * Source kind - where the intent originated
 */
export const SourceKind = z.enum(["ui", "api", "agent", "system"]);
export type SourceKind = z.infer<typeof SourceKind>;

/**
 * Source reference - identifies the triggering event
 */
export const SourceRef = z.object({
  /** Kind of source */
  kind: SourceKind,

  /** Stable identifier for the source event */
  eventId: z.string(),
});
export type SourceRef = z.infer<typeof SourceRef>;

// ============================================================================
// Intent Origin
// ============================================================================

/**
 * Intent origin - where and how the intent was produced
 *
 * Rules:
 * - origin is metadata, NOT semantic content
 * - origin MUST NOT affect intentKey computation
 * - origin.note is for debugging only
 */
export const IntentOrigin = z.object({
  /** Which projection produced this intent */
  projectionId: z.string(),

  /** Source event reference */
  source: SourceRef,

  /** Who is responsible for this intent */
  actor: ActorRef,

  /** Optional human note (not semantic) */
  note: z.string().optional(),
});
export type IntentOrigin = z.infer<typeof IntentOrigin>;

// ============================================================================
// Intent Body
// ============================================================================

/**
 * Intent body - semantic content of the command
 *
 * This is what Projection produces.
 * intentKey is computed from this (+ schemaHash).
 */
export const IntentBody = z.object({
  /** Action type identifier (e.g., "todo.create") */
  type: z.string(),

  /** Action parameters */
  input: z.unknown().optional(),

  /** Proposed write scope (optional) */
  scopeProposal: IntentScope.optional(),
});
export type IntentBody = z.infer<typeof IntentBody>;

// ============================================================================
// Intent Meta
// ============================================================================

/**
 * Intent meta - non-semantic metadata
 *
 * Excluded from intentKey computation.
 */
export const IntentMeta = z.object({
  /** Origin information */
  origin: IntentOrigin,
});
export type IntentMeta = z.infer<typeof IntentMeta>;

// ============================================================================
// Intent Instance
// ============================================================================

/**
 * Intent instance - complete intent ready for World Protocol submission
 *
 * This is what World Protocol receives.
 *
 * Invariants:
 * - INV-I1: Every IntentInstance has immutable body, intentId, intentKey, and meta
 * - INV-I2: intentKey MUST be computed using the specified algorithm
 * - INV-I3: meta.origin MUST NOT affect intentKey
 * - INV-I4: Retry creates new intentId but preserves intentKey if body is identical
 * - INV-I5: intentId remains stable throughout a single Host execution loop
 */
export const IntentInstance = z.object({
  /** Semantic content of the intent */
  body: IntentBody,

  /** Unique identifier for this processing attempt */
  intentId: z.string(),

  /** Semantic identity (derived from body + schemaHash) */
  intentKey: z.string(),

  /** Non-semantic metadata */
  meta: IntentMeta,
});
export type IntentInstance = z.infer<typeof IntentInstance>;

// ============================================================================
// Intent Key Computation
// ============================================================================

/**
 * Compute intentKey from IntentBody and schemaHash
 *
 * Algorithm (per spec):
 * intentKey = SHA-256(
 *   schemaHash + ":" +
 *   body.type + ":" +
 *   JCS(body.input ?? null) + ":" +
 *   JCS(body.scopeProposal ?? null)
 * )
 *
 * Where JCS = JSON Canonicalization Scheme (we use toCanonical)
 */
export async function computeIntentKey(
  schemaHash: string,
  body: IntentBody
): Promise<string> {
  const parts = [
    schemaHash,
    body.type,
    toCanonical(body.input ?? null),
    toCanonical(body.scopeProposal ?? null),
  ];

  const input = parts.join(":");
  return sha256(input);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Options for creating an IntentInstance
 */
export interface CreateIntentInstanceOptions {
  /** Intent body */
  body: IntentBody;

  /** Schema hash for intentKey computation */
  schemaHash: string;

  /** Projection that produced this intent */
  projectionId: string;

  /** Source event */
  source: SourceRef;

  /** Actor responsible for this intent */
  actor: ActorRef;

  /** Optional note */
  note?: string;

  /** Optional custom intentId (default: generated) */
  intentId?: string;
}

/**
 * Create a new IntentInstance
 *
 * This function:
 * 1. Generates intentId if not provided
 * 2. Computes intentKey from body + schemaHash
 * 3. Assembles the complete IntentInstance
 */
export async function createIntentInstance(
  options: CreateIntentInstanceOptions
): Promise<IntentInstance> {
  const { body, schemaHash, projectionId, source, actor, note, intentId } = options;

  // Generate intentId if not provided
  const id = intentId ?? `intent-${crypto.randomUUID()}`;

  // Compute intentKey
  const key = await computeIntentKey(schemaHash, body);

  return {
    body,
    intentId: id,
    intentKey: key,
    meta: {
      origin: {
        projectionId,
        source,
        actor,
        note,
      },
    },
  };
}

/**
 * Create an IntentInstance synchronously (with pre-computed key)
 *
 * Use this when you already have the intentKey computed.
 */
export function createIntentInstanceSync(
  body: IntentBody,
  intentId: string,
  intentKey: string,
  origin: IntentOrigin
): IntentInstance {
  return {
    body,
    intentId,
    intentKey,
    meta: { origin },
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract type and input from IntentInstance for Host dispatch
 *
 * Host needs simple Intent format: { type, input, intentId }
 */
export function toHostIntent(instance: IntentInstance): {
  type: string;
  input: unknown;
  intentId: string;
} {
  return {
    type: instance.body.type,
    input: instance.body.input,
    intentId: instance.intentId,
  };
}

/**
 * Check if two IntentInstances are semantically equal (same intentKey)
 */
export function isSemanticallyEqual(a: IntentInstance, b: IntentInstance): boolean {
  return a.intentKey === b.intentKey;
}

/**
 * Check if two IntentInstances are the same processing attempt (same intentId)
 */
export function isSameAttempt(a: IntentInstance, b: IntentInstance): boolean {
  return a.intentId === b.intentId;
}
