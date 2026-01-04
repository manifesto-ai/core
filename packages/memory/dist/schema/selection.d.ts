/**
 * Memory Selection Schema
 *
 * Defines types for memory selection requests, constraints, and results.
 *
 * @see SPEC-1.2v §5.1.4, §5.3
 */
import { z } from "zod";
/**
 * A selected memory with selection context.
 *
 * Constraints:
 * - ref MUST be present
 * - ref.worldId MUST be valid WorldId
 * - reason MUST be non-empty string
 * - confidence MUST be in range [0, 1] inclusive
 * - confidence MUST be finite (not NaN, not Infinity)
 * - verified MUST be boolean
 * - evidence is OPTIONAL
 */
export declare const SelectedMemory: z.ZodObject<{
    ref: z.ZodObject<{
        worldId: import("zod/v4/core").$ZodBranded<import("zod").ZodString, "WorldId", "out">;
    }, z.core.$strip>;
    reason: z.ZodString;
    confidence: z.ZodNumber;
    verified: z.ZodBoolean;
    evidence: z.ZodOptional<z.ZodObject<{
        method: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
        proof: z.ZodOptional<z.ZodUnknown>;
        verifiedAt: z.ZodNumber;
        verifiedBy: import("zod").ZodObject<{
            actorId: import("zod").ZodString;
            kind: import("zod").ZodEnum<{
                human: "human";
                agent: "agent";
                system: "system";
            }>;
            name: import("zod").ZodOptional<import("zod").ZodString>;
            meta: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
        }, import("zod/v4/core").$strip>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SelectedMemory = z.infer<typeof SelectedMemory>;
/**
 * Time range constraints for memory selection.
 */
export declare const TimeRange: z.ZodObject<{
    after: z.ZodOptional<z.ZodNumber>;
    before: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export type TimeRange = z.infer<typeof TimeRange>;
/**
 * Constraints for memory selection.
 */
export declare const SelectionConstraints: z.ZodObject<{
    maxResults: z.ZodOptional<z.ZodNumber>;
    minConfidence: z.ZodOptional<z.ZodNumber>;
    requireVerified: z.ZodOptional<z.ZodBoolean>;
    requireEvidence: z.ZodOptional<z.ZodBoolean>;
    timeRange: z.ZodOptional<z.ZodObject<{
        after: z.ZodOptional<z.ZodNumber>;
        before: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SelectionConstraints = z.infer<typeof SelectionConstraints>;
/**
 * Request for memory selection.
 */
export declare const SelectionRequest: z.ZodObject<{
    query: z.ZodString;
    atWorldId: import("zod/v4/core").$ZodBranded<import("zod").ZodString, "WorldId", "out">;
    selector: import("zod").ZodObject<{
        actorId: import("zod").ZodString;
        kind: import("zod").ZodEnum<{
            human: "human";
            agent: "agent";
            system: "system";
        }>;
        name: import("zod").ZodOptional<import("zod").ZodString>;
        meta: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
    }, import("zod/v4/core").$strip>;
    constraints: z.ZodOptional<z.ZodObject<{
        maxResults: z.ZodOptional<z.ZodNumber>;
        minConfidence: z.ZodOptional<z.ZodNumber>;
        requireVerified: z.ZodOptional<z.ZodBoolean>;
        requireEvidence: z.ZodOptional<z.ZodBoolean>;
        timeRange: z.ZodOptional<z.ZodObject<{
            after: z.ZodOptional<z.ZodNumber>;
            before: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type SelectionRequest = z.infer<typeof SelectionRequest>;
/**
 * Result of memory selection.
 */
export declare const SelectionResult: z.ZodObject<{
    selected: z.ZodArray<z.ZodObject<{
        ref: z.ZodObject<{
            worldId: import("zod/v4/core").$ZodBranded<import("zod").ZodString, "WorldId", "out">;
        }, z.core.$strip>;
        reason: z.ZodString;
        confidence: z.ZodNumber;
        verified: z.ZodBoolean;
        evidence: z.ZodOptional<z.ZodObject<{
            method: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
            proof: z.ZodOptional<z.ZodUnknown>;
            verifiedAt: z.ZodNumber;
            verifiedBy: import("zod").ZodObject<{
                actorId: import("zod").ZodString;
                kind: import("zod").ZodEnum<{
                    human: "human";
                    agent: "agent";
                    system: "system";
                }>;
                name: import("zod").ZodOptional<import("zod").ZodString>;
                meta: import("zod").ZodOptional<import("zod").ZodRecord<import("zod").ZodString, import("zod").ZodUnknown>>;
            }, import("zod/v4/core").$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
    selectedAt: z.ZodNumber;
}, z.core.$strip>;
export type SelectionResult = z.infer<typeof SelectionResult>;
//# sourceMappingURL=selection.d.ts.map