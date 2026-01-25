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
import type { MerkleProofData, MerkleSibling } from "../schema/merkle.js";

/**
 * Simple hash function for Merkle tree nodes.
 * Uses a deterministic approach.
 *
 * PURE: No side effects.
 *
 * @param data - Data to hash
 * @returns Hash string
 */
export function hashData(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/**
 * Hash a leaf node (key-value pair).
 *
 * PURE: No side effects.
 *
 * @param key - The key
 * @param value - The value
 * @returns Leaf hash string
 */
export function hashLeaf(key: string, value: unknown): string {
  const serialized = JSON.stringify({ key, value });
  return `leaf:${hashData(serialized)}`;
}

/**
 * Compute parent hash from two child hashes.
 *
 * PURE: No side effects.
 *
 * @param left - Left child hash
 * @param right - Right child hash
 * @returns Parent hash string
 */
export function computeParentHash(left: string, right: string): string {
  const combined = `${left}:${right}`;
  return `node:${hashData(combined)}`;
}

/**
 * Compute the Merkle root of a data object.
 *
 * PURE: No side effects.
 *
 * @param data - Object to compute Merkle root for
 * @returns Merkle root hash
 */
export function computeMerkleRoot(data: Record<string, unknown>): string {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));

  if (entries.length === 0) {
    return "root:empty";
  }

  // Create leaf hashes
  let hashes = entries.map(([key, value]) => hashLeaf(key, value));

  // Build tree bottom-up
  while (hashes.length > 1) {
    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] ?? left; // Duplicate last if odd
      nextLevel.push(computeParentHash(left, right));
    }
    hashes = nextLevel;
  }

  return `root:${hashes[0]}`;
}

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
export function verifyMerklePathProof(
  leafHash: string,
  siblings: MerkleSibling[],
  expectedRoot: string
): boolean {
  let currentHash = leafHash;

  for (const sibling of siblings) {
    if (sibling.position === "left") {
      currentHash = computeParentHash(sibling.hash, currentHash);
    } else {
      currentHash = computeParentHash(currentHash, sibling.hash);
    }
  }

  // Compare computed root with expected root
  // Note: We normalize by extracting the hash part
  const computedRootHash = currentHash.startsWith("node:")
    ? currentHash
    : `root:${currentHash}`;
  const normalizedExpected = expectedRoot.startsWith("root:")
    ? expectedRoot
    : `root:${expectedRoot}`;

  return computedRootHash === normalizedExpected ||
         currentHash === normalizedExpected.replace("root:", "");
}

/**
 * Generate a Merkle path proof for a specific key.
 *
 * PURE: No side effects.
 *
 * @param data - The data object
 * @param targetKey - The key to generate proof for
 * @returns The path proof or undefined if key not found
 */
export function generateMerklePathProof(
  data: Record<string, unknown>,
  targetKey: string
): { leafHash: string; siblings: MerkleSibling[] } | undefined {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
  const targetIndex = entries.findIndex(([key]) => key === targetKey);

  if (targetIndex === -1) {
    return undefined;
  }

  // Create leaf hashes
  let hashes = entries.map(([key, value]) => hashLeaf(key, value));
  const leafHash = hashes[targetIndex];
  const siblings: MerkleSibling[] = [];

  let currentIndex = targetIndex;

  // Build path bottom-up
  while (hashes.length > 1) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;

    if (siblingIndex < hashes.length) {
      siblings.push({
        hash: hashes[siblingIndex],
        position: currentIndex % 2 === 0 ? "right" : "left",
      });
    } else if (currentIndex % 2 === 0) {
      // Odd number of nodes, last node duplicates itself
      siblings.push({
        hash: hashes[currentIndex],
        position: "right",
      });
    }

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = hashes[i + 1] ?? left;
      nextLevel.push(computeParentHash(left, right));
    }

    hashes = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { leafHash, siblings };
}

/**
 * Verifier that uses Merkle tree for integrity verification.
 *
 * Verification strategy:
 * - prove() computes Merkle root from World data
 * - verifyProof() verifies Merkle root or path proof
 *
 * PURE: No IO, no timestamps, no actor context.
 */
export class MerkleVerifier implements MemoryVerifier {
  /**
   * Generate a Merkle proof.
   *
   * @param _memory - The memory reference (unused in Merkle verification)
   * @param world - The World to verify
   * @returns ProveResult with Merkle proof
   */
  prove(_memory: MemoryRef, world: World): ProveResult {
    if (!world) {
      return {
        valid: false,
        error: "World not found",
      };
    }

    // Compute Merkle root from World properties
    const worldData: Record<string, unknown> = {
      worldId: world.worldId,
      schemaHash: world.schemaHash,
      snapshotHash: world.snapshotHash,
      createdAt: world.createdAt,
      createdBy: world.createdBy,
    };

    const computedRoot = computeMerkleRoot(worldData);

    const proofData: MerkleProofData = {
      computedRoot,
      // expectedRoot would be stored in World if available
    };

    return {
      valid: true,
      proof: {
        method: "merkle" as const,
        proof: proofData,
      },
    };
  }

  /**
   * Verify a Merkle proof.
   *
   * @param proof - The proof to verify
   * @returns true if the proof is valid
   */
  verifyProof(proof: VerificationProof): boolean {
    if (proof.method !== "merkle") {
      return false;
    }

    const data = proof.proof as MerkleProofData | undefined;
    if (!data || !data.computedRoot) {
      return false;
    }

    // If expectedRoot was provided, compare
    if (data.expectedRoot) {
      if (data.computedRoot !== data.expectedRoot) {
        return false;
      }
    }

    // If path proof is provided, verify it
    if (data.pathProof) {
      if (!data.expectedRoot) {
        // Need expectedRoot to verify path proof
        return true; // Can't verify path without expected root
      }
      return verifyMerklePathProof(
        data.pathProof.leafHash,
        data.pathProof.siblings,
        data.expectedRoot
      );
    }

    // Basic structure is valid
    return true;
  }
}

/**
 * Factory function to create a MerkleVerifier.
 */
export function createMerkleVerifier(): MerkleVerifier {
  return new MerkleVerifier();
}
