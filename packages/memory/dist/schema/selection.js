/**
 * Memory Selection Schema
 *
 * Defines types for memory selection requests, constraints, and results.
 *
 * @see SPEC-1.2v §5.1.4, §5.3
 */
import { z } from "zod";
import { WorldId, ActorRef } from "@manifesto-ai/world";
import { MemoryRef } from "./ref.js";
import { VerificationEvidence } from "./proof.js";
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
export const SelectedMemory = z.object({
    /** Reference to the selected World */
    ref: MemoryRef,
    /** Why this memory was selected */
    reason: z.string().min(1),
    /** Confidence in relevance (0-1) */
    confidence: z.number().min(0).max(1).refine((n) => Number.isFinite(n), {
        message: "Confidence must be finite (not NaN or Infinity)",
    }),
    /**
     * Whether verification passed.
     *
     * TRUE if Verifier.prove() returned valid: true.
     * FALSE if Verifier.prove() returned valid: false or was not called.
     *
     * Note: This indicates verification result, not just existence.
     * The actual verification method is in evidence.method.
     */
    verified: z.boolean(),
    /** Optional verification evidence for Authority inspection */
    evidence: VerificationEvidence.optional(),
});
/**
 * Time range constraints for memory selection.
 */
export const TimeRange = z.object({
    /** Only memories after this timestamp */
    after: z.number().int().optional(),
    /** Only memories before this timestamp */
    before: z.number().int().optional(),
});
/**
 * Constraints for memory selection.
 */
export const SelectionConstraints = z.object({
    /** Maximum number of results */
    maxResults: z.number().int().positive().optional(),
    /** Minimum confidence threshold */
    minConfidence: z.number().min(0).max(1).optional(),
    /** Require verified memories only (verified === true) */
    requireVerified: z.boolean().optional(),
    /**
     * Require verification evidence to be present.
     *
     * When true: Only memories with evidence field are included.
     * This is a "presence check" not a "cryptographic proof" requirement.
     */
    requireEvidence: z.boolean().optional(),
    /** Time range constraints */
    timeRange: TimeRange.optional(),
});
/**
 * Request for memory selection.
 */
export const SelectionRequest = z.object({
    /** What to search for */
    query: z.string().min(1),
    /** Current World context */
    atWorldId: WorldId,
    /** Who is performing selection */
    selector: ActorRef,
    /** Optional constraints */
    constraints: SelectionConstraints.optional(),
});
/**
 * Result of memory selection.
 */
export const SelectionResult = z.object({
    /** Selected memories */
    selected: z.array(SelectedMemory),
    /** When selection was performed (Unix timestamp ms) */
    selectedAt: z.number().int().positive(),
});
//# sourceMappingURL=selection.js.map