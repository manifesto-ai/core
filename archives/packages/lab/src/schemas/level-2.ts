/**
 * Level 2: Open-Ended Rules (InterpretedRuleState)
 *
 * When goal interpretation is required due to open-ended rules.
 * Per SPEC Section 5.3.
 */

import { z } from "zod";
import { Level1Schema } from "./level-1.js";

/**
 * Assumption schema.
 * Represents an assumption made during rule interpretation.
 */
export const AssumptionSchema = z.object({
  /** Unique assumption identifier */
  id: z.string(),
  /** Human-readable description */
  description: z.string(),
  /** Impact level of this assumption */
  impact: z.enum(["critical", "moderate", "minor"]),
  /** Alternative interpretation if this assumption is wrong */
  alternative: z.string().nullable(),
});

/**
 * Validation status schema (discriminated union).
 * Tracks whether the interpretation has been validated.
 */
export const ValidationStatusSchema = z.discriminatedUnion("validated", [
  z.object({
    validated: z.literal(false),
    reason: z.literal("pending"),
  }),
  z.object({
    validated: z.literal(true),
    by: z.literal("human"),
    at: z.number(),
    validator: z.string(),
  }),
  z.object({
    validated: z.literal(true),
    by: z.literal("assumed"),
    at: z.number(),
    flagged: z.literal(true),
  }),
]);

/**
 * Interpreted rule schema.
 * Represents the LLM's interpretation of an open-ended goal.
 */
export const InterpretedRuleSchema = z.object({
  /** Original goal text */
  originalGoal: z.string(),
  /** Formalized goal structure */
  formalizedGoal: z.unknown(),
  /** Constraints inferred from the goal */
  inferredConstraints: z.array(z.unknown()).default([]),
  /** Assumptions made during interpretation */
  assumptions: z.array(AssumptionSchema).default([]),
  /** Confidence in interpretation */
  confidence: z.enum(["high", "medium", "low"]),
  /** Questions that could clarify the interpretation */
  clarifyingQuestions: z.array(z.string()).default([]),
  /** Validation status */
  validation: ValidationStatusSchema,
});

/**
 * Level 2 schema.
 * Extends Level 1 with interpreted rule state.
 * (Level 2 inherits Level 1 requirements per FDR-N007)
 */
export const Level2Schema = Level1Schema.extend({
  interpretedRule: InterpretedRuleSchema.nullable().default(null),
});

// Type exports
export type Assumption = z.infer<typeof AssumptionSchema>;
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;
export type InterpretedRule = z.infer<typeof InterpretedRuleSchema>;
export type Level2State = z.infer<typeof Level2Schema>;
