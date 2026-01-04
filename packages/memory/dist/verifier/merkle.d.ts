/**
 * Merkle Verifier
 *
 * Verifier that uses Merkle tree for integrity verification.
 * Reference implementation from SPEC-1.2v Appendix E.
 *
 * @see SPEC-1.2v Appendix E
 */
import type { World } from "@manifesto-ai/world";
import type { MemoryVerifier } from "../interfaces/verifier.js";
import type { MemoryRef } from "../schema/ref.js";
import type { VerificationProof, ProveResult } from "../schema/proof.js";
import type { MerkleSibling } from "../schema/merkle.js";
/**
 * Simple hash function for Merkle tree nodes.
 * Uses a deterministic approach.
 *
 * PURE: No side effects.
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export declare function hashData(data: string): string;
/**
 * Hash a leaf node (key-value pair).
 *
 * PURE: No side effects.
 *
 * @param key - The key
 * @param value - The value
 * @returns Leaf hash string
 */
export declare function hashLeaf(key: string, value: unknown): string;
/**
 * Compute parent hash from two child hashes.
 *
 * PURE: No side effects.
 *
 * @param left - Left child hash
 * @param right - Right child hash
 * @returns Parent hash string
 */
export declare function computeParentHash(left: string, right: string): string;
/**
 * Compute the Merkle root of a data object.
 *
 * PURE: No side effects.
 *
 * @param data - Object to compute Merkle root for
 * @returns Merkle root hash
 */
export declare function computeMerkleRoot(data: Record<string, unknown>): string;
/**
 * Verify a Merkle path proof.
 *
 * PURE: No side effects.
 *
 * @param leafHash - The leaf hash to verify
 * @param siblings - The sibling nodes from leaf to root
 * @param expectedRoot - The expected Merkle root
 * @returns true if the path is valid
 */
export declare function verifyMerklePathProof(leafHash: string, siblings: MerkleSibling[], expectedRoot: string): boolean;
/**
 * Generate a Merkle path proof for a specific key.
 *
 * PURE: No side effects.
 *
 * @param data - The data object
 * @param targetKey - The key to generate proof for
 * @returns The path proof or undefined if key not found
 */
export declare function generateMerklePathProof(data: Record<string, unknown>, targetKey: string): {
    leafHash: string;
    siblings: MerkleSibling[];
} | undefined;
/**
 * Verifier that uses Merkle tree for integrity verification.
 *
 * Verification strategy:
 * - prove() computes Merkle root from World data
 * - verifyProof() verifies Merkle root or path proof
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export declare class MerkleVerifier implements MemoryVerifier {
    /**
     * Generate a Merkle proof.
     *
     * @param _memory - The memory reference (unused in Merkle verification)
     * @param world - The World to verify
     * @returns ProveResult with Merkle proof
     */
    prove(_memory: MemoryRef, world: World): ProveResult;
    /**
     * Verify a Merkle proof.
     *
     * @param proof - The proof to verify
     * @returns true if the proof is valid
     */
    verifyProof(proof: VerificationProof): boolean;
}
/**
 * Factory function to create a MerkleVerifier.
 */
export declare function createMerkleVerifier(): MerkleVerifier;
//# sourceMappingURL=merkle.d.ts.map