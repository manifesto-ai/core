/**
 * Memory Verifier Implementation
 *
 * @see SPEC §14.4
 * @module
 */

import type { World } from "@manifesto-ai/world";
import type { MemoryVerifier, ProveResult, VerificationProof } from "../../core/types/index.js";

/**
 * NoneVerifier - Default verifier when provider.verifier is absent.
 *
 * VER-2: NoneVerifier MUST always produce verified = false
 *
 * @see SPEC §14.4
 */
export const NoneVerifier: MemoryVerifier = {
  /**
   * Generate proof for memory.
   * Always returns invalid proof.
   */
  prove(
    memory: { readonly worldId: string },
    world: World
  ): ProveResult {
    return {
      valid: false,
      error: "NoneVerifier does not support verification",
    };
  },

  /**
   * Verify a proof.
   * Always returns false.
   */
  verifyProof(proof: unknown): boolean {
    return false;
  },
};

/**
 * Check if verification is valid based on VER-1 rule.
 *
 * VER-1: SelectedMemory.verified MUST be proveResult.valid && verifier.verifyProof(proof)
 *
 * @see SPEC §14.4.1
 */
export function computeVerified(
  proveResult: ProveResult,
  verifier: MemoryVerifier,
  proof: VerificationProof
): boolean {
  return proveResult.valid && verifier.verifyProof(proof);
}
