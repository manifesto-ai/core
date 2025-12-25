/**
 * Alias Hint Generator
 *
 * Generates PatchHints for potential path aliases.
 * All suggestions are HINTS ONLY - never auto-applied.
 *
 * CRITICAL INVARIANT: This module ONLY generates suggestions.
 * Actual application requires explicit user/agent action via PatchOp.
 *
 * This implements "Semantic Huffman Coding":
 * - Frequently occurring patterns get shorter, more stable paths
 * - Similar paths are suggested for aliasing to reduce semantic space pollution
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { Fragment, FragmentId } from '../types/fragment.js';
import type { PatchHint } from '../types/patch.js';
import type {
  AliasSuggestion,
  CodebookAnalysisResult,
  CodebookAnalysisStats,
  AliasHintConfig,
  SimilarityType,
} from '../types/codebook.js';
import { DEFAULT_ALIAS_HINT_CONFIG, createAliasSuggestion } from '../types/codebook.js';
import {
  findSimilarPaths,
  findSimilarExpressions,
  findFrequentPaths,
  clusterSimilarPaths,
  clusterByExpression,
  detectDuplicatePaths,
  getAllPaths,
  type PathSimilarity,
  type PathFrequency,
} from './similarity.js';
import { sortFragmentsByStableId } from '../linker/normalizer.js';

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze fragments for potential aliases
 *
 * This is the main entry point for alias suggestion generation.
 * Returns suggestions but does NOT apply them.
 *
 * CRITICAL: This function ONLY analyzes and suggests. It NEVER modifies fragments.
 */
export function analyzeForAliases(
  fragments: Fragment[],
  config: AliasHintConfig = {}
): CodebookAnalysisResult {
  const cfg = { ...DEFAULT_ALIAS_HINT_CONFIG, ...config };

  // Sort for determinism (Principle E)
  const sortedFragments = sortFragmentsByStableId(fragments);

  // Collect all paths
  const allPaths = getAllPaths(sortedFragments);

  // Find frequent paths (candidates for canonical status)
  const frequentPaths = findFrequentPaths(sortedFragments);

  // Find similar paths by name
  const nameSimilarities = findSimilarPaths(allPaths, cfg.nameSimilarityThreshold);

  // Find similar paths by expression
  const exprSimilarities = findSimilarExpressions(
    sortedFragments,
    cfg.expressionSimilarityThreshold
  );

  // Cluster similar paths
  const pathClusters = clusterSimilarPaths(allPaths, cfg.nameSimilarityThreshold);
  const exprClusters = clusterByExpression(sortedFragments, cfg.expressionSimilarityThreshold);

  // Merge clusters (prioritize expression clusters)
  const allClusters = mergeClusterResults(pathClusters, exprClusters);

  // Generate suggestions from similarities
  const suggestions = generateSuggestionsFromSimilarities(
    nameSimilarities,
    exprSimilarities,
    frequentPaths,
    sortedFragments,
    cfg
  );

  // Filter and limit suggestions
  const filteredSuggestions = suggestions
    .filter((s) => s.confidence >= cfg.minConfidence)
    .slice(0, cfg.maxSuggestions);

  // Calculate stats
  const uniquePaths = new Set(allPaths);
  const potentialSavings = allClusters.reduce((acc, c) => acc + c.paths.length - 1, 0);
  const estimatedCompression = uniquePaths.size > 0 ? potentialSavings / uniquePaths.size : 0;

  const stats: CodebookAnalysisStats = {
    totalPaths: allPaths.length,
    uniquePaths: uniquePaths.size,
    potentialAliases: filteredSuggestions.length,
    estimatedCompression: Math.min(estimatedCompression, 1),
  };

  return {
    suggestions: filteredSuggestions,
    frequentPaths: frequentPaths.slice(0, 20),
    clusters: allClusters.map((c) => ({
      paths: c.paths,
      suggestedCanonical: c.centroid,
      confidence: c.avgSimilarity,
    })),
    stats,
  };
}

// ============================================================================
// Suggestion Generation
// ============================================================================

/**
 * Generate alias suggestions from similarity results
 */
function generateSuggestionsFromSimilarities(
  nameSimilarities: PathSimilarity[],
  exprSimilarities: PathSimilarity[],
  frequentPaths: PathFrequency[],
  fragments: Fragment[],
  config: Required<AliasHintConfig>
): AliasSuggestion[] {
  const suggestions: AliasSuggestion[] = [];
  const frequencyMap = new Map(frequentPaths.map((p) => [p.path, p.count]));

  // Process name similarities
  for (const sim of nameSimilarities) {
    const canonical = chooseCanonical(sim.pathA, sim.pathB, frequencyMap, config);
    const alias = canonical === sim.pathA ? sim.pathB : sim.pathA;

    const affectedFragments = getAffectedFragments(alias, fragments);

    suggestions.push(
      createAliasSuggestion(alias, canonical, {
        confidence: sim.score * 0.9, // Slight discount for name-based
        rationale: `Similar path names: ${sim.reason}`,
        affectedFragments,
        similarityScore: sim.score,
        similarityType: 'semantic',
      })
    );
  }

  // Process expression similarities (higher confidence)
  for (const sim of exprSimilarities) {
    const canonical = chooseCanonical(sim.pathA, sim.pathB, frequencyMap, config);
    const alias = canonical === sim.pathA ? sim.pathB : sim.pathA;

    const affectedFragments = getAffectedFragments(alias, fragments);

    suggestions.push(
      createAliasSuggestion(alias, canonical, {
        confidence: sim.score, // Expression similarity gets full score
        rationale: `Similar expression structure: ${sim.reason}`,
        affectedFragments,
        similarityScore: sim.score,
        similarityType: 'expression',
      })
    );
  }

  // Deduplicate and sort
  return deduplicateSuggestions(suggestions);
}

/**
 * Choose which path should be canonical
 *
 * Uses Huffman-like heuristics:
 * - More frequent paths → more likely canonical
 * - Shorter paths → more likely canonical
 */
function chooseCanonical(
  pathA: SemanticPath,
  pathB: SemanticPath,
  frequencyMap: Map<SemanticPath, number>,
  config: Required<AliasHintConfig>
): SemanticPath {
  const freqA = frequencyMap.get(pathA) || 0;
  const freqB = frequencyMap.get(pathB) || 0;

  // Prefer more frequent path
  if (config.preferFrequentPaths && freqA !== freqB) {
    return freqA > freqB ? pathA : pathB;
  }

  // Prefer shorter path
  if (config.preferShorterPaths && pathA.length !== pathB.length) {
    return pathA.length < pathB.length ? pathA : pathB;
  }

  // Alphabetical (deterministic fallback)
  return pathA < pathB ? pathA : pathB;
}

/**
 * Get fragments affected by aliasing a path
 */
function getAffectedFragments(path: SemanticPath, fragments: Fragment[]): FragmentId[] {
  const affected: FragmentId[] = [];

  for (const fragment of fragments) {
    if (fragment.requires.includes(path)) {
      affected.push(fragment.id);
    }
    if (fragment.provides.includes(path)) {
      affected.push(fragment.id);
    }
  }

  return [...new Set(affected)].sort();
}

/**
 * Deduplicate suggestions (keep highest confidence for same alias path)
 */
function deduplicateSuggestions(suggestions: AliasSuggestion[]): AliasSuggestion[] {
  const byAliasPath = new Map<string, AliasSuggestion>();

  for (const suggestion of suggestions) {
    const existing = byAliasPath.get(suggestion.aliasPath);
    if (!existing || suggestion.confidence > existing.confidence) {
      byAliasPath.set(suggestion.aliasPath, suggestion);
    }
  }

  return [...byAliasPath.values()].sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;
    return a.aliasPath.localeCompare(b.aliasPath);
  });
}

/**
 * Merge path clusters and expression clusters
 */
function mergeClusterResults(
  pathClusters: Array<{ paths: SemanticPath[]; centroid: SemanticPath; avgSimilarity: number }>,
  exprClusters: Array<{ paths: SemanticPath[]; centroid: SemanticPath; avgSimilarity: number }>
): Array<{ paths: SemanticPath[]; centroid: SemanticPath; avgSimilarity: number }> {
  // Prioritize expression clusters (more reliable)
  const result: Array<{
    paths: SemanticPath[];
    centroid: SemanticPath;
    avgSimilarity: number;
  }> = [];
  const usedPaths = new Set<SemanticPath>();

  // Add expression clusters first
  for (const cluster of exprClusters) {
    result.push(cluster);
    for (const path of cluster.paths) {
      usedPaths.add(path);
    }
  }

  // Add path clusters that don't overlap
  for (const cluster of pathClusters) {
    const overlaps = cluster.paths.some((p) => usedPaths.has(p));
    if (!overlaps) {
      result.push(cluster);
      for (const path of cluster.paths) {
        usedPaths.add(path);
      }
    }
  }

  return result.sort((a, b) => {
    const sizeDiff = b.paths.length - a.paths.length;
    if (sizeDiff !== 0) return sizeDiff;
    return a.centroid.localeCompare(b.centroid);
  });
}

// ============================================================================
// PatchHint Generation
// ============================================================================

/**
 * Generate PatchHints from alias suggestions
 *
 * Converts AliasSuggestions to the PatchHint format used by the linker.
 *
 * 헌법 제5조: 결정론적 알고리즘으로 생성되는 제안
 */
export function generateAliasHints(suggestions: AliasSuggestion[]): PatchHint[] {
  return suggestions.map((suggestion) => ({
    description: `Alias "${suggestion.aliasPath}" to "${suggestion.canonicalPath}"`,
    patch: {
      op: 'renamePath' as const,
      from: suggestion.aliasPath,
      to: suggestion.canonicalPath,
    },
    confidence: suggestion.confidence,
    rationale: suggestion.rationale,
    recommended: suggestion.confidence >= 0.8,
    origin: 'deterministic', // 헌법 제5조
  }));
}

/**
 * Suggest aliases for a specific path
 *
 * Useful when user selects a path and wants to see potential aliases.
 */
export function suggestAliasesForPath(
  targetPath: SemanticPath,
  fragments: Fragment[],
  config: AliasHintConfig = {}
): AliasSuggestion[] {
  const analysis = analyzeForAliases(fragments, config);

  return analysis.suggestions.filter(
    (s) => s.aliasPath === targetPath || s.canonicalPath === targetPath
  );
}

/**
 * Suggest canonical path for a given path
 *
 * Returns the suggested canonical path and alternatives.
 */
export function suggestCanonicalFor(
  targetPath: SemanticPath,
  fragments: Fragment[],
  config: AliasHintConfig = {}
): {
  canonical: SemanticPath | undefined;
  alternatives: Array<{ path: SemanticPath; confidence: number }>;
} {
  const analysis = analyzeForAliases(fragments, config);

  // Find suggestions where target is the alias
  const asAlias = analysis.suggestions.filter((s) => s.aliasPath === targetPath);

  // Find suggestions where target is the canonical
  const asCanonical = analysis.suggestions.filter((s) => s.canonicalPath === targetPath);

  if (asAlias.length > 0) {
    // Target should be aliased to something else
    const best = asAlias[0]!;
    return {
      canonical: best.canonicalPath,
      alternatives: asAlias.slice(1).map((s) => ({
        path: s.canonicalPath,
        confidence: s.confidence,
      })),
    };
  }

  if (asCanonical.length > 0) {
    // Target is already a good canonical choice
    return {
      canonical: targetPath,
      alternatives: [],
    };
  }

  return {
    canonical: undefined,
    alternatives: [],
  };
}

// ============================================================================
// Duplicate Detection Helpers
// ============================================================================

/**
 * Get duplicate path suggestions (highest confidence aliases)
 *
 * These are paths with identical expressions that should definitely be aliased.
 */
export function getDuplicatePathSuggestions(
  fragments: Fragment[]
): Array<{
  paths: SemanticPath[];
  reason: string;
  confidence: number;
  suggestedCanonical: SemanticPath;
}> {
  const duplicates = detectDuplicatePaths(fragments);
  const frequentPaths = findFrequentPaths(fragments);
  const frequencyMap = new Map(frequentPaths.map((p) => [p.path, p.count]));

  return duplicates.map((dup) => {
    // Choose canonical based on frequency and length
    const canonical = dup.paths.reduce((best, current) => {
      const bestFreq = frequencyMap.get(best) || 0;
      const currentFreq = frequencyMap.get(current) || 0;

      if (currentFreq > bestFreq) return current;
      if (currentFreq === bestFreq && current.length < best.length) return current;
      return best;
    });

    return {
      ...dup,
      suggestedCanonical: canonical,
    };
  });
}

/**
 * Generate suggestions from duplicate paths
 */
export function generateSuggestionsFromDuplicates(
  fragments: Fragment[]
): AliasSuggestion[] {
  const duplicates = getDuplicatePathSuggestions(fragments);
  const suggestions: AliasSuggestion[] = [];

  for (const dup of duplicates) {
    const canonical = dup.suggestedCanonical;

    for (const path of dup.paths) {
      if (path !== canonical) {
        const affectedFragments = getAffectedFragments(path, fragments);

        suggestions.push(
          createAliasSuggestion(path, canonical, {
            confidence: dup.confidence,
            rationale: dup.reason,
            affectedFragments,
            similarityScore: 1.0,
            similarityType: 'expression',
          })
        );
      }
    }
  }

  return suggestions.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;
    return a.aliasPath.localeCompare(b.aliasPath);
  });
}

// ============================================================================
// Analysis Summary
// ============================================================================

/**
 * Get a summary of alias analysis for display
 */
export function getAnalysisSummary(result: CodebookAnalysisResult): string {
  const lines: string[] = [];

  lines.push(`Alias Analysis Summary:`);
  lines.push(`- Total paths: ${result.stats.totalPaths}`);
  lines.push(`- Unique paths: ${result.stats.uniquePaths}`);
  lines.push(`- Potential aliases: ${result.stats.potentialAliases}`);
  lines.push(
    `- Estimated compression: ${Math.round(result.stats.estimatedCompression * 100)}%`
  );

  if (result.clusters.length > 0) {
    lines.push(`\nPath clusters (${result.clusters.length}):`);
    for (const cluster of result.clusters.slice(0, 5)) {
      lines.push(
        `  - ${cluster.suggestedCanonical} (${cluster.paths.length} paths, ${Math.round(cluster.confidence * 100)}% confidence)`
      );
    }
    if (result.clusters.length > 5) {
      lines.push(`  ... and ${result.clusters.length - 5} more clusters`);
    }
  }

  if (result.suggestions.length > 0) {
    lines.push(`\nTop suggestions (${result.suggestions.length}):`);
    for (const suggestion of result.suggestions.slice(0, 5)) {
      lines.push(
        `  - ${suggestion.aliasPath} -> ${suggestion.canonicalPath} (${Math.round(suggestion.confidence * 100)}%)`
      );
    }
    if (result.suggestions.length > 5) {
      lines.push(`  ... and ${result.suggestions.length - 5} more suggestions`);
    }
  }

  return lines.join('\n');
}

export default {
  // Main analysis
  analyzeForAliases,
  // PatchHint generation
  generateAliasHints,
  // Path-specific suggestions
  suggestAliasesForPath,
  suggestCanonicalFor,
  // Duplicate detection
  getDuplicatePathSuggestions,
  generateSuggestionsFromDuplicates,
  // Summary
  getAnalysisSummary,
};
