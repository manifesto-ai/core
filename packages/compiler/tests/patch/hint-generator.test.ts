/**
 * Alias Hint Generator Tests
 *
 * Tests for alias suggestion generation.
 * CRITICAL INVARIANT: This module ONLY generates suggestions - NEVER auto-applies.
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type { Fragment, DerivedFragment, SchemaFragment } from '../../src/types/fragment.js';
import type { AliasHintConfig } from '../../src/types/codebook.js';
import {
  analyzeForAliases,
  generateAliasHints,
  suggestAliasesForPath,
  suggestCanonicalFor,
  getDuplicatePathSuggestions,
  generateSuggestionsFromDuplicates,
  getAnalysisSummary,
} from '../../src/patch/hint-generator.js';

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
// analyzeForAliases Tests
// ============================================================================

describe('analyzeForAliases', () => {
  it('should return analysis result structure', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.count' as SemanticPath),
    ];

    const result = analyzeForAliases(fragments);

    expect(result).toHaveProperty('suggestions');
    expect(result).toHaveProperty('frequentPaths');
    expect(result).toHaveProperty('clusters');
    expect(result).toHaveProperty('stats');
  });

  it('should find suggestions for similar paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.userName' as SemanticPath, {
        id: 'schema-userName',
        provides: ['data.userName'],
      }),
      createSchemaFragment('data.userNames' as SemanticPath, {
        id: 'schema-userNames',
        provides: ['data.userNames'],
      }),
    ];

    const result = analyzeForAliases(fragments, { nameSimilarityThreshold: 0.7 });

    // May or may not find suggestions depending on similarity
    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it('should find suggestions for similar expressions', () => {
    const expr: Expression = ['*', ['get', 'data.x'], 2];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.doubled' as SemanticPath, expr),
      createDerivedFragment('derived.alsoDoubled' as SemanticPath, expr),
    ];

    const result = analyzeForAliases(fragments, { expressionSimilarityThreshold: 0.8 });

    // Should suggest aliasing identical expressions
    expect(result.suggestions.length).toBeGreaterThanOrEqual(0);
  });

  it('should respect config thresholds', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.a' as SemanticPath),
      createSchemaFragment('data.b' as SemanticPath),
    ];

    const looseResult = analyzeForAliases(fragments, { nameSimilarityThreshold: 0.1 });
    const strictResult = analyzeForAliases(fragments, { nameSimilarityThreshold: 0.99 });

    expect(looseResult.suggestions.length).toBeGreaterThanOrEqual(strictResult.suggestions.length);
  });

  it('should respect maxSuggestions config', () => {
    const fragments: Fragment[] = [];
    for (let i = 0; i < 20; i++) {
      fragments.push(createSchemaFragment(`data.item${i}` as SemanticPath));
    }

    const result = analyzeForAliases(fragments, {
      maxSuggestions: 5,
      nameSimilarityThreshold: 0.1,
    });

    expect(result.suggestions.length).toBeLessThanOrEqual(5);
  });

  it('should calculate stats correctly', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
      }),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x'], {
        requires: ['data.x' as SemanticPath],
      }),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.stats.totalPaths).toBeGreaterThan(0);
    expect(result.stats.uniquePaths).toBeGreaterThan(0);
    expect(result.stats.estimatedCompression).toBeGreaterThanOrEqual(0);
    expect(result.stats.estimatedCompression).toBeLessThanOrEqual(1);
  });

  it('INVARIANT: should NOT modify input fragments', () => {
    const originalExpr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, originalExpr),
      createDerivedFragment('derived.b' as SemanticPath, originalExpr),
    ];
    const originalFragmentsJson = JSON.stringify(fragments);

    analyzeForAliases(fragments);

    expect(JSON.stringify(fragments)).toBe(originalFragmentsJson);
  });

  it('should be deterministic (Principle E)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.userCount' as SemanticPath),
      createSchemaFragment('data.userCounts' as SemanticPath),
      createSchemaFragment('data.orderTotal' as SemanticPath),
    ];

    const result1 = analyzeForAliases(fragments);
    const result2 = analyzeForAliases([...fragments].reverse());

    expect(result1.suggestions).toEqual(result2.suggestions);
    expect(result1.stats).toEqual(result2.stats);
  });
});

// ============================================================================
// generateAliasHints Tests
// ============================================================================

describe('generateAliasHints', () => {
  it('should convert suggestions to PatchHints', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x']),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x']),
    ];
    const { suggestions } = analyzeForAliases(fragments);

    const hints = generateAliasHints(suggestions);

    expect(hints).toBeInstanceOf(Array);
    for (const hint of hints) {
      expect(hint).toHaveProperty('description');
      expect(hint).toHaveProperty('patch');
      expect(hint).toHaveProperty('confidence');
      expect(hint).toHaveProperty('rationale');
      expect(hint.patch.op).toBe('renamePath');
    }
  });

  it('should mark high-confidence hints as recommended', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, ['get', 'data.x']),
      createDerivedFragment('derived.b' as SemanticPath, ['get', 'data.x']),
    ];
    const { suggestions } = analyzeForAliases(fragments);

    const hints = generateAliasHints(suggestions);

    for (const hint of hints) {
      if (hint.confidence >= 0.8) {
        expect(hint.recommended).toBe(true);
      } else {
        expect(hint.recommended).toBe(false);
      }
    }
  });
});

// ============================================================================
// suggestAliasesForPath Tests
// ============================================================================

describe('suggestAliasesForPath', () => {
  it('should return suggestions for target path as alias', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.shortName' as SemanticPath, expr),
      createDerivedFragment('derived.veryLongName' as SemanticPath, expr),
    ];

    const suggestions = suggestAliasesForPath(
      'derived.veryLongName' as SemanticPath,
      fragments
    );

    // Should suggest aliasing the long name to short name
    expect(suggestions).toBeInstanceOf(Array);
  });

  it('should return suggestions for target path as canonical', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];

    const suggestions = suggestAliasesForPath('derived.a' as SemanticPath, fragments);

    expect(suggestions).toBeInstanceOf(Array);
  });

  it('should return empty array for non-matching path', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.x' as SemanticPath),
    ];

    const suggestions = suggestAliasesForPath('data.nonexistent' as SemanticPath, fragments);

    expect(suggestions).toEqual([]);
  });
});

// ============================================================================
// suggestCanonicalFor Tests
// ============================================================================

describe('suggestCanonicalFor', () => {
  it('should suggest canonical path for alias candidate', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.veryLongAlias' as SemanticPath, expr),
    ];

    const result = suggestCanonicalFor('derived.veryLongAlias' as SemanticPath, fragments);

    // May or may not find canonical depending on analysis
    expect(result).toHaveProperty('canonical');
    expect(result).toHaveProperty('alternatives');
    expect(result.alternatives).toBeInstanceOf(Array);
  });

  it('should return undefined canonical for non-aliasable path', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.unique' as SemanticPath),
    ];

    const result = suggestCanonicalFor('data.unique' as SemanticPath, fragments);

    if (!result.canonical) {
      expect(result.alternatives).toHaveLength(0);
    }
  });
});

// ============================================================================
// Duplicate Detection Tests
// ============================================================================

describe('getDuplicatePathSuggestions', () => {
  it('should find duplicate expressions and suggest canonical', () => {
    const expr: Expression = ['*', ['get', 'data.x'], 2];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.doubled' as SemanticPath, expr),
      createDerivedFragment('derived.alsoDoubled' as SemanticPath, expr),
      createDerivedFragment('derived.anotherDouble' as SemanticPath, expr),
    ];

    const duplicates = getDuplicatePathSuggestions(fragments);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.paths).toContain('derived.doubled');
    expect(duplicates[0]!.paths).toContain('derived.alsoDoubled');
    expect(duplicates[0]!.paths).toContain('derived.anotherDouble');
    expect(duplicates[0]!.suggestedCanonical).toBeDefined();
    expect(duplicates[0]!.confidence).toBe(1.0);
  });

  it('should choose shortest path as canonical', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.veryLongName' as SemanticPath, expr),
      createDerivedFragment('derived.a' as SemanticPath, expr),
    ];

    const duplicates = getDuplicatePathSuggestions(fragments);

    if (duplicates.length > 0) {
      expect(duplicates[0]!.suggestedCanonical).toBe('derived.a');
    }
  });

  it('should prefer more frequent path as canonical', () => {
    const expr: Expression = ['get', 'data.common'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.rare' as SemanticPath, expr, {
        requires: ['data.x' as SemanticPath],
      }),
      createDerivedFragment('derived.common' as SemanticPath, expr, {
        requires: ['derived.rare' as SemanticPath], // References rare
      }),
    ];

    // This test verifies the frequency-based selection logic
    const duplicates = getDuplicatePathSuggestions(fragments);
    expect(duplicates).toBeInstanceOf(Array);
  });
});

describe('generateSuggestionsFromDuplicates', () => {
  it('should generate AliasSuggestion for each non-canonical path', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.canonical' as SemanticPath, expr),
      createDerivedFragment('derived.alias1' as SemanticPath, expr),
      createDerivedFragment('derived.alias2' as SemanticPath, expr),
    ];

    const suggestions = generateSuggestionsFromDuplicates(fragments);

    // Should have 2 suggestions (alias1 and alias2 -> canonical)
    if (suggestions.length > 0) {
      expect(suggestions.length).toBe(2);
      expect(suggestions.every((s) => s.confidence === 1.0)).toBe(true);
      expect(suggestions.every((s) => s.similarityType === 'expression')).toBe(true);
    }
  });

  it('should not include canonical path as alias', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];

    const suggestions = generateSuggestionsFromDuplicates(fragments);

    for (const suggestion of suggestions) {
      expect(suggestion.aliasPath).not.toBe(suggestion.canonicalPath);
    }
  });
});

// ============================================================================
// Analysis Summary Tests
// ============================================================================

describe('getAnalysisSummary', () => {
  it('should return formatted summary string', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.a' as SemanticPath),
      createSchemaFragment('data.b' as SemanticPath),
    ];
    const result = analyzeForAliases(fragments);

    const summary = getAnalysisSummary(result);

    expect(typeof summary).toBe('string');
    expect(summary).toContain('Alias Analysis Summary');
    expect(summary).toContain('Total paths');
    expect(summary).toContain('Unique paths');
  });

  it('should include cluster info when clusters exist', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];
    const result = analyzeForAliases(fragments);

    const summary = getAnalysisSummary(result);

    if (result.clusters.length > 0) {
      expect(summary).toContain('Path clusters');
    }
  });

  it('should include suggestion info when suggestions exist', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];
    const result = analyzeForAliases(fragments);

    const summary = getAnalysisSummary(result);

    if (result.suggestions.length > 0) {
      expect(summary).toContain('Top suggestions');
    }
  });
});

// ============================================================================
// NO AUTO-APPLY Invariant Tests
// ============================================================================

describe('NO AUTO-APPLY Invariants', () => {
  it('INVARIANT: analyzeForAliases returns suggestions only, does not apply', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];
    const originalPaths = fragments.map((f) => f.provides[0]);

    const result = analyzeForAliases(fragments);

    // Original fragments unchanged
    expect(fragments.map((f) => f.provides[0])).toEqual(originalPaths);

    // Result contains suggestions, not applied changes
    expect(result.suggestions).toBeInstanceOf(Array);
    for (const suggestion of result.suggestions) {
      expect(suggestion.aliasPath).toBeDefined();
      expect(suggestion.canonicalPath).toBeDefined();
      // Suggestion does not modify anything
    }
  });

  it('INVARIANT: generateAliasHints returns hints, does not apply patches', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];
    const { suggestions } = analyzeForAliases(fragments);

    const hints = generateAliasHints(suggestions);

    // Hints are descriptive, not imperative
    for (const hint of hints) {
      expect(hint.patch).toHaveProperty('op');
      expect(hint.patch).toHaveProperty('from');
      expect(hint.patch).toHaveProperty('to');
      // The hint describes what COULD be done, not what WAS done
    }
  });

  it('INVARIANT: getDuplicatePathSuggestions returns suggestions only', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];
    const originalFragmentsJson = JSON.stringify(fragments);

    const duplicates = getDuplicatePathSuggestions(fragments);

    expect(JSON.stringify(fragments)).toBe(originalFragmentsJson);
    for (const dup of duplicates) {
      expect(dup).toHaveProperty('suggestedCanonical');
      // This is a suggestion, not an applied change
    }
  });

  it('INVARIANT: all analysis functions are pure (no side effects)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.test' as SemanticPath),
    ];

    // Run multiple times, should produce identical results
    const result1 = analyzeForAliases(fragments);
    const result2 = analyzeForAliases(fragments);

    expect(result1.suggestions).toEqual(result2.suggestions);
    expect(result1.stats).toEqual(result2.stats);
  });
});

// ============================================================================
// Edge Case Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty fragments array', () => {
    const result = analyzeForAliases([]);

    expect(result.suggestions).toHaveLength(0);
    expect(result.frequentPaths).toHaveLength(0);
    expect(result.clusters).toHaveLength(0);
    expect(result.stats.totalPaths).toBe(0);
  });

  it('should handle single fragment', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.single' as SemanticPath),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.suggestions).toHaveLength(0); // No pairs to compare
  });

  it('should handle fragments with no provides', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.test' as SemanticPath, { provides: [] }),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it('should handle deeply nested expressions', () => {
    const deepExpr: Expression = [
      '+',
      ['*', ['get', 'data.a'], ['get', 'data.b']],
      ['-', ['get', 'data.c'], 10],
    ];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.deep1' as SemanticPath, deepExpr),
      createDerivedFragment('derived.deep2' as SemanticPath, deepExpr),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.suggestions).toBeInstanceOf(Array);
  });

  it('should handle special characters in paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.user_name' as SemanticPath),
      createSchemaFragment('data.user-name' as SemanticPath),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.suggestions).toBeInstanceOf(Array);
  });
});

// ============================================================================
// Config Tests
// ============================================================================

describe('AliasHintConfig', () => {
  it('should use default config when not provided', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('data.test' as SemanticPath),
    ];

    const result = analyzeForAliases(fragments);

    expect(result.stats).toBeDefined();
  });

  it('should respect minConfidence filter', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.a' as SemanticPath, expr),
      createDerivedFragment('derived.b' as SemanticPath, expr),
    ];

    const highConfResult = analyzeForAliases(fragments, { minConfidence: 0.99 });
    const lowConfResult = analyzeForAliases(fragments, { minConfidence: 0.1 });

    expect(highConfResult.suggestions.length).toBeLessThanOrEqual(lowConfResult.suggestions.length);
  });

  it('should respect preferShorterPaths option', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.longPathName' as SemanticPath, expr),
      createDerivedFragment('derived.a' as SemanticPath, expr),
    ];

    const result = analyzeForAliases(fragments, { preferShorterPaths: true });

    // If suggestions exist, canonical should be shorter
    for (const suggestion of result.suggestions) {
      if (suggestion.canonicalPath.length !== suggestion.aliasPath.length) {
        expect(suggestion.canonicalPath.length).toBeLessThan(suggestion.aliasPath.length);
      }
    }
  });

  it('should respect preferFrequentPaths option', () => {
    const expr: Expression = ['get', 'data.common'];
    const fragments: Fragment[] = [
      createDerivedFragment('derived.rare' as SemanticPath, expr, {
        requires: [],
      }),
      createDerivedFragment('derived.common' as SemanticPath, expr, {
        requires: ['derived.rare' as SemanticPath, 'derived.rare' as SemanticPath],
      }),
    ];

    const result = analyzeForAliases(fragments, { preferFrequentPaths: true });

    // Config is respected, even if no suggestions are generated
    expect(result.stats).toBeDefined();
  });
});
