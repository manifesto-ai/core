/**
 * Verification Proof Schema
 *
 * Defines types for verification proofs and evidence.
 * VerificationProof is PURE (no timestamps, no actor references).
 * VerificationEvidence wraps proof with audit metadata.
 *
 * @see SPEC-1.2v §5.1.2, §5.1.3
 */
import { z } from "zod";
/**
 * Supported verification methods.
 * Extensible by applications via string type.
 *
 * | Method | Description |
 * |--------|-------------|
 * | existence | World exists in Store |
 * | hash | Content hash matches |
 * | merkle | Merkle proof verification |
 * | signature | Cryptographic signature |
 * | none | No verification performed |
 */
export declare const VerificationMethod: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
export type VerificationMethod = z.infer<typeof VerificationMethod>;
/**
 * Pure verification output.
 * Contains ONLY deterministic data derived from inputs.
 * NO timestamps, NO actor references.
 *
 * This is what Verifier.prove() returns (inside ProveResult).
 * This is what Verifier.verifyProof() accepts.
 */
export declare const VerificationProof: z.ZodObject<{
    method: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
    proof: z.ZodOptional<z.ZodUnknown>;
}, z.core.$strip>;
export type VerificationProof = z.infer<typeof VerificationProof>;
/**
 * Verification proof with audit metadata.
 * Created by Selector/Actor layer, NOT by Verifier.
 *
 * IMPORTANT: Verifier produces VerificationProof.
 *            Selector wraps it into VerificationEvidence.
 *
 * For Authority to verify, proof must be extracted back into
 * VerificationProof format (see M-12).
 */
export declare const VerificationEvidence: z.ZodObject<{
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
}, z.core.$strip>;
export type VerificationEvidence = z.infer<typeof VerificationEvidence>;
/**
 * Result of Verifier.prove().
 * Pure output: contains ONLY deterministic data.
 */
export declare const ProveResult: z.ZodObject<{
    valid: z.ZodBoolean;
    proof: z.ZodOptional<z.ZodObject<{
        method: z.ZodUnion<readonly [z.ZodLiteral<"existence">, z.ZodLiteral<"hash">, z.ZodLiteral<"merkle">, z.ZodLiteral<"signature">, z.ZodLiteral<"none">, z.ZodString]>;
        proof: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>;
    error: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ProveResult = z.infer<typeof ProveResult>;
/**
 * Extract VerificationProof from VerificationEvidence.
 * This implements the M-12 pattern for Authority verification.
 *
 * Authority MUST use this pattern before calling verifyProof().
 */
export declare function extractProof(evidence: VerificationEvidence): VerificationProof;
//# sourceMappingURL=proof.d.ts.map