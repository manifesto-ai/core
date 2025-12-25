/**
 * Path Similarity Analysis
 *
 * Detects similar paths for alias suggestions.
 * All analysis is deterministic (Principle E).
 *
 * This module implements the "Semantic Huffman Coding" concept:
 * - Frequently occurring patterns get shorter, more stable paths
 * - Similar paths are detected and suggested for aliasing
 */

import type { SemanticPath, Expression } from '@manifesto-ai/core';
import { analyzeExpression } from '@manifesto-ai/core';
import type { Fragment, DerivedFragment } from '../types/fragment.js';
import type { SimilarityType } from '../types/codebook.js';
import { getPathLocalName, getPathNamespace } from '../linker/normalizer.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Path similarity result
 */
export interface PathSimilarity {
  pathA: SemanticPath;
  pathB: SemanticPath;
  score: number; // 0-1
  type: SimilarityType;
  reason: string;
}

/**
 * Path frequency information
 */
export interface PathFrequency {
  path: SemanticPath;
  count: number;
}

/**
 * Path cluster
 */
export interface PathCluster {
  paths: SemanticPath[];
  centroid: SemanticPath;
  avgSimilarity: number;
}

// ============================================================================
// String Similarity Algorithms
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]![j - 1]! + 1, // substitution
          matrix[i]![j - 1]! + 1, // insertion
          matrix[i - 1]![j]! + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length]![a.length]!;
}

/**
 * Calculate string similarity (0-1, 1 being identical)
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Calculate Jaccard similarity between two sets of tokens
 */
export function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 1;
  return intersection.size / union.size;
}

/**
 * Tokenize a camelCase or snake_case string
 */
export function tokenize(str: string): string[] {
  // Split by camelCase boundaries and underscores/hyphens
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

// ============================================================================
// Path Similarity Functions
// ============================================================================

/**
 * Calculate semantic path similarity based on local names
 */
export function pathNameSimilarity(pathA: SemanticPath, pathB: SemanticPath): number {
  const localA = getPathLocalName(pathA);
  const localB = getPathLocalName(pathB);
  return stringSimilarity(localA, localB);
}

/**
 * Calculate path similarity based on tokens
 */
export function pathTokenSimilarity(pathA: SemanticPath, pathB: SemanticPath): number {
  const localA = getPathLocalName(pathA);
  const localB = getPathLocalName(pathB);
  const tokensA = tokenize(localA);
  const tokensB = tokenize(localB);
  return jaccardSimilarity(tokensA, tokensB);
}

/**
 * Check if two paths are in the same namespace
 */
export function sameNamespace(pathA: SemanticPath, pathB: SemanticPath): boolean {
  return getPathNamespace(pathA) === getPathNamespace(pathB);
}

/**
 * Calculate combined path similarity (weighted average of multiple metrics)
 */
export function combinedPathSimilarity(pathA: SemanticPath, pathB: SemanticPath): number {
  const nameSim = pathNameSimilarity(pathA, pathB);
  const tokenSim = pathTokenSimilarity(pathA, pathB);

  // Weight name similarity higher as it captures exact matches
  return nameSim * 0.6 + tokenSim * 0.4;
}

// ============================================================================
// Path Analysis Functions
// ============================================================================

/**
 * Find similar paths in a set of paths
 *
 * @param paths - All paths to analyze
 * @param threshold - Minimum similarity score (0-1)
 * @returns Array of similar path pairs
 */
export function findSimilarPaths(
  paths: SemanticPath[],
  threshold: number = 0.7
): PathSimilarity[] {
  const results: PathSimilarity[] = [];
  const uniquePaths = [...new Set(paths)].sort();

  for (let i = 0; i < uniquePaths.length; i++) {
    for (let j = i + 1; j < uniquePaths.length; j++) {
      const pathA = uniquePaths[i]!;
      const pathB = uniquePaths[j]!;

      // Only compare paths in the same namespace
      if (!sameNamespace(pathA, pathB)) {
        continue;
      }

      const similarity = combinedPathSimilarity(pathA, pathB);

      if (similarity >= threshold) {
        results.push({
          pathA,
          pathB,
          score: similarity,
          type: 'semantic',
          reason: `Local names are ${Math.round(similarity * 100)}% similar`,
        });
      }
    }
  }

  // Sort deterministically (by score descending, then by pathA)
  return results.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.pathA.localeCompare(b.pathA);
  });
}

/**
 * Find paths with similar expressions (for DerivedFragments)
 *
 * @param fragments - Fragments to analyze
 * @param threshold - Minimum similarity score (0-1)
 */
export function findSimilarExpressions(
  fragments: Fragment[],
  threshold: number = 0.8
): PathSimilarity[] {
  const results: PathSimilarity[] = [];

  const derivedFragments = fragments.filter(
    (f): f is DerivedFragment => f.kind === 'DerivedFragment'
  );

  for (let i = 0; i < derivedFragments.length; i++) {
    for (let j = i + 1; j < derivedFragments.length; j++) {
      const fragA = derivedFragments[i]!;
      const fragB = derivedFragments[j]!;

      // Compare expression structure
      const similarity = expressionSimilarity(fragA.expr, fragB.expr);

      if (similarity >= threshold) {
        results.push({
          pathA: fragA.path,
          pathB: fragB.path,
          score: similarity,
          type: 'expression',
          reason: `Expressions are ${Math.round(similarity * 100)}% structurally similar`,
        });
      }
    }
  }

  // Sort deterministically
  return results.sort((a, b) => {
    const scoreDiff = b.score - a.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.pathA.localeCompare(b.pathA);
  });
}

/**
 * Calculate expression similarity (structural comparison)
 */
export function expressionSimilarity(exprA: Expression, exprB: Expression): number {
  // Analyze both expressions
  const analysisA = analyzeExpression(exprA);
  const analysisB = analyzeExpression(exprB);

  // Compare dependencies
  const depsA = new Set(analysisA.directDeps);
  const depsB = new Set(analysisB.directDeps);

  const intersection = new Set([...depsA].filter((x) => depsB.has(x)));
  const union = new Set([...depsA, ...depsB]);

  if (union.size === 0) return 1; // Both have no deps

  const depSimilarity = intersection.size / union.size;

  // Compare structure (serialized form with normalized paths)
  const strA = JSON.stringify(normalizeExpression(exprA));
  const strB = JSON.stringify(normalizeExpression(exprB));
  const structSimilarity = stringSimilarity(strA, strB);

  // Weighted average
  return depSimilarity * 0.4 + structSimilarity * 0.6;
}

/**
 * Normalize expression for comparison (replace variable paths with placeholders)
 */
function normalizeExpression(expr: Expression): unknown {
  if (Array.isArray(expr)) {
    const [op, ...args] = expr;
    if (op === 'get') {
      return ['get', '<PATH>'];
    }
    // Cast args to array of expressions for recursive normalization
    return [op, ...(args as Expression[]).map(normalizeExpression)];
  }
  return expr;
}

// ============================================================================
// Path Frequency Analysis
// ============================================================================

/**
 * Find paths that are used frequently (candidates for canonical status)
 *
 * @param fragments - All fragments
 * @returns Paths sorted by usage count (descending)
 */
export function findFrequentPaths(fragments: Fragment[]): PathFrequency[] {
  const pathCounts = new Map<SemanticPath, number>();

  for (const fragment of fragments) {
    // Count requires
    for (const req of fragment.requires) {
      pathCounts.set(req, (pathCounts.get(req) || 0) + 1);
    }

    // Count provides (excluding action and effect prefixes)
    for (const prov of fragment.provides) {
      if (!prov.startsWith('action:') && !prov.startsWith('effect:')) {
        pathCounts.set(prov as SemanticPath, (pathCounts.get(prov as SemanticPath) || 0) + 1);
      }
    }
  }

  return [...pathCounts.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => {
      const countDiff = b.count - a.count;
      if (countDiff !== 0) return countDiff;
      return a.path.localeCompare(b.path);
    });
}

/**
 * Get all unique paths from fragments
 */
export function getAllPaths(fragments: Fragment[]): SemanticPath[] {
  const paths = new Set<SemanticPath>();

  for (const fragment of fragments) {
    for (const req of fragment.requires) {
      paths.add(req);
    }
    for (const prov of fragment.provides) {
      if (!prov.startsWith('action:') && !prov.startsWith('effect:')) {
        paths.add(prov as SemanticPath);
      }
    }
  }

  return [...paths].sort();
}

// ============================================================================
// Path Clustering
// ============================================================================

/**
 * Cluster similar paths together
 *
 * Uses a simple clustering approach based on similarity threshold.
 * Paths in the same cluster are candidates for aliasing to a common canonical path.
 */
export function clusterSimilarPaths(
  paths: SemanticPath[],
  threshold: number = 0.7
): PathCluster[] {
  const uniquePaths = [...new Set(paths)].sort();
  const clusters: PathCluster[] = [];
  const assigned = new Set<SemanticPath>();

  for (const path of uniquePaths) {
    if (assigned.has(path)) continue;

    // Find all similar paths
    const cluster: SemanticPath[] = [path];
    assigned.add(path);

    for (const other of uniquePaths) {
      if (assigned.has(other)) continue;
      if (!sameNamespace(path, other)) continue;

      const similarity = combinedPathSimilarity(path, other);
      if (similarity >= threshold) {
        cluster.push(other);
        assigned.add(other);
      }
    }

    if (cluster.length > 1) {
      // Choose shortest path as centroid (Huffman-like: common = short)
      const centroid = cluster.reduce((a, b) => (a.length <= b.length ? a : b));

      // Calculate average similarity
      let totalSim = 0;
      let count = 0;
      for (let i = 0; i < cluster.length; i++) {
        for (let j = i + 1; j < cluster.length; j++) {
          totalSim += combinedPathSimilarity(cluster[i]!, cluster[j]!);
          count++;
        }
      }
      const avgSimilarity = count > 0 ? totalSim / count : 1;

      clusters.push({
        paths: cluster.sort(),
        centroid,
        avgSimilarity,
      });
    }
  }

  // Sort clusters by size (descending), then by centroid
  return clusters.sort((a, b) => {
    const sizeDiff = b.paths.length - a.paths.length;
    if (sizeDiff !== 0) return sizeDiff;
    return a.centroid.localeCompare(b.centroid);
  });
}

/**
 * Find clusters by expression similarity
 */
export function clusterByExpression(
  fragments: Fragment[],
  threshold: number = 0.8
): PathCluster[] {
  const derivedFragments = fragments.filter(
    (f): f is DerivedFragment => f.kind === 'DerivedFragment'
  );

  // Group by expression structure
  const exprGroups = new Map<string, SemanticPath[]>();

  for (const frag of derivedFragments) {
    const normalizedExpr = JSON.stringify(normalizeExpression(frag.expr));
    const existing = exprGroups.get(normalizedExpr) || [];
    existing.push(frag.path);
    exprGroups.set(normalizedExpr, existing);
  }

  const clusters: PathCluster[] = [];

  for (const [, paths] of exprGroups) {
    if (paths.length > 1) {
      const sortedPaths = paths.sort();
      const centroid = sortedPaths.reduce((a, b) => (a.length <= b.length ? a : b));

      clusters.push({
        paths: sortedPaths,
        centroid,
        avgSimilarity: 1.0, // Same expression = perfect similarity
      });
    }
  }

  return clusters.sort((a, b) => {
    const sizeDiff = b.paths.length - a.paths.length;
    if (sizeDiff !== 0) return sizeDiff;
    return a.centroid.localeCompare(b.centroid);
  });
}

// ============================================================================
// Duplicate Detection
// ============================================================================

/**
 * Detect paths that should definitely be aliases (identical expressions)
 */
export function detectDuplicatePaths(
  fragments: Fragment[]
): Array<{
  paths: SemanticPath[];
  reason: string;
  confidence: number;
}> {
  const duplicates: Array<{
    paths: SemanticPath[];
    reason: string;
    confidence: number;
  }> = [];

  // Find DerivedFragments with identical expressions
  const derivedByExpr = new Map<string, SemanticPath[]>();

  for (const fragment of fragments) {
    if (fragment.kind === 'DerivedFragment') {
      const exprKey = JSON.stringify(fragment.expr);
      const existing = derivedByExpr.get(exprKey) || [];
      existing.push(fragment.path);
      derivedByExpr.set(exprKey, existing);
    }
  }

  for (const [, paths] of derivedByExpr) {
    if (paths.length > 1) {
      duplicates.push({
        paths: paths.sort(),
        reason: 'Identical derived expressions',
        confidence: 1.0,
      });
    }
  }

  return duplicates.sort((a, b) => {
    const confDiff = b.confidence - a.confidence;
    if (confDiff !== 0) return confDiff;
    return (a.paths[0] ?? '').localeCompare(b.paths[0] ?? '');
  });
}

export default {
  // String similarity
  levenshteinDistance,
  stringSimilarity,
  jaccardSimilarity,
  tokenize,
  // Path similarity
  pathNameSimilarity,
  pathTokenSimilarity,
  sameNamespace,
  combinedPathSimilarity,
  // Path analysis
  findSimilarPaths,
  findSimilarExpressions,
  expressionSimilarity,
  // Frequency analysis
  findFrequentPaths,
  getAllPaths,
  // Clustering
  clusterSimilarPaths,
  clusterByExpression,
  // Duplicate detection
  detectDuplicatePaths,
};
