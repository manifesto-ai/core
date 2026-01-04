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
export declare const MerklePosition: z.ZodEnum<{
    left: "left";
    right: "right";
}>;
export type MerklePosition = z.infer<typeof MerklePosition>;
/**
 * A sibling node in the Merkle proof path.
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
 * Path proof for partial Merkle verification.
 * Used to prove a specific leaf is part of the tree.
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
 * Merkle-specific proof data.
 * This is what goes into VerificationProof.proof when method === 'merkle'.
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
 * Hash-specific proof data.
 * This is what goes into VerificationProof.proof when method === 'hash'.
 */
export declare const HashProofData: z.ZodObject<{
    computedHash: z.ZodString;
    expectedHash: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type HashProofData = z.infer<typeof HashProofData>;
//# sourceMappingURL=merkle.d.ts.map