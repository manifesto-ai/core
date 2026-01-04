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
    selector: z.ZodObject<{
        actorId: z.ZodString;
        kind: z.ZodEnum<{
            human: "human";
            agent: "agent";
            system: "system";
        }>;
        name: z.ZodOptional<z.ZodString>;
        meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strip>;
    query: z.ZodString;
    selectedAt: z.ZodNumber;
    atWorldId: z.core.$ZodBranded<z.ZodString, "WorldId">;
    selected: z.ZodArray<z.ZodObject<{
        ref: z.ZodObject<{
            worldId: z.core.$ZodBranded<z.ZodString, "WorldId">;
        }, z.core.$strip>;
        reason: z.ZodString;
        confidence: z.ZodNumber;
        verified: z.ZodBoolean;
        evidence: z.ZodOptional<z.ZodObject<{
            method: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
            proof: z.ZodOptional<z.ZodUnknown>;
            verifiedAt: z.ZodNumber;
            verifiedBy: z.ZodObject<{
                actorId: z.ZodString;
                kind: z.ZodEnum<{
                    human: "human";
                    agent: "agent";
                    system: "system";
                }>;
                name: z.ZodOptional<z.ZodString>;
                meta: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, z.core.$strip>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MemoryTrace = z.infer<typeof MemoryTrace>;
/**
 * Key used for storing MemoryTrace in Proposal.trace.context
 */
export declare const MEMORY_TRACE_KEY: "memory";
//# sourceMappingURL=trace.d.ts.map