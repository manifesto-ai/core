/**
 * Level 1: Partial Observation (BeliefState)
 *
 * When there is hidden state that requires belief formation.
 * Per SPEC Section 5.2.
 *
 * Legality Conditions (L1-LC1 to L1-LC5):
 * - L1-LC1: Every hypothesis MUST reference supporting observations
 * - L1-LC2: No hypothesis may contradict observation history
 * - L1-LC3: Observable facts MUST NOT be overridden by belief
 * - L1-LC4: Sum of confidences ≤ 1 across mutually exclusive hypotheses
 * - L1-LC5: Every hypothesis MUST define refuting conditions
 */

import { z } from "zod";
import { NecessityBaseSchema } from "./necessity-base.js";

/**
 * Refuting condition schema.
 * Defines what observation would refute a hypothesis.
 */
export const RefutingConditionSchema = z.object({
  /** The observation that would refute */
  observation: z.string(),
  /** Reason why this observation refutes */
  reason: z.string(),
});

/**
 * Observation schema.
 * Records an observation made at a point in time.
 */
export const ObservationSchema = z.object({
  /** Unique observation identifier */
  id: z.string(),
  /** Observation content */
  content: z.unknown(),
  /** When the observation was made */
  observedAt: z.number(),
});

/**
 * Hypothesis schema.
 * Represents a belief about hidden state.
 */
export const HypothesisSchema = z.object({
  /** Unique hypothesis identifier */
  id: z.string(),
  /** The believed hidden state */
  hiddenState: z.record(z.string(), z.unknown()),
  /** Confidence in this hypothesis (0-1) */
  confidence: z.number().min(0).max(1),
  /** IDs of observations supporting this hypothesis (L1-LC1) */
  supportingObservations: z.array(z.string()),
  /** Conditions that would refute this hypothesis (L1-LC5) */
  refutingConditions: z.array(RefutingConditionSchema),
});

/**
 * Belief state schema.
 * Contains all hypotheses and observations.
 */
export const BeliefStateSchema = z.object({
  /** Current hypotheses about hidden state */
  hypotheses: z.array(HypothesisSchema).default([]),
  /** Observed facts */
  observations: z.array(ObservationSchema).default([]),
  /** When belief was last updated */
  beliefUpdatedAt: z.number().nullable().default(null),
});

/**
 * Level 1 schema.
 * Extends base with belief state.
 */
export const Level1Schema = NecessityBaseSchema.extend({
  belief: BeliefStateSchema,
});

// Type exports
export type RefutingCondition = z.infer<typeof RefutingConditionSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type BeliefState = z.infer<typeof BeliefStateSchema>;
export type Level1State = z.infer<typeof Level1Schema>;
