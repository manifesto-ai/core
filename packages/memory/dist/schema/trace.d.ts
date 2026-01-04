/**
 * Memory Trace Schema
 *
 * Defines the MemoryTrace type for audit trail recording.
 * Attached to Proposal.trace.context.memory.
 *
 * @see SPEC-1.2v §5.1.5
 */
import { z } from "zod";
/**
 * Record of memory selection for audit.
 * Attached to Proposal.trace.context.memory.
 *
 * Constraints:
 * - selector MUST be valid ActorRef per Intent & Projection §3.1
 * - query MUST be non-empty string
 * - selectedAt MUST be positive integer
 * - atWorldId MUST be valid WorldId
 * - selected MUST be array (MAY be empty)
 * - selected[*] Each element MUST satisfy SelectedMemory constraints
 */
export declare const MemoryTrace: z.ZodObject<{
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
    query: z.ZodString;
    selectedAt: z.ZodNumber;
    atWorldId: import("zod/v4/core").$ZodBranded<import("zod").ZodString, "WorldId", "out">;
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
}, z.core.$strip>;
export type MemoryTrace = z.infer<typeof MemoryTrace>;
/**
 * Key used for storing MemoryTrace in Proposal.trace.context
 */
export declare const MEMORY_TRACE_KEY: "memory";
//# sourceMappingURL=trace.d.ts.map