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
export declare const LevelDetectionSchema: z.ZodObject<{
    observation: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<1>]>;
    rules: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<2>]>;
    language: z.ZodUnion<readonly [z.ZodLiteral<0>, z.ZodLiteral<3>]>;
    detectedAt: z.ZodNumber;
}, z.core.$strip>;
/**
 * LLM trace entry schema.
 * Records LLM usage at each step for auditing.
 */
export declare const LLMTraceEntrySchema: z.ZodObject<{
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
}, z.core.$strip>;
/**
 * Base necessity state schema.
 * All level-specific schemas extend from this.
 */
export declare const NecessityBaseSchema: z.ZodObject<{
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
}, z.core.$strip>;
/**
 * Compute effective level from detection.
 */
export declare function computeEffectiveLevel(detection: z.infer<typeof LevelDetectionSchema>): 0 | 1 | 2 | 3;
export type LevelDetection = z.infer<typeof LevelDetectionSchema>;
export type LLMTraceEntry = z.infer<typeof LLMTraceEntrySchema>;
export type NecessityBase = z.infer<typeof NecessityBaseSchema>;
//# sourceMappingURL=necessity-base.d.ts.map