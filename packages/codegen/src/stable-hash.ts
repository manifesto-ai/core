import { toCanonical, sha256Sync } from "@manifesto-ai/core";

/**
 * Deterministic hash function (DET-1).
 * Same input always produces the same output.
 * Uses Core's canonical form (sorted keys, no undefined) + SHA-256.
 */
export function stableHash(input: unknown): string {
  const canonical = toCanonical(input);
  return sha256Sync(canonical);
}
