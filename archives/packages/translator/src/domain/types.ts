/**
 * Core Primitive Types (SPEC-1.1.1v §6.1)
 *
 * These are the foundational types used throughout the Translator.
 * Uses compatible type aliases for World/Core types.
 */

import { z } from "zod";

// =============================================================================
// Type Aliases from @manifesto-ai/world
// (Re-defined to avoid Zod 3/4 compatibility issues)
// =============================================================================

/** Actor kinds - the type of entity proposing changes */
export type ActorKind = "human" | "agent" | "system";

/** Actor Reference - identifies an actor in the system */
export interface ActorRef {
  actorId: string;
  kind: ActorKind;
  name?: string;
  meta?: Record<string, unknown>;
}

// =============================================================================
// Identifiers
// =============================================================================

/** Semantic path in schema (dot-separated identifiers) */
export type SemanticPath = string;

/** World identifier (content-addressed) */
export type WorldId = string;

/** Intent identifier (unique per translation) */
export type IntentId = string;

// =============================================================================
// JSON Value Types
// =============================================================================

/**
 * Primitive value for literals (NOT JsonValue)
 * Used in ExprNode.lit and TypeExpr.literal
 */
export type PrimitiveValue = null | boolean | number | string;

/**
 * JSON-serializable value for default values and metadata
 * Used in PatchOp.setDefaultValue, ActionParamSpec.defaultValue
 */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

// =============================================================================
// Zod Schemas for Validation
// =============================================================================

export const ActorKind = z.enum(["human", "agent", "system"]);

export const ActorRef = z.object({
  actorId: z.string(),
  kind: ActorKind,
  name: z.string().optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export const PrimitiveValueSchema = z.union([
  z.null(),
  z.boolean(),
  z.number(),
  z.string(),
]);

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
);

export const SemanticPathSchema = z.string().min(1);
export const WorldIdSchema = z.string().min(1);
export const IntentIdSchema = z.string().min(1);
