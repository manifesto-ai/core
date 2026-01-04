/**
 * Level 3: Natural Language Grounding (GroundingState)
 *
 * When intent grounding from natural language is required.
 * Per SPEC Section 5.4.
 */
import { z } from "zod";
/**
 * Reference resolution schema.
 * Records how a reference in natural language was resolved.
 */
export declare const ReferenceResolutionSchema: z.ZodObject<{
    span: z.ZodString;
    resolvedTo: z.ZodUnknown;
    method: z.ZodEnum<{
        default: "default";
        context: "context";
        user_confirmed: "user_confirmed";
        inferred: "inferred";
    }>;
    confidence: z.ZodNumber;
}, z.core.$strip>;
/**
 * Ambiguity schema.
 * Records an ambiguous element and how it was handled.
 */
export declare const AmbiguitySchema: z.ZodObject<{
    span: z.ZodString;
    interpretations: z.ZodArray<z.ZodUnknown>;
    resolved: z.ZodNullable<z.ZodUnknown>;
    resolutionMethod: z.ZodEnum<{
        default: "default";
        context: "context";
        unresolved: "unresolved";
        user_confirmed: "user_confirmed";
    }>;
}, z.core.$strip>;
/**
 * Confirmation status schema (discriminated union).
 * Tracks whether user confirmation is required.
 */
export declare const ConfirmationStatusSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    required: z.ZodLiteral<false>;
}, z.core.$strip>, z.ZodObject<{
    required: z.ZodLiteral<true>;
    level: z.ZodEnum<{
        critical: "critical";
        active: "active";
        passive: "passive";
    }>;
    status: z.ZodEnum<{
        confirmed: "confirmed";
        pending: "pending";
        rejected: "rejected";
    }>;
}, z.core.$strip>], "required">;
/**
 * Grounding state schema.
 * Contains all information about natural language grounding.
 */
export declare const GroundingStateSchema: z.ZodObject<{
    originalUtterance: z.ZodString;
    parsedIntent: z.ZodUnknown;
    referenceResolutions: z.ZodDefault<z.ZodArray<z.ZodObject<{
        span: z.ZodString;
        resolvedTo: z.ZodUnknown;
        method: z.ZodEnum<{
            default: "default";
            context: "context";
            user_confirmed: "user_confirmed";
            inferred: "inferred";
        }>;
        confidence: z.ZodNumber;
    }, z.core.$strip>>>;
    ambiguities: z.ZodDefault<z.ZodArray<z.ZodObject<{
        span: z.ZodString;
        interpretations: z.ZodArray<z.ZodUnknown>;
        resolved: z.ZodNullable<z.ZodUnknown>;
        resolutionMethod: z.ZodEnum<{
            default: "default";
            context: "context";
            unresolved: "unresolved";
            user_confirmed: "user_confirmed";
        }>;
    }, z.core.$strip>>>;
    confirmation: z.ZodDiscriminatedUnion<[z.ZodObject<{
        required: z.ZodLiteral<false>;
    }, z.core.$strip>, z.ZodObject<{
        required: z.ZodLiteral<true>;
        level: z.ZodEnum<{
            critical: "critical";
            active: "active";
            passive: "passive";
        }>;
        status: z.ZodEnum<{
            confirmed: "confirmed";
            pending: "pending";
            rejected: "rejected";
        }>;
    }, z.core.$strip>], "required">;
}, z.core.$strip>;
/**
 * Level 3 schema.
 * Extends Level 2 with grounding state.
 * (Level 3 inherits Level 1 and Level 2 requirements per FDR-N007)
 */
export declare const Level3Schema: z.ZodObject<{
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
    grounding: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        originalUtterance: z.ZodString;
        parsedIntent: z.ZodUnknown;
        referenceResolutions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            span: z.ZodString;
            resolvedTo: z.ZodUnknown;
            method: z.ZodEnum<{
                default: "default";
                context: "context";
                user_confirmed: "user_confirmed";
                inferred: "inferred";
            }>;
            confidence: z.ZodNumber;
        }, z.core.$strip>>>;
        ambiguities: z.ZodDefault<z.ZodArray<z.ZodObject<{
            span: z.ZodString;
            interpretations: z.ZodArray<z.ZodUnknown>;
            resolved: z.ZodNullable<z.ZodUnknown>;
            resolutionMethod: z.ZodEnum<{
                default: "default";
                context: "context";
                unresolved: "unresolved";
                user_confirmed: "user_confirmed";
            }>;
        }, z.core.$strip>>>;
        confirmation: z.ZodDiscriminatedUnion<[z.ZodObject<{
            required: z.ZodLiteral<false>;
        }, z.core.$strip>, z.ZodObject<{
            required: z.ZodLiteral<true>;
            level: z.ZodEnum<{
                critical: "critical";
                active: "active";
                passive: "passive";
            }>;
            status: z.ZodEnum<{
                confirmed: "confirmed";
                pending: "pending";
                rejected: "rejected";
            }>;
        }, z.core.$strip>], "required">;
    }, z.core.$strip>>>;
}, z.core.$strip>;
export type ReferenceResolution = z.infer<typeof ReferenceResolutionSchema>;
export type Ambiguity = z.infer<typeof AmbiguitySchema>;
export type ConfirmationStatus = z.infer<typeof ConfirmationStatusSchema>;
export type GroundingState = z.infer<typeof GroundingStateSchema>;
export type Level3State = z.infer<typeof Level3Schema>;
//# sourceMappingURL=level-3.d.ts.map