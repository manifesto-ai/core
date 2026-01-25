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
import { ActorRef } from "@manifesto-ai/world";

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
export const VerificationMethod = z.union([
  z.literal("existence"),
  z.literal("hash"),
  z.literal("merkle"),
  z.literal("signature"),
  z.literal("none"),
  z.string(), // Custom methods allowed
]);

export type VerificationMethod = z.infer<typeof VerificationMethod>;

/**
 * Pure verification output.
 * Contains ONLY deterministic data derived from inputs.
 * NO timestamps, NO actor references.
 *
 * This is what Verifier.prove() returns (inside ProveResult).
 * This is what Verifier.verifyProof() accepts.
 */
export const VerificationProof = z.object({
  /** Verification method used */
  method: VerificationMethod,
  /** Method-specific proof data (deterministic) */
  proof: z.unknown().optional(),
});

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
export const VerificationEvidence = z.object({
  /** Verification method used (from VerificationProof) */
  method: VerificationMethod,
  /** Method-specific proof data (from VerificationProof) */
  proof: z.unknown().optional(),
  /** When verification was performed (added by Selector, NOT Verifier) */
  verifiedAt: z.number().int().positive(),
  /** Who performed verification (added by Selector, NOT Verifier) */
  verifiedBy: ActorRef,
});

export type VerificationEvidence = z.infer<typeof VerificationEvidence>;

/**
 * Result of Verifier.prove().
 * Pure output: contains ONLY deterministic data.
 */
export const ProveResult = z.object({
  /** Whether verification passed */
  valid: z.boolean(),
  /** Proof data (if verification succeeded or partial) */
  proof: VerificationProof.optional(),
  /** Error message (if verification failed) */
  error: z.string().optional(),
});

export type ProveResult = z.infer<typeof ProveResult>;

/**
 * Extract VerificationProof from VerificationEvidence.
 * This implements the M-12 pattern for Authority verification.
 *
 * Authority MUST use this pattern before calling verifyProof().
 */
export function extractProof(evidence: VerificationEvidence): VerificationProof {
  return {
    method: evidence.method,
    proof: evidence.proof,
  };
}
