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
export declare const MerkleSibling: z.ZodObject<{
    hash: z.ZodString;
    position: z.ZodEnum<{
        left: "left";
        right: "right";
    }>;
}, z.core.$strip>;
export type MerkleSibling = z.infer<typeof MerkleSibling>;
/**
 * Path proof from a leaf to the root.
 * Contains the leaf hash and all sibling nodes along the path.
 */
export declare const MerklePathProof: z.ZodObject<{
    leafHash: z.ZodString;
    siblings: z.ZodArray<z.ZodObject<{
        hash: z.ZodString;
        position: z.ZodEnum<{
            left: "left";
            right: "right";
        }>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MerklePathProof = z.infer<typeof MerklePathProof>;
/**
 * Proof data for Merkle verification method.
 * Goes into VerificationProof.proof when method === 'merkle'.
 */
export declare const MerkleProofData: z.ZodObject<{
    computedRoot: z.ZodString;
    expectedRoot: z.ZodOptional<z.ZodString>;
    pathProof: z.ZodOptional<z.ZodObject<{
        leafHash: z.ZodString;
        siblings: z.ZodArray<z.ZodObject<{
            hash: z.ZodString;
            position: z.ZodEnum<{
                left: "left";
                right: "right";
            }>;
        }, z.core.$strip>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type MerkleProofData = z.infer<typeof MerkleProofData>;
/**
 * Proof data for Hash verification method.
 * Goes into VerificationProof.proof when method === 'hash'.
 */
export declare const HashProofData: z.ZodObject<{
    computedHash: z.ZodString;
    expectedHash: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type HashProofData = z.infer<typeof HashProofData>;
//# sourceMappingURL=merkle.d.ts.map