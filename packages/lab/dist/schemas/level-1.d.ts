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
/**
 * Refuting condition schema.
 * Defines what observation would refute a hypothesis.
 */
export declare const RefutingConditionSchema: z.ZodObject<{
    observation: z.ZodString;
    reason: z.ZodString;
}, z.core.$strip>;
/**
 * Observation schema.
 * Records an observation made at a point in time.
 */
export declare const ObservationSchema: z.ZodObject<{
    id: z.ZodString;
    content: z.ZodUnknown;
    observedAt: z.ZodNumber;
}, z.core.$strip>;
/**
 * Hypothesis schema.
 * Represents a belief about hidden state.
 */
export declare const HypothesisSchema: z.ZodObject<{
    id: z.ZodString;
    hiddenState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    confidence: z.ZodNumber;
    supportingObservations: z.ZodArray<z.ZodString>;
    refutingConditions: z.ZodArray<z.ZodObject<{
        observation: z.ZodString;
        reason: z.ZodString;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Belief state schema.
 * Contains all hypotheses and observations.
 */
export declare const BeliefStateSchema: z.ZodObject<{
    hypotheses: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        hiddenState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        confidence: z.ZodNumber;
        supportingObservations: z.ZodArray<z.ZodString>;
        refutingConditions: z.ZodArray<z.ZodObject<{
            observation: z.ZodString;
            reason: z.ZodString;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    observations: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodUnknown;
        observedAt: z.ZodNumber;
    }, z.core.$strip>>>;
    beliefUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
/**
 * Level 1 schema.
 * Extends base with belief state.
 */
export declare const Level1Schema: z.ZodObject<{
    level: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<3>]>;
    levelDetection: z.ZodObject<{
        observation: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<1>]>;
        rules: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<2>]>;
        language: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<3>]>;
        detectedAt: z.ZodNumber;
    }, z.core.$strip>;
    llmTrace: z.ZodDefault<z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        role: z.ZodEnum<{
            none: "none";
            fact_proposer: "fact_proposer";
            belief_proposer: "belief_proposer";
            rule_interpreter: "rule_interpreter";
            intent_parser: "intent_parser";
        }>;
        proposalId: z.ZodOptional<z.ZodString>;
        verified: z.ZodBoolean;
        verificationMethod: z.ZodEnum<{
            deterministic: "deterministic";
            posterior_consistency: "posterior_consistency";
            semantic_audit: "semantic_audit";
            user_confirmation: "user_confirmation";
        }>;
    }, z.core.$strip>>>;
    belief: z.ZodObject<{
        hypotheses: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            hiddenState: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            confidence: z.ZodNumber;
            supportingObservations: z.ZodArray<z.ZodString>;
            refutingConditions: z.ZodArray<z.ZodObject<{
                observation: z.ZodString;
                reason: z.ZodString;
            }, z.core.$strip>>;
        }, z.core.$strip>>>;
        observations: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            content: z.ZodUnknown;
            observedAt: z.ZodNumber;
        }, z.core.$strip>>>;
        beliefUpdatedAt: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type RefutingCondition = z.infer<typeof RefutingConditionSchema>;
export type Observation = z.infer<typeof ObservationSchema>;
export type Hypothesis = z.infer<typeof HypothesisSchema>;
export type BeliefState = z.infer<typeof BeliefStateSchema>;
export type Level1State = z.infer<typeof Level1Schema>;
//# sourceMappingURL=level-1.d.ts.map