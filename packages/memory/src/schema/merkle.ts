/**
 * Merkle Proof Schema
 *
 * Defines types for Merkle-based verification.
 * Reference implementation from SPEC-1.2v Appendix E.
 *
 * @see SPEC-1.2v Appendix E
 */
import { z } from "zod";

/**
 * Position of a sibling node in the Merkle tree.
 */
export const MerklePosition = z.enum(["left", "right"]);
export type MerklePosition = z.infer<typeof MerklePosition>;

/**
 * A sibling node in the Merkle proof path.
 */
export const MerkleSibling = z.object({
  /** Hash of the sibling node */
  hash: z.string(),
  /** Position of the sibling (left or right) */
  position: MerklePosition,
});

export type MerkleSibling = z.infer<typeof MerkleSibling>;

/**
 * Path proof for partial Merkle verification.
 * Used to prove a specific leaf is part of the tree.
 */
export const MerklePathProof = z.object({
  /** Hash of the leaf being proven */
  leafHash: z.string(),
  /** Sibling nodes from leaf to root */
  siblings: z.array(MerkleSibling),
});

export type MerklePathProof = z.infer<typeof MerklePathProof>;

/**
 * Merkle-specific proof data.
 * This is what goes into VerificationProof.proof when method === 'merkle'.
 */
export const MerkleProofData = z.object({
  /** Computed Merkle root from World data */
  computedRoot: z.string(),
  /** Stored/expected Merkle root (if available) */
  expectedRoot: z.string().optional(),
  /** Optional path proof for partial verification */
  pathProof: MerklePathProof.optional(),
});

export type MerkleProofData = z.infer<typeof MerkleProofData>;

/**
 * Hash-specific proof data.
 * This is what goes into VerificationProof.proof when method === 'hash'.
 */
export const HashProofData = z.object({
  /** Computed hash from World data */
  computedHash: z.string(),
  /** Expected hash for comparison */
  expectedHash: z.string().optional(),
});

export type HashProofData = z.infer<typeof HashProofData>;
