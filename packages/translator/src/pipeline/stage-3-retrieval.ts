/**
 * Stage 3: Retrieval
 *
 * Retrieves anchor candidates from TypeIndex based on normalized input.
 * Uses keyword extraction and path matching.
 *
 * Retrieval tiers:
 * - Tier 0: Offline/OSS (keyword matching)
 * - Tier 1: Local (semantic similarity with local embeddings)
 * - Tier 2: Cloud (semantic similarity with cloud API)
 *
 * Currently implements Tier 0 only.
 */

import type {
  NormalizationResult,
  RetrievalResult,
  RetrievalTrace,
  AnchorCandidate,
  TypeIndex,
  ResolvedType,
} from "../domain/index.js";
import type { PipelineState, StageResult } from "./types.js";

/**
 * Retrieval configuration
 */
export interface RetrievalConfig {
  /** Maximum candidates to return */
  maxCandidates: number;
  /** Minimum score threshold */
  minScore: number;
  /** Retrieval tier (0 = offline) */
  tier: 0 | 1 | 2;
}

const DEFAULT_CONFIG: RetrievalConfig = {
  maxCandidates: 10,
  minScore: 0.1,
  tier: 0,
};

/**
 * Execute retrieval stage
 */
export async function executeRetrieval(
  normalization: NormalizationResult,
  state: PipelineState,
  config: Partial<RetrievalConfig> = {}
): Promise<StageResult<RetrievalResult>> {
  const startTime = Date.now();
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    const candidates = retrieveAnchors(
      normalization.canonical,
      state.context.typeIndex,
      fullConfig
    );

    const durationMs = Date.now() - startTime;

    return {
      success: true,
      data: {
        candidates,
        tier: fullConfig.tier,
      },
      durationMs,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Retrieve anchor candidates using keyword matching (Tier 0)
 */
function retrieveAnchors(
  input: string,
  typeIndex: TypeIndex,
  config: RetrievalConfig
): AnchorCandidate[] {
  const keywords = extractKeywords(input);
  const candidates: AnchorCandidate[] = [];

  for (const [path, type] of Object.entries(typeIndex)) {
    const score = calculatePathScore(path, type, keywords, input);

    if (score >= config.minScore) {
      const matched = matchedKeywords(path, keywords);
      candidates.push({
        path,
        score,
        matchType: matched.length > 0 ? "fuzzy" : "semantic",
        evidence: matched.map((k) => `Matched keyword: ${k}`),
        resolvedType: type,
      });
    }
  }

  // Sort by score descending and limit
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, config.maxCandidates);
}

/**
 * Extract keywords from normalized input
 */
function extractKeywords(input: string): string[] {
  // Remove common stop words and extract meaningful terms
  const stopWords = new Set([
    "a", "an", "the", "to", "for", "of", "in", "on", "with",
    "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did",
    "will", "would", "could", "should", "can", "may", "might",
    "i", "you", "he", "she", "it", "we", "they",
    "this", "that", "these", "those",
    "add", "create", "make", "new", "update", "change", "set",
  ]);

  // Split on whitespace and punctuation
  const words = input
    .toLowerCase()
    .split(/[\s,.!?;:'"()\[\]{}]+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));

  // Also extract camelCase/snake_case parts from identifiers
  const allKeywords = new Set<string>();

  for (const word of words) {
    allKeywords.add(word);

    // Split camelCase
    const camelParts = word.split(/(?=[A-Z])/).map((p) => p.toLowerCase());
    for (const part of camelParts) {
      if (part.length > 1) allKeywords.add(part);
    }

    // Split snake_case
    const snakeParts = word.split("_").map((p) => p.toLowerCase());
    for (const part of snakeParts) {
      if (part.length > 1) allKeywords.add(part);
    }
  }

  return Array.from(allKeywords);
}

/**
 * Calculate score for a path based on keyword matching
 */
function calculatePathScore(
  path: string,
  type: ResolvedType,
  keywords: string[],
  input: string
): number {
  const pathLower = path.toLowerCase();
  const inputLower = input.toLowerCase();

  let score = 0;
  let matchCount = 0;

  // Score based on keyword matches in path
  for (const keyword of keywords) {
    if (pathLower.includes(keyword)) {
      matchCount++;
      // Bonus for exact segment match
      const segments = pathLower.split(".");
      if (segments.some((s) => s === keyword)) {
        score += 0.3;
      } else {
        score += 0.1;
      }
    }
  }

  // Bonus for path depth (prefer deeper paths for more specific matches)
  const depth = path.split(".").length;
  if (matchCount > 0 && depth > 1) {
    score += 0.05 * Math.min(depth - 1, 3);
  }

  // Bonus for type-related keywords
  const typeKind = typeof type === "object" ? type.kind : type;
  if (typeKind === "primitive") {
    const typeName = (type as any).name?.toLowerCase();
    if (typeName && inputLower.includes(typeName)) {
      score += 0.1;
    }
  }

  // Bonus if the path contains common operation targets
  if (pathLower.includes("state.")) {
    score += 0.05;
  }

  // Normalize score
  return Math.min(score, 1.0);
}

/**
 * Get keywords that matched in a path
 */
function matchedKeywords(path: string, keywords: string[]): string[] {
  const pathLower = path.toLowerCase();
  return keywords.filter((k) => pathLower.includes(k));
}

/**
 * Create retrieval trace
 */
export function createRetrievalTrace(
  result: RetrievalResult,
  durationMs: number
): RetrievalTrace {
  return {
    tier: result.tier,
    candidateCount: result.candidates.length,
    topScore: result.candidates[0]?.score,
    durationMs,
  };
}
