/**
 * Hash Verifier
 *
 * Verifier that checks content hash matches.
 * Uses World.snapshotHash for comparison.
 *
 * @see SPEC-1.2v §7.3 (Verification Level: Hash)
 */
import type { World } from "@manifesto-ai/world";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type { MemoryRef } from "../schema/ref.js";
import type { VerificationProof, ProveResult } from "../schema/proof.js";
/**
 * Compute a simple hash of the data.
 * Uses a deterministic JSON stringification + hash.
 *
 * PURE: No side effects.
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export declare function computeHash(data: unknown): string;
/**
 * Verifier that checks content hash matches.
 *
 * Verification strategy:
 * - prove() computes hash and compares with World.snapshotHash
 * - verifyProof() checks if computed hash matches expected hash
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export declare class HashVerifier implements MemoryVerifier {
    /**
     * Generate a hash proof.
     *
     * @param memory - The memory reference
     * @param world - The World to verify
     * @returns ProveResult with hash comparison
     */
    prove(memory: MemoryRef, world: World): ProveResult;
    /**
     * Verify a hash proof.
     *
     * @param proof - The proof to verify
     * @returns true if method is 'hash' and data is valid
     */
    verifyProof(proof: VerificationProof): boolean;
}
/**
 * Factory function to create a HashVerifier.
 */
export declare function createHashVerifier(): HashVerifier;
//# sourceMappingURL=hash.d.ts.map