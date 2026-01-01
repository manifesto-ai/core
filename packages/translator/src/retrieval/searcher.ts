/**
 * Retrieval Searcher
 * Searches the index and returns scored candidates
 */

import type { AnchorCandidate, TypeExpr, MatchType } from "../types/index.js";
import type { RetrievalIndex, SearchOptions } from "./types.js";

/** Default max candidates */
const DEFAULT_MAX_CANDIDATES = 5;

/** Scoring weights per SPEC */
const WEIGHTS = {
  bm25: 0.4,
  alias: 0.3,
  type: 0.2,
  recency: 0.1,
};

/**
 * Determine match type based on how the result was found
 */
function determineMatchType(
  path: string,
  queryTerms: string[],
  index: RetrievalIndex
): MatchType {
  const field = index.schemaInfo.fields[path];
  if (!field) return "fuzzy";

  // Check for exact field name match
  for (const term of queryTerms) {
    if (field.name.toLowerCase() === term.toLowerCase()) {
      return "exact";
    }
  }

  // Check for alias match
  for (const term of queryTerms) {
    const normalizedTerm = term.toLowerCase();
    const aliasPaths = index.aliasTable.get(normalizedTerm);
    if (aliasPaths && aliasPaths.includes(path)) {
      return "alias";
    }
  }

  // Default to fuzzy
  return "fuzzy";
}

/**
 * Calculate alias match score
 */
function calculateAliasScore(
  path: string,
  queryTerms: string[],
  index: RetrievalIndex
): number {
  let score = 0;
  for (const term of queryTerms) {
    const normalizedTerm = term.toLowerCase();
    const aliasPaths = index.aliasTable.get(normalizedTerm);
    if (aliasPaths && aliasPaths.includes(path)) {
      score += 1;
    }
  }
  return Math.min(score / queryTerms.length, 1);
}

/**
 * Calculate type match score (placeholder for now)
 */
function calculateTypeScore(path: string, index: RetrievalIndex): number {
  // For now, return a base score if type info exists
  const field = index.schemaInfo.fields[path];
  return field?.type ? 0.5 : 0;
}

/**
 * Get type hint for a path
 */
function getTypeHint(path: string, index: RetrievalIndex): TypeExpr | null {
  const field = index.schemaInfo.fields[path];
  return field?.type || null;
}

/**
 * Search alias table directly for terms
 */
function searchAliasDirect(
  index: RetrievalIndex,
  queryTerms: string[]
): Map<string, number> {
  const scores = new Map<string, number>();

  for (const term of queryTerms) {
    const normalizedTerm = term.toLowerCase();
    const paths = index.aliasTable.get(normalizedTerm);
    if (paths) {
      for (const path of paths) {
        const current = scores.get(path) || 0;
        scores.set(path, current + 1);
      }
    }
  }

  return scores;
}

/**
 * Search the index for matching anchors
 */
export function search(
  index: RetrievalIndex,
  queryTerms: string[],
  options: SearchOptions = {}
): AnchorCandidate[] {
  const maxCandidates = options.maxCandidates ?? DEFAULT_MAX_CANDIDATES;

  if (queryTerms.length === 0) {
    return [];
  }

  // First, check alias table directly for non-ASCII or special characters
  const aliasDirectScores = searchAliasDirect(index, queryTerms);

  // Build lunr query string for ASCII terms
  const asciiTerms = queryTerms.filter((term) => /^[a-zA-Z0-9_.]+$/.test(term));

  let lunrResults: lunr.Index.Result[] = [];

  if (asciiTerms.length > 0) {
    const queryString = asciiTerms
      .map((term) => {
        // For terms with dots (like "User.age"), split them
        if (term.includes(".")) {
          return term.split(".").join(" ");
        }
        // Add wildcard for partial matching
        return `${term}*`;
      })
      .join(" ");

    try {
      lunrResults = index.lunrIndex.search(queryString);
    } catch {
      // Fallback to simple search
      try {
        lunrResults = index.lunrIndex.search(asciiTerms.join(" "));
      } catch {
        // Ignore
      }
    }
  }

  // Calculate combined scores and build candidates
  const candidateMap = new Map<string, AnchorCandidate>();
  const maxBm25Score = lunrResults.length > 0 ? lunrResults[0].score : 1;

  // Add candidates from lunr results
  for (const result of lunrResults) {
    const path = result.ref;

    // Normalize BM25 score to 0-1
    const normalizedBm25 = maxBm25Score > 0 ? result.score / maxBm25Score : 0;

    // Calculate component scores
    const aliasScore = calculateAliasScore(path, queryTerms, index);
    const typeScore = calculateTypeScore(path, index);
    const recencyScore = 0.5; // Placeholder - would use actual recency in production

    // Combined weighted score
    const combinedScore =
      WEIGHTS.bm25 * normalizedBm25 +
      WEIGHTS.alias * aliasScore +
      WEIGHTS.type * typeScore +
      WEIGHTS.recency * recencyScore;

    candidateMap.set(path, {
      path,
      score: Math.min(combinedScore, 1),
      matchType: determineMatchType(path, queryTerms, index),
      typeHint: getTypeHint(path, index),
    });
  }

  // Add candidates from direct alias search (for non-ASCII terms)
  for (const [path, aliasHits] of aliasDirectScores.entries()) {
    if (!candidateMap.has(path)) {
      // Calculate score without BM25 component
      const aliasScore = aliasHits / queryTerms.length;
      const typeScore = calculateTypeScore(path, index);
      const recencyScore = 0.5;

      const combinedScore =
        WEIGHTS.alias * aliasScore +
        WEIGHTS.type * typeScore +
        WEIGHTS.recency * recencyScore;

      candidateMap.set(path, {
        path,
        score: Math.min(combinedScore, 1),
        matchType: determineMatchType(path, queryTerms, index),
        typeHint: getTypeHint(path, index),
      });
    }
  }

  // Convert to array and sort by score descending
  const candidates = Array.from(candidateMap.values());
  candidates.sort((a, b) => b.score - a.score);

  // Apply limit
  return candidates.slice(0, maxCandidates);
}
