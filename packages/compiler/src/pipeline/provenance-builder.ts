/**
 * Provenance Builder - Fragment Origin Tracking
 *
 * Builds a provenance map from fragments, enabling:
 * - Origin tracking for debugging and explanation
 * - Audit trail for compliance
 * - Impact analysis for changes
 *
 * INVARIANT #4: 모든 출력에 출처 (All outputs must have provenance)
 */

import type { Fragment, FragmentId } from '../types/fragment.js';
import type { Provenance } from '../types/provenance.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Map from fragment ID to its provenance (origin)
 */
export type ProvenanceMap = Map<FragmentId, Provenance>;

// ============================================================================
// buildProvenanceMap
// ============================================================================

/**
 * Build a provenance map from fragments
 *
 * Creates a lookup table that maps each fragment's ID to its origin,
 * enabling quick provenance queries without traversing the fragment list.
 *
 * @param fragments - Fragments to build provenance from
 * @returns Map of fragment ID to provenance
 */
export function buildProvenanceMap(fragments: Fragment[]): ProvenanceMap {
  const provenance = new Map<FragmentId, Provenance>();

  for (const fragment of fragments) {
    provenance.set(fragment.id, fragment.origin);
  }

  return provenance;
}

/**
 * Merge multiple provenance maps
 *
 * Later maps override earlier ones for duplicate keys.
 *
 * @param maps - Provenance maps to merge
 * @returns Merged provenance map
 */
export function mergeProvenanceMaps(...maps: ProvenanceMap[]): ProvenanceMap {
  const merged = new Map<FragmentId, Provenance>();

  for (const map of maps) {
    for (const [id, provenance] of map) {
      merged.set(id, provenance);
    }
  }

  return merged;
}

/**
 * Get provenance for a fragment ID
 *
 * @param map - Provenance map to search
 * @param fragmentId - Fragment ID to look up
 * @returns Provenance if found, undefined otherwise
 */
export function getProvenance(
  map: ProvenanceMap,
  fragmentId: FragmentId
): Provenance | undefined {
  return map.get(fragmentId);
}
