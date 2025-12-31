/**
 * Level 3: Natural Language Grounding (GroundingState)
 *
 * When intent grounding from natural language is required.
 * Per SPEC Section 5.4.
 */

import { z } from "zod";
import { Level2Schema } from "./level-2.js";

/**
 * Reference resolution schema.
 * Records how a reference in natural language was resolved.
 */
export const ReferenceResolutionSchema = z.object({
  /** The text span containing the reference */
  span: z.string(),
  /** What the reference was resolved to */
  resolvedTo: z.unknown(),
  /** Method used for resolution */
  method: z.enum(["context", "default", "user_confirmed", "inferred"]),
  /** Confidence in the resolution (0-1) */
  confidence: z.number().min(0).max(1),
});

/**
 * Ambiguity schema.
 * Records an ambiguous element and how it was handled.
 */
export const AmbiguitySchema = z.object({
  /** The ambiguous text span */
  span: z.string(),
  /** Possible interpretations */
  interpretations: z.array(z.unknown()),
  /** Chosen resolution (null if unresolved) */
  resolved: z.unknown().nullable(),
  /** How the resolution was determined */
  resolutionMethod: z.enum([
    "context",
    "default",
    "user_confirmed",
    "unresolved",
  ]),
});

/**
 * Confirmation status schema (discriminated union).
 * Tracks whether user confirmation is required.
 */
export const ConfirmationStatusSchema = z.discriminatedUnion("required", [
  z.object({
    required: z.literal(false),
  }),
  z.object({
    required: z.literal(true),
    /** Level of confirmation needed */
    level: z.enum(["passive", "active", "critical"]),
    /** Current status */
    status: z.enum(["pending", "confirmed", "rejected"]),
  }),
]);

/**
 * Grounding state schema.
 * Contains all information about natural language grounding.
 */
export const GroundingStateSchema = z.object({
  /** Original natural language input */
  originalUtterance: z.string(),
  /** Parsed intent structure */
  parsedIntent: z.unknown(),
  /** Reference resolutions performed */
  referenceResolutions: z.array(ReferenceResolutionSchema).default([]),
  /** Ambiguities encountered */
  ambiguities: z.array(AmbiguitySchema).default([]),
  /** Confirmation requirement */
  confirmation: ConfirmationStatusSchema,
});

/**
 * Level 3 schema.
 * Extends Level 2 with grounding state.
 * (Level 3 inherits Level 1 and Level 2 requirements per FDR-N007)
 */
export const Level3Schema = Level2Schema.extend({
  grounding: GroundingStateSchema.nullable().default(null),
});

// Type exports
export type ReferenceResolution = z.infer<typeof ReferenceResolutionSchema>;
export type Ambiguity = z.infer<typeof AmbiguitySchema>;
export type ConfirmationStatus = z.infer<typeof ConfirmationStatusSchema>;
export type GroundingState = z.infer<typeof GroundingStateSchema>;
export type Level3State = z.infer<typeof Level3Schema>;
