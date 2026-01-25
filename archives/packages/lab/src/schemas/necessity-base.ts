/**
 * Base Necessity State Schema
 *
 * Defines the foundational schema for all necessity levels.
 * Per SPEC Section 5.1.
 */

import { z } from "zod";

/**
 * Level detection schema.
 * Computed values that determine the effective necessity level.
 */
export const LevelDetectionSchema = z.object({
  /** Observation level: 0 = full, 1 = partial */
  observation: z.union([z.literal(0), z.literal(1)]),
  /** Rules level: 0 = formal, 2 = open-ended */
  rules: z.union([z.literal(0), z.literal(2)]),
  /** Language level: 0 = none, 3 = natural language */
  language: z.union([z.literal(0), z.literal(3)]),
  /** Timestamp when detection occurred */
  detectedAt: z.number(),
});

/**
 * LLM trace entry schema.
 * Records LLM usage at each step for auditing.
 */
export const LLMTraceEntrySchema = z.object({
  /** Step number */
  step: z.number(),
  /** LLM role at this step */
  role: z.enum([
    "none",
    "fact_proposer",
    "belief_proposer",
    "rule_interpreter",
    "intent_parser",
  ]),
  /** Associated proposal ID if any */
  proposalId: z.string().optional(),
  /** Whether the output was verified */
  verified: z.boolean(),
  /** Verification method used */
  verificationMethod: z.enum([
    "deterministic",
    "posterior_consistency",
    "semantic_audit",
    "user_confirmation",
  ]),
});

/**
 * Base necessity state schema.
 * All level-specific schemas extend from this.
 */
export const NecessityBaseSchema = z.object({
  /** Declared necessity level */
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  /** Computed level detection */
  levelDetection: LevelDetectionSchema,
  /** LLM usage trace */
  llmTrace: z.array(LLMTraceEntrySchema).default([]),
});

/**
 * Compute effective level from detection.
 */
export function computeEffectiveLevel(
  detection: z.infer<typeof LevelDetectionSchema>
): 0 | 1 | 2 | 3 {
  return Math.max(
    detection.observation,
    detection.rules,
    detection.language
  ) as 0 | 1 | 2 | 3;
}

// Type exports
export type LevelDetection = z.infer<typeof LevelDetectionSchema>;
export type LLMTraceEntry = z.infer<typeof LLMTraceEntrySchema>;
export type NecessityBase = z.infer<typeof NecessityBaseSchema>;
