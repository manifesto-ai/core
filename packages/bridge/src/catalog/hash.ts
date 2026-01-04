/**
 * Catalog Hash Computation
 *
 * Per Intent & Projection Specification v1.1 (§7.4.4)
 *
 * catalogHash MUST be computed as:
 *
 * ```
 * catalogHash = SHA-256(
 *   schemaHash + ":" +
 *   JCS(actions.map(a => ({
 *     type: a.type,
 *     status: a.availability.status,
 *     reason: a.availability.status === 'unknown' ? a.availability.reason : null
 *   }))) + ":" +
 *   JCS(appliedPruningOptions)
 * )
 * ```
 *
 * Where:
 * - SHA-256 produces a lowercase hex string
 * - JCS(x) is JSON Canonicalization Scheme (RFC 8785)
 */
import { sha256, toCanonical } from "@manifesto-ai/core";
import type {
  ProjectedAction,
  PruningOptions,
  AppliedPruningOptions,
} from "./types.js";

/**
 * Get applied pruning options with defaults.
 *
 * Default behavior (when pruning is omitted):
 * - policy: 'drop_unavailable'
 * - includeUnknown: true
 * - sort: 'type_lex'
 * - maxActions: null (no limit)
 */
export function getAppliedPruningOptions(
  pruning?: PruningOptions
): AppliedPruningOptions {
  return {
    policy: pruning?.policy ?? "drop_unavailable",
    includeUnknown: pruning?.includeUnknown ?? true,
    sort: pruning?.sort ?? "type_lex",
    maxActions: pruning?.maxActions ?? null,
  };
}

/**
 * Compute catalogHash per §7.4.4 algorithm.
 *
 * The hash captures:
 * 1. Schema context (schemaHash)
 * 2. Action types and their availability status
 * 3. Applied pruning options
 *
 * Non-deterministic fields (timestamps, counters) MUST NOT contribute.
 *
 * Note: The `mode` parameter affects output fields but is NOT included in catalogHash.
 * If implementations need mode-specific caching, they SHOULD use composite key: (catalogHash, mode).
 */
export async function computeCatalogHash(
  schemaHash: string,
  actions: readonly ProjectedAction[],
  appliedPruning: AppliedPruningOptions
): Promise<string> {
  // Build action summary per §7.4.4
  const actionsSummary = actions.map((a) => ({
    type: a.type,
    status: a.availability.status,
    reason:
      a.availability.status === "unknown"
        ? (a.availability as { reason: string }).reason
        : null,
  }));

  // Compose input string with canonical JSON
  const input = [
    schemaHash,
    toCanonical(actionsSummary),
    toCanonical(appliedPruning),
  ].join(":");

  // Compute SHA-256 (returns lowercase hex string)
  return sha256(input);
}
