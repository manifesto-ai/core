/**
 * Merkle Tree Schema Types
 *
 * Defines types for Merkle tree verification proofs.
 * These types are used by MerkleVerifier and HashVerifier.
 *
 * @see SPEC-1.2v Appendix E
 */
import { z } from "zod";
/**
 * Sibling node in a Merkle path proof.
 * Position indicates whether this sibling is on the left or right.
 */
export const MerkleSibling = z.object({
    /** Hash of the sibling node */
    hash: z.string(),
    /** Position of sibling relative to current node */
    position: z.enum(["left", "right"]),
});
/**
 * Path proof from a leaf to the root.
 * Contains the leaf hash and all sibling nodes along the path.
 */
export const MerklePathProof = z.object({
    /** Hash of the leaf being proven */
    leafHash: z.string(),
    /** Sibling nodes from leaf to root */
    siblings: z.array(MerkleSibling),
});
/**
 * Proof data for Merkle verification method.
 * Goes into VerificationProof.proof when method === 'merkle'.
 */
export const MerkleProofData = z.object({
    /** Computed Merkle root from World data */
    computedRoot: z.string(),
    /** Expected Merkle root (if stored in World) */
    expectedRoot: z.string().optional(),
    /** Optional path proof for specific key verification */
    pathProof: MerklePathProof.optional(),
});
/**
 * Proof data for Hash verification method.
 * Goes into VerificationProof.proof when method === 'hash'.
 */
export const HashProofData = z.object({
    /** Computed hash from World data */
    computedHash: z.string(),
    /** Expected hash (if stored in World) */
    expectedHash: z.string().optional(),
});
//# sourceMappingURL=merkle.js.map