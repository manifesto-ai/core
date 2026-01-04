/**
 * Memory Verifier Interface
 *
 * Defines the interface for memory verification.
 * Verifier implementations MUST be PURE (M-8).
 *
 * @see SPEC-1.2v §6.2, §8.2
 */
import type { World } from "@manifesto-ai/world";
import type { MemoryRef } from "../schema/ref.js";
import type { VerificationProof, ProveResult } from "../schema/proof.js";
/**
 * Interface for memory verification operations.
 *
 * Applications MUST provide MemoryVerifier implementation (M-7).
 * Implementations MUST be PURE (M-8).
 *
 * Purity Requirements (M-8):
 * - ❌ MUST NOT call MemoryStore
 * - ❌ MUST NOT perform IO (network, filesystem)
 * - ❌ MUST NOT access current time (no Date.now())
 * - ❌ MUST NOT access actor context
 * - ✅ All data MUST be passed as function arguments
 * - ✅ Same inputs MUST produce same outputs
 * - ✅ Outputs MUST NOT contain verifiedAt or verifiedBy
 *
 * Module Access:
 * - Actor: ✅ prove() and verifyProof()
 * - Projection: ❌ Forbidden
 * - Authority: ✅ verifyProof() only (via M-12 pattern)
 * - Host: ❌ Forbidden
 * - Core: ❌ Forbidden
 *
 * Example implementations:
 * - ExistenceVerifier (checks World exists)
 * - HashVerifier (compares hashes)
 * - MerkleVerifier (Merkle root verification)
 */
export interface MemoryVerifier {
    /**
     * Generate a verification proof for a memory reference.
     *
     * This method is PURE: same inputs MUST produce same outputs.
     * Output MUST NOT contain timestamps or actor references.
     *
     * @param memory - The memory reference to verify
     * @param world - The World data to verify against
     * @returns ProveResult with validity and optional proof
     */
    prove(memory: MemoryRef, world: World): ProveResult;
    /**
     * Verify a previously generated proof.
     *
     * This method is PURE: same inputs MUST produce same outputs.
     * Used by Authority to verify proofs without Store access.
     *
     * Authority MUST extract proof from evidence using extractProof()
     * before calling this method (M-12).
     *
     * @param proof - The proof to verify
     * @returns true if the proof is valid, false otherwise
     */
    verifyProof(proof: VerificationProof): boolean;
}
//# sourceMappingURL=verifier.d.ts.map