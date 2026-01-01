/**
 * Retrieval result types
 */

import type { SemanticPath } from "./common.js";
import type { TypeExpr } from "./type-system.js";

/** Retrieval tier */
export type RetrievalTier = 0 | 1 | 2;

/** Match type for anchor candidates */
export type MatchType = "exact" | "alias" | "fuzzy" | "semantic";

/** Anchor candidate from retrieval */
export interface AnchorCandidate {
  /** Path in schema */
  readonly path: SemanticPath;
  /** Match score (0.0 - 1.0) */
  readonly score: number;
  /** How the match was found */
  readonly matchType: MatchType;
  /** Type hint for validation */
  readonly typeHint: TypeExpr | null;
}

/** Result of retrieval stage */
export interface RetrievalResult {
  /** Retrieval tier used (0 = BM25, 1 = local vector, 2 = cloud) */
  readonly tier: RetrievalTier;
  /** Anchor candidates sorted by score */
  readonly candidates: readonly AnchorCandidate[];
  /** Query terms used for retrieval */
  readonly queryTerms: readonly string[];
}
