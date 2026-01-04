/**
 * Level 2: Open-Ended Rules (InterpretedRuleState)
 *
 * When goal interpretation is required due to open-ended rules.
 * Per SPEC Section 5.3.
 */
import { z } from "zod";
/**
 * Assumption schema.
 * Represents an assumption made during rule interpretation.
 */
export declare const AssumptionSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    impact: z.ZodEnum<{
        critical: "critical";
        moderate: "moderate";
        minor: "minor";
    }>;
    alternative: z.ZodNullable<z.ZodString>;
}, z.core.$strip>;
/**
 * Validation status schema (discriminated union).
 * Tracks whether the interpretation has been validated.
 */
export declare const ValidationStatusSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    validated: z.ZodLiteral<false>;
    reason: z.ZodLiteral<"pending">;
}, z.core.$strip>, z.ZodObject<{
    validated: z.ZodLiteral<true>;
    by: z.ZodLiteral<"human">;
    at: z.ZodNumber;
    validator: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    validated: z.ZodLiteral<true>;
    by: z.ZodLiteral<"assumed">;
    at: z.ZodNumber;
    flagged: z.ZodLiteral<true>;
}, z.core.$strip>], "validated">;
/**
 * Interpreted rule schema.
 * Represents the LLM's interpretation of an open-ended goal.
 */
export declare const InterpretedRuleSchema: z.ZodObject<{
    originalGoal: z.ZodString;
    formalizedGoal: z.ZodUnknown;
    inferredConstraints: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
    assumptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        impact: z.ZodEnum<{
            critical: "critical";
            moderate: "moderate";
            minor: "minor";
        }>;
        alternative: z.ZodNullable<z.ZodString>;
    }, z.core.$strip>>>;
    confidence: z.ZodEnum<{
        high: "high";
        medium: "medium";
        low: "low";
    }>;
    clarifyingQuestions: z.ZodDefault<z.ZodArray<z.ZodString>>;
    validation: z.ZodDiscriminatedUnion<[z.ZodObject<{
        validated: z.ZodLiteral<false>;
        reason: z.ZodLiteral<"pending">;
    }, z.core.$strip>, z.ZodObject<{
        validated: z.ZodLiteral<true>;
        by: z.ZodLiteral<"human">;
        at: z.ZodNumber;
        validator: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        validated: z.ZodLiteral<true>;
        by: z.ZodLiteral<"assumed">;
        at: z.ZodNumber;
        flagged: z.ZodLiteral<true>;
    }, z.core.$strip>], "validated">;
}, z.core.$strip>;
/**
 * Level 2 schema.
 * Extends Level 1 with interpreted rule state.
 * (Level 2 inherits Level 1 requirements per FDR-N007)
 */
export declare const Level2Schema: z.ZodObject<{
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
    interpretedRule: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        originalGoal: z.ZodString;
        formalizedGoal: z.ZodUnknown;
        inferredConstraints: z.ZodDefault<z.ZodArray<z.ZodUnknown>>;
        assumptions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            description: z.ZodString;
            impact: z.ZodEnum<{
                critical: "critical";
                moderate: "moderate";
                minor: "minor";
            }>;
            alternative: z.ZodNullable<z.ZodString>;
        }, z.core.$strip>>>;
        confidence: z.ZodEnum<{
            high: "high";
            medium: "medium";
            low: "low";
        }>;
        clarifyingQuestions: z.ZodDefault<z.ZodArray<z.ZodString>>;
        validation: z.ZodDiscriminatedUnion<[z.ZodObject<{
            validated: z.ZodLiteral<false>;
            reason: z.ZodLiteral<"pending">;
        }, z.core.$strip>, z.ZodObject<{
            validated: z.ZodLiteral<true>;
            by: z.ZodLiteral<"human">;
            at: z.ZodNumber;
            validator: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            validated: z.ZodLiteral<true>;
            by: z.ZodLiteral<"assumed">;
            at: z.ZodNumber;
            flagged: z.ZodLiteral<true>;
        }, z.core.$strip>], "validated">;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type Assumption = z.infer<typeof AssumptionSchema>;
export type ValidationStatus = z.infer<typeof ValidationStatusSchema>;
export type InterpretedRule = z.infer<typeof InterpretedRuleSchema>;
export type Level2State = z.infer<typeof Level2Schema>;
//# sourceMappingURL=level-2.d.ts.map