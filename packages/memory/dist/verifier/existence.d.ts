/**
 * Existence Verifier
 *
 * Simple verifier that checks if a World exists.
 * This is the most basic verification level.
 *
 * @see SPEC-1.2v §7.3 (Verification Level: Existence)
 */
import type { World } from "@manifesto-ai/world";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type { MemoryRef } from "../schema/ref.js";
import type { VerificationProof, ProveResult } from "../schema/proof.js";
/**
 * Verifier that only checks if a World exists.
 *
 * This is the simplest verification strategy:
 * - prove() returns valid=true if world is not null/undefined
 * - verifyProof() returns true if method is 'existence'
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export declare class ExistenceVerifier implements MemoryVerifier {
    /**
     * Generate an existence proof.
     *
     * @param _memory - The memory reference (unused in existence check)
     * @param world - The World to verify
     * @returns ProveResult with validity
     */
    prove(_memory: MemoryRef, world: World): ProveResult;
    /**
     * Verify an existence proof.
     *
     * @param proof - The proof to verify
     * @returns true if method is 'existence'
     */
    verifyProof(proof: VerificationProof): boolean;
}
/**
 * Factory function to create an ExistenceVerifier.
 */
export declare function createExistenceVerifier(): ExistenceVerifier;
//# sourceMappingURL=existence.d.ts.map