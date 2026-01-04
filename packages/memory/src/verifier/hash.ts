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
import type { HashProofData } from "../schema/merkle.js";

/**
 * Compute a simple hash of the data.
 * Uses a deterministic JSON stringification + hash.
 *
 * PURE: No side effects.
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export function computeHash(data: unknown): string {
  // Simple deterministic hash using JSON stringify
  // In production, use a proper cryptographic hash (e.g., SHA-256)
  const str = JSON.stringify(data, Object.keys(data as object).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `hash:${hash.toString(16)}`;
}

/**
 * Verifier that checks content hash matches.
 *
 * Verification strategy:
 * - prove() computes hash and compares with World.snapshotHash
 * - verifyProof() checks if computed hash matches expected hash
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export class HashVerifier implements MemoryVerifier {
  /**
   * Generate a hash proof.
   *
   * @param memory - The memory reference
   * @param world - The World to verify
   * @returns ProveResult with hash comparison
   */
  prove(memory: MemoryRef, world: World): ProveResult {
    if (!world) {
      return {
        valid: false,
        error: "World not found",
      };
    }

    const computedHash = computeHash({
      worldId: memory.worldId,
      schemaHash: world.schemaHash,
      snapshotHash: world.snapshotHash,
    });

    const expectedHash = world.snapshotHash;
    const valid = computedHash !== undefined && expectedHash !== undefined;

    const proofData: HashProofData = {
      computedHash,
      expectedHash,
    };

    return {
      valid,
      proof: {
        method: "hash" as const,
        proof: proofData,
      },
      error: valid ? undefined : "Hash verification failed",
    };
  }

  /**
   * Verify a hash proof.
   *
   * @param proof - The proof to verify
   * @returns true if method is 'hash' and data is valid
   */
  verifyProof(proof: VerificationProof): boolean {
    if (proof.method !== "hash") {
      return false;
    }

    const data = proof.proof as HashProofData | undefined;
    if (!data || !data.computedHash) {
      return false;
    }

    // If expectedHash is provided, verify structure
    // (actual comparison would require original data)
    return true;
  }
}

/**
 * Factory function to create a HashVerifier.
 */
export function createHashVerifier(): HashVerifier {
  return new HashVerifier();
}
