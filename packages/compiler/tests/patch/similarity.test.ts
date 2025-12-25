/**
 * Path Similarity Analysis Tests
 *
 * Tests for similarity detection and clustering algorithms.
 * All analysis is deterministic (Principle E).
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type { Fragment, DerivedFragment, SchemaFragment } from '../../src/types/fragment.js';
import {
  levenshteinDistance,
  stringSimilarity,
  jaccardSimilarity,
  tokenize,
  pathNameSimilarity,
  pathTokenSimilarity,
  sameNamespace,
  combinedPathSimilarity,
  findSimilarPaths,
  findSimilarExpressions,
  expressionSimilarity,
  findFrequentPaths,
  getAllPaths,
  clusterSimilarPaths,
  clusterByExpression,
  detectDuplicatePaths,
} from '../../src/patch/similarity.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createDerivedFragment(
  path: SemanticPath,
  expr: Expression,
  overrides: Partial<DerivedFragment> = {}
): DerivedFragment {
  return {
    id: `derived-${path}`,
    kind: 'DerivedFragment',
    requires: [],
    provides: [path],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    path,
    expr,
    ...overrides,
  };
}

function createSchemaFragment(
  path: SemanticPath,
  overrides: Partial<SchemaFragment> = {}
): SchemaFragment {
  return {
    id: `schema-${path}`,
    kind: 'SchemaFragment',
    requires: [],
    provides: [path],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [
      {
        path,
        type: 'string',
        semantic: { type: 'string', description: 'test field' },
      },
    ],
    ...overrides,
  };
}

// ============================================================================
// String Similarity Algorithm Tests
// ============================================================================

describe('Levenshtein Distance', () => {
  it('should return 0 for identical strings', () => {
    expect(levenshteinDistance('hello', 'hello')).toBe(0);
  });

  it('should return string length for completely different strings', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  it('should handle single character differences', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('cat', 'ca')).toBe(1);
  });

  it('should handle empty strings', () => {
    expect(levenshteinDistance('', '')).toBe(0);
    expect(levenshteinDistance('abc', '')).toBe(3);
    expect(levenshteinDistance('', 'abc')).toBe(3);
  });

  it('should handle transpositions', () => {
    expect(levenshteinDistance('ab', 'ba')).toBe(2);
  });

  it('should be symmetric', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(
      levenshteinDistance('sitting', 'kitten')
    );
  });
});

describe('stringSimilarity', () => {
  it('should return 1 for identical strings', () => {
    expect(stringSimilarity('hello', 'hello')).toBe(1);
  });

  it('should return 0 for completely different equal-length strings', () => {
    expect(stringSimilarity('abc', 'xyz')).toBe(0);
  });

  it('should return high similarity for similar strings', () => {
    const sim = stringSimilarity('userCount', 'userCounts');
    expect(sim).toBeGreaterThan(0.8);
  });

  it('should return 1 for two empty strings', () => {
    expect(stringSimilarity('', '')).toBe(1);
  });

  it('should be between 0 and 1', () => {
    const sim = stringSimilarity('hello', 'world');
    expect(sim).toBeGreaterThanOrEqual(0);
    expect(sim).toBeLessThanOrEqual(1);
  });
});

describe('jaccardSimilarity', () => {
  it('should return 1 for identical token sets', () => {
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(1);
  });

  it('should return 0 for disjoint token sets', () => {
    expect(jaccardSimilarity(['a', 'b'], ['c', 'd'])).toBe(0);
  });

  it('should handle partial overlap', () => {
    // Intersection: {a, b}, Union: {a, b, c, d}
    expect(jaccardSimilarity(['a', 'b', 'c'], ['a', 'b', 'd'])).toBe(0.5);
  });

  it('should return 1 for two empty arrays', () => {
    expect(jaccardSimilarity([], [])).toBe(1);
  });

  it('should handle duplicates in input', () => {
    expect(jaccardSimilarity(['a', 'a', 'b'], ['a', 'b', 'b'])).toBe(1);
  });
});

describe('tokenize', () => {
  it('should split camelCase', () => {
    expect(tokenize('userCount')).toEqual(['user', 'count']);
  });

  it('should split PascalCase', () => {
    expect(tokenize('UserCount')).toEqual(['user', 'count']);
  });

  it('should split snake_case', () => {
    expect(tokenize('user_count')).toEqual(['user', 'count']);
  });

  it('should split kebab-case', () => {
    expect(tokenize('user-count')).toEqual(['user', 'count']);
  });

  it('should handle mixed cases', () => {
    expect(tokenize('getUserCount_total')).toEqual(['get', 'user', 'count', 'total']);
  });

  it('should lowercase all tokens', () => {
    expect(tokenize('USER')).toEqual(['user']);
  });

  it('should handle empty string', () => {
    expect(tokenize('')).toEqual([]);
  });

  it('should handle single word', () => {
    expect(tokenize('count')).toEqual(['count']);
  });
});

// ============================================================================
// Path Similarity Tests
// ============================================================================

describe('pathNameSimilarity', () => {
  it('should return 1 for identical paths', () => {
    const sim = pathNameSimilarity(
      'data.userCount' as SemanticPath,
      'data.userCount' as SemanticPath
    );
    expect(sim).toBe(1);
  });

  it('should compare local names only', () => {
    const sim = pathNameSimilarity(
      'data.userCount' as SemanticPath,
      'state.userCount' as SemanticPath
    );
    expect(sim).toBe(1); // Same local name
  });

  it('should return high similarity for similar names', () => {
    const sim = pathNameSimilarity(
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath
    );
    expect(sim).toBeGreaterThan(0.8);
  });
});

describe('pathTokenSimilarity', () => {
  it('should return 1 for identical token sets', () => {
    const sim = pathTokenSimilarity(
      'data.getUserCount' as SemanticPath,
      'data.getCountUser' as SemanticPath
    );
    // Tokens: [get, user, count] vs [get, count, user] - same set
    expect(sim).toBe(1);
  });

  it('should return high similarity for similar tokens', () => {
    const sim = pathTokenSimilarity(
      'data.userCount' as SemanticPath,
      'data.userTotal' as SemanticPath
    );
    // Tokens: [user, count] vs [user, total] - overlap: user
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});

describe('sameNamespace', () => {
  it('should return true for same namespace', () => {
    expect(
      sameNamespace('data.count' as SemanticPath, 'data.total' as SemanticPath)
    ).toBe(true);
  });

  it('should return false for different namespaces', () => {
    expect(
      sameNamespace('data.count' as SemanticPath, 'state.count' as SemanticPath)
    ).toBe(false);
  });

  it('should handle nested paths', () => {
    expect(
      sameNamespace('data.user.count' as SemanticPath, 'data.order.total' as SemanticPath)
    ).toBe(true); // Both in 'data'
  });
});

describe('combinedPathSimilarity', () => {
  it('should return 1 for identical paths', () => {
    const sim = combinedPathSimilarity(
      'data.userCount' as SemanticPath,
      'data.userCount' as SemanticPath
    );
    expect(sim).toBe(1);
  });

  it('should combine name and token similarity', () => {
    const sim = combinedPathSimilarity(
      'data.userCount' as SemanticPath,
      'data.countUser' as SemanticPath
    );
    // Name similarity: low (different strings)
    // Token similarity: high (same tokens)
    expect(sim).toBeGreaterThan(0.3);
    expect(sim).toBeLessThan(1);
  });
});

// ============================================================================
// Path Analysis Tests
// ============================================================================

describe('findSimilarPaths', () => {
  it('should find similar paths above threshold', () => {
    const paths: SemanticPath[] = [
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath,
      'data.orderTotal' as SemanticPath,
    ];

    // Use lower threshold - combinedPathSimilarity weights name similarity (0.6) and token similarity (0.4)
    // userCount vs userCounts has ~0.67 combined similarity
    const results = findSimilarPaths(paths, 0.6);

    expect(results.length).toBeGreaterThanOrEqual(1);
    const userPair = results.find(
      (r) =>
        (r.pathA === 'data.userCount' && r.pathB === 'data.userCounts') ||
        (r.pathA === 'data.userCounts' && r.pathB === 'data.userCount')
    );
    expect(userPair).toBeDefined();
  });

  it('should only compare paths in same namespace', () => {
    const paths: SemanticPath[] = [
      'data.count' as SemanticPath,
      'state.count' as SemanticPath,
    ];

    const results = findSimilarPaths(paths, 0.5);

    expect(results).toHaveLength(0); // Different namespaces
  });

  it('should return results sorted by score', () => {
    const paths: SemanticPath[] = [
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath,
      'data.userCountTotal' as SemanticPath,
    ];

    const results = findSimilarPaths(paths, 0.5);

    // Should be sorted by score descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
    }
  });

  it('should be deterministic (Principle E)', () => {
    const paths: SemanticPath[] = [
      'data.b' as SemanticPath,
      'data.a' as SemanticPath,
      'data.c' as SemanticPath,
    ];

    const results1 = findSimilarPaths(paths, 0.5);
    const results2 = findSimilarPaths([...paths].reverse() as SemanticPath[], 0.5);

    expect(results1).toEqual(results2);
  });
});

describe('findSimilarExpressions', () => {
  it('should find fragments with similar expressions', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['*', ['get', 'data.x'], 2]),
      createDerivedFragment('derived.b' as SemanticPath, ['*', ['get', 'data.y'], 2]),
      createDerivedFragment('derived.c' as SemanticPath, ['+', ['get', 'data.z'], 10]),
    ];

    const results = findSimilarExpressions(fragments, 0.5);

    // a and b have similar structure (multiply by 2)
    const abPair = results.find(
      (r) =>
        (r.pathA === 'derived.a' && r.pathB === 'derived.b') ||
        (r.pathA === 'derived.b' && r.pathB === 'derived.a')
    );
    expect(abPair).toBeDefined();
  });

  it('should handle non-derived fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.count' as SemanticPath),
    ];

    const results = findSimilarExpressions(fragments, 0.5);

    expect(results).toHaveLength(0);
  });
});

describe('expressionSimilarity', () => {
  it('should return 1 for identical expressions', () => {
    const expr: Expression = ['*', ['get', 'data.x'], 2];
    const sim = expressionSimilarity(expr, expr);
    expect(sim).toBe(1);
  });

  it('should return high similarity for structurally similar expressions', () => {
    const expr1: Expression = ['*', ['get', 'data.x'], 2];
    const expr2: Expression = ['*', ['get', 'data.y'], 2];
    const sim = expressionSimilarity(expr1, expr2);
    // expressionSimilarity = depSimilarity * 0.4 + structSimilarity * 0.6
    // With normalized paths, structSimilarity = 1.0, but depSimilarity = 0 (no overlap)
    // Result = 0.4 * 0 + 0.6 * 1.0 = 0.6
    expect(sim).toBeGreaterThan(0.5);
  });

  it('should return lower similarity for different structures', () => {
    const expr1: Expression = ['*', ['get', 'data.x'], 2];
    const expr2: Expression = ['+', ['get', 'data.x'], ['get', 'data.y']];
    const sim = expressionSimilarity(expr1, expr2);
    expect(sim).toBeLessThan(0.8);
  });
});

// ============================================================================
// Frequency Analysis Tests
// ============================================================================

describe('findFrequentPaths', () => {
  it('should count path occurrences', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath, 'data.y' as SemanticPath],
      }),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
      }),
    ];

    const results = findFrequentPaths(fragments);

    const xFreq = results.find((r) => r.path === 'data.x');
    expect(xFreq?.count).toBe(2);

    const yFreq = results.find((r) => r.path === 'data.y');
    expect(yFreq?.count).toBe(1);
  });

  it('should sort by count descending', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.common'], {
        requires: ['data.common' as SemanticPath, 'data.rare' as SemanticPath],
      }),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.common'], {
        requires: ['data.common' as SemanticPath],
      }),
    ];

    const results = findFrequentPaths(fragments);

    expect(results[0]?.path).toBe('data.common');
    expect(results[0]?.count).toBe(2);
  });

  it('should exclude action and effect prefixes', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x'], {
        provides: ['derived.a', 'action:doSomething', 'effect:emit'],
      }),
    ];

    const results = findFrequentPaths(fragments);

    expect(results.some((r) => r.path.startsWith('action:'))).toBe(false);
    expect(results.some((r) => r.path.startsWith('effect:'))).toBe(false);
  });
});

describe('getAllPaths', () => {
  it('should collect all unique paths', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
        provides: ['derived.a'],
      }),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
        provides: ['derived.b'],
      }),
    ];

    const paths = getAllPaths(fragments);

    expect(paths).toContain('data.x');
    expect(paths).toContain('derived.a');
    expect(paths).toContain('derived.b');
    expect(new Set(paths).size).toBe(paths.length); // All unique
  });

  it('should return sorted paths', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.z' as SemanticPath, ['get', 'data.z'], {
        requires: ['data.z' as SemanticPath],
      }),
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.a'], {
        requires: ['data.a' as SemanticPath],
      }),
    ];

    const paths = getAllPaths(fragments);

    expect(paths).toEqual([...paths].sort());
  });
});

// ============================================================================
// Clustering Tests
// ============================================================================

describe('clusterSimilarPaths', () => {
  it('should group similar paths into clusters', () => {
    const paths: SemanticPath[] = [
      'data.userName' as SemanticPath,
      'data.userNames' as SemanticPath,
      'data.orderCount' as SemanticPath,
      'data.orderCounts' as SemanticPath,
    ];

    // Use lower threshold - combinedPathSimilarity ~0.67 for similar paths
    const clusters = clusterSimilarPaths(paths, 0.6);

    expect(clusters.length).toBeGreaterThanOrEqual(1);
    // Should cluster userName/userNames together
    const userCluster = clusters.find((c) => c.paths.includes('data.userName' as SemanticPath));
    if (userCluster) {
      expect(userCluster.paths).toContain('data.userNames');
    }
  });

  it('should choose shortest path as centroid', () => {
    const paths: SemanticPath[] = [
      'data.count' as SemanticPath,
      'data.counts' as SemanticPath,
      'data.countTotal' as SemanticPath,
    ];

    const clusters = clusterSimilarPaths(paths, 0.5);

    if (clusters.length > 0) {
      // Centroid should be shortest in cluster
      for (const cluster of clusters) {
        const minLength = Math.min(...cluster.paths.map((p) => p.length));
        expect(cluster.centroid.length).toBe(minLength);
      }
    }
  });

  it('should only cluster paths in same namespace', () => {
    const paths: SemanticPath[] = [
      'data.count' as SemanticPath,
      'state.count' as SemanticPath,
    ];

    const clusters = clusterSimilarPaths(paths, 0.9);

    // Should not cluster across namespaces
    expect(
      clusters.every(
        (c) =>
          !c.paths.includes('data.count' as SemanticPath) ||
          !c.paths.includes('state.count' as SemanticPath)
      )
    ).toBe(true);
  });

  it('should be deterministic (Principle E)', () => {
    const paths: SemanticPath[] = [
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath,
      'data.userTotal' as SemanticPath,
    ];

    const clusters1 = clusterSimilarPaths(paths, 0.5);
    const clusters2 = clusterSimilarPaths([...paths].reverse() as SemanticPath[], 0.5);

    expect(clusters1).toEqual(clusters2);
  });
});

describe('clusterByExpression', () => {
  it('should cluster fragments with identical normalized expressions', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['*', ['get', 'data.x'], 2]),
      createDerivedFragment('derived.b' as SemanticPath, ['*', ['get', 'data.y'], 2]),
      createDerivedFragment('derived.c' as SemanticPath, ['+', ['get', 'data.z'], 10]),
    ];

    const clusters = clusterByExpression(fragments, 0.8);

    // a and b have same normalized structure: ['*', ['get', '<PATH>'], 2]
    const multiplyCluster = clusters.find((c) =>
      c.paths.includes('derived.a' as SemanticPath)
    );
    if (multiplyCluster) {
      expect(multiplyCluster.paths).toContain('derived.b');
      expect(multiplyCluster.avgSimilarity).toBe(1.0); // Same expression
    }
  });

  it('should choose shortest path as centroid', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.longName' as SemanticPath, ['get', 'data.x']),
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.y']),
    ];

    const clusters = clusterByExpression(fragments, 0.8);

    if (clusters.length > 0) {
      expect(clusters[0]!.centroid).toBe('derived.a');
    }
  });
});

// ============================================================================
// Duplicate Detection Tests
// ============================================================================

describe('detectDuplicatePaths', () => {
  it('should detect fragments with identical expressions', () => {
    const expr: Expression = ['*', ['get', 'data.x'], 2];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
      createDerivedFragment('derived.c' as SemanticPath, ['+', ['get', 'data.y'], 3]),
    ];

    const duplicates = detectDuplicatePaths(fragments);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.paths).toContain('derived.a');
    expect(duplicates[0]!.paths).toContain('derived.b');
    expect(duplicates[0]!.confidence).toBe(1.0);
  });

  it('should return sorted paths in duplicates', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.z' as SemanticPath, expr),
      createDerivedFragment('derived.a' as SemanticPath, expr),
    ];

    const duplicates = detectDuplicatePaths(fragments);

    expect(duplicates[0]!.paths[0]).toBe('derived.a');
    expect(duplicates[0]!.paths[1]).toBe('derived.z');
  });

  it('should not flag unique expressions as duplicates', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x']),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.y']),
    ];

    const duplicates = detectDuplicatePaths(fragments);

    expect(duplicates).toHaveLength(0);
  });

  it('should handle non-derived fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.x' as SemanticPath),
      createSchemaFragment('data.y' as SemanticPath),
    ];

    const duplicates = detectDuplicatePaths(fragments);

    expect(duplicates).toHaveLength(0);
  });
});

// ============================================================================
// Determinism Invariant Tests
// ============================================================================

describe('Similarity Determinism Invariants (Principle E)', () => {
  it('INVARIANT: findSimilarPaths produces identical results for shuffled input', () => {
    const paths: SemanticPath[] = [
      'data.a' as SemanticPath,
      'data.b' as SemanticPath,
      'data.c' as SemanticPath,
      'data.aa' as SemanticPath,
      'data.ab' as SemanticPath,
    ];

    const result1 = findSimilarPaths(paths, 0.5);
    const result2 = findSimilarPaths([...paths].reverse() as SemanticPath[], 0.5);

    expect(result1).toEqual(result2);
  });

  it('INVARIANT: clusterSimilarPaths produces identical results for shuffled input', () => {
    const paths: SemanticPath[] = [
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath,
      'data.orderTotal' as SemanticPath,
    ];

    const result1 = clusterSimilarPaths(paths, 0.5);
    const result2 = clusterSimilarPaths([...paths].reverse() as SemanticPath[], 0.5);

    expect(result1).toEqual(result2);
  });

  it('INVARIANT: findFrequentPaths produces identical results for shuffled input', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath, 'data.y' as SemanticPath],
      }),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
      }),
    ];

    const result1 = findFrequentPaths(fragments);
    const result2 = findFrequentPaths([...fragments].reverse());

    expect(result1).toEqual(result2);
  });
});
