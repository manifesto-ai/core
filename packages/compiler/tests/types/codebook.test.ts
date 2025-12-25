/**
 * Codebook Types Tests
 *
 * Tests for codebook factory functions in src/types/codebook.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  createCodebookId,
  createAliasId,
  createCodebook,
  createAliasEntry,
  createAliasSuggestion,
  DEFAULT_ALIAS_HINT_CONFIG,
  type Codebook,
  type AliasEntry,
  type AliasSuggestion,
  type AliasStatus,
} from '../../src/types/codebook.js';
import { generatedOrigin } from '../../src/types/provenance.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProvenance() {
  return {
    artifactId: 'test-artifact',
    location: generatedOrigin('test'),
    createdAt: Date.now(),
  };
}

// ============================================================================
// createCodebookId
// ============================================================================

describe('createCodebookId', () => {
  it('should create a codebook ID with correct prefix', () => {
    const id = createCodebookId();
    expect(id).toMatch(/^codebook_\d+_[a-z0-9]+$/);
  });

  it('should create unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createCodebookId());
    }
    expect(ids.size).toBe(100);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const id = createCodebookId();
    const after = Date.now();

    const timestampPart = id.split('_')[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// createAliasId
// ============================================================================

describe('createAliasId', () => {
  it('should create an alias ID with correct prefix', () => {
    const id = createAliasId();
    expect(id).toMatch(/^alias_\d+_[a-z0-9]+$/);
  });

  it('should create unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createAliasId());
    }
    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// createCodebook
// ============================================================================

describe('createCodebook', () => {
  it('should create empty codebook with defaults', () => {
    const codebook = createCodebook();

    expect(codebook.id).toMatch(/^codebook_/);
    expect(codebook.entries).toEqual([]);
    expect(codebook.version).toMatch(/^v_\d+$/);
    expect(typeof codebook.createdAt).toBe('number');
    expect(typeof codebook.updatedAt).toBe('number');
    expect(codebook.name).toBeUndefined();
    expect(codebook.description).toBeUndefined();
  });

  it('should create codebook with name', () => {
    const codebook = createCodebook('My Codebook');

    expect(codebook.name).toBe('My Codebook');
    expect(codebook.description).toBeUndefined();
  });

  it('should create codebook with name and description', () => {
    const codebook = createCodebook('Project Aliases', 'Common path aliases');

    expect(codebook.name).toBe('Project Aliases');
    expect(codebook.description).toBe('Common path aliases');
  });

  it('should have consistent timestamps', () => {
    const before = Date.now();
    const codebook = createCodebook();
    const after = Date.now();

    expect(codebook.createdAt).toBeGreaterThanOrEqual(before);
    expect(codebook.createdAt).toBeLessThanOrEqual(after);
    expect(codebook.updatedAt).toBeGreaterThanOrEqual(before);
    expect(codebook.updatedAt).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// createAliasEntry
// ============================================================================

describe('createAliasEntry', () => {
  it('should create alias entry with defaults', () => {
    const entry = createAliasEntry(
      'user.name' as SemanticPath,
      'data.profile.firstName' as SemanticPath,
      createTestProvenance()
    );

    expect(entry.id).toMatch(/^alias_/);
    expect(entry.aliasPath).toBe('user.name');
    expect(entry.canonicalPath).toBe('data.profile.firstName');
    expect(entry.status).toBe('suggested');
    expect(entry.confidence).toBe(0.5);
    expect(entry.rationale).toBe('Auto-generated alias suggestion');
    expect(entry.affectedFragments).toEqual([]);
    expect(typeof entry.createdAt).toBe('number');
    expect(entry.resolvedAt).toBeUndefined();
  });

  it('should create alias entry with custom options', () => {
    const entry = createAliasEntry(
      'email' as SemanticPath,
      'data.contact.emailAddress' as SemanticPath,
      createTestProvenance(),
      {
        status: 'applied',
        confidence: 0.95,
        rationale: 'Common field shorthand',
        affectedFragments: ['frag_1', 'frag_2'],
      }
    );

    expect(entry.status).toBe('applied');
    expect(entry.confidence).toBe(0.95);
    expect(entry.rationale).toBe('Common field shorthand');
    expect(entry.affectedFragments).toEqual(['frag_1', 'frag_2']);
    expect(entry.resolvedAt).toBeDefined();
  });

  it('should set resolvedAt for applied status', () => {
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { status: 'applied' }
    );

    expect(entry.resolvedAt).toBeDefined();
    expect(typeof entry.resolvedAt).toBe('number');
  });

  it('should set resolvedAt for rejected status', () => {
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { status: 'rejected' }
    );

    expect(entry.resolvedAt).toBeDefined();
  });

  it('should not set resolvedAt for suggested status', () => {
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { status: 'suggested' }
    );

    expect(entry.resolvedAt).toBeUndefined();
  });

  it('should include evidence when provided', () => {
    const evidence = [
      { kind: 'quote' as const, ref: 'line 10', excerpt: 'user name field' },
    ];
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { evidence }
    );

    expect(entry.evidence).toEqual(evidence);
  });
});

// ============================================================================
// createAliasSuggestion
// ============================================================================

describe('createAliasSuggestion', () => {
  it('should create suggestion with defaults', () => {
    const suggestion = createAliasSuggestion(
      'short.path' as SemanticPath,
      'very.long.canonical.path' as SemanticPath
    );

    expect(suggestion.aliasPath).toBe('short.path');
    expect(suggestion.canonicalPath).toBe('very.long.canonical.path');
    expect(suggestion.confidence).toBe(0.5);
    expect(suggestion.rationale).toBe('Similar paths detected');
    expect(suggestion.affectedFragments).toEqual([]);
    expect(suggestion.similarityScore).toBeUndefined();
    expect(suggestion.similarityType).toBeUndefined();
  });

  it('should create suggestion with custom options', () => {
    const suggestion = createAliasSuggestion(
      'alias' as SemanticPath,
      'canonical' as SemanticPath,
      {
        confidence: 0.9,
        rationale: 'High semantic similarity',
        affectedFragments: ['f1', 'f2', 'f3'],
        similarityScore: 0.85,
        similarityType: 'semantic',
      }
    );

    expect(suggestion.confidence).toBe(0.9);
    expect(suggestion.rationale).toBe('High semantic similarity');
    expect(suggestion.affectedFragments).toEqual(['f1', 'f2', 'f3']);
    expect(suggestion.similarityScore).toBe(0.85);
    expect(suggestion.similarityType).toBe('semantic');
  });

  it('should handle all similarity types', () => {
    const types: Array<'semantic' | 'structural' | 'expression' | 'usage'> = [
      'semantic',
      'structural',
      'expression',
      'usage',
    ];

    for (const type of types) {
      const suggestion = createAliasSuggestion(
        'a' as SemanticPath,
        'b' as SemanticPath,
        { similarityType: type }
      );
      expect(suggestion.similarityType).toBe(type);
    }
  });
});

// ============================================================================
// DEFAULT_ALIAS_HINT_CONFIG
// ============================================================================

describe('DEFAULT_ALIAS_HINT_CONFIG', () => {
  it('should have all required config fields', () => {
    expect(DEFAULT_ALIAS_HINT_CONFIG.nameSimilarityThreshold).toBe(0.75);
    expect(DEFAULT_ALIAS_HINT_CONFIG.expressionSimilarityThreshold).toBe(0.85);
    expect(DEFAULT_ALIAS_HINT_CONFIG.minConfidence).toBe(0.5);
    expect(DEFAULT_ALIAS_HINT_CONFIG.maxSuggestions).toBe(50);
    expect(DEFAULT_ALIAS_HINT_CONFIG.preferShorterPaths).toBe(true);
    expect(DEFAULT_ALIAS_HINT_CONFIG.preferFrequentPaths).toBe(true);
  });

  it('should have thresholds in valid range', () => {
    expect(DEFAULT_ALIAS_HINT_CONFIG.nameSimilarityThreshold).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_ALIAS_HINT_CONFIG.nameSimilarityThreshold).toBeLessThanOrEqual(1);
    expect(DEFAULT_ALIAS_HINT_CONFIG.expressionSimilarityThreshold).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_ALIAS_HINT_CONFIG.expressionSimilarityThreshold).toBeLessThanOrEqual(1);
    expect(DEFAULT_ALIAS_HINT_CONFIG.minConfidence).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_ALIAS_HINT_CONFIG.minConfidence).toBeLessThanOrEqual(1);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle unicode in paths', () => {
    const entry = createAliasEntry(
      '사용자.이름' as SemanticPath,
      '데이터.프로필.이름' as SemanticPath,
      createTestProvenance()
    );

    expect(entry.aliasPath).toBe('사용자.이름');
    expect(entry.canonicalPath).toBe('데이터.프로필.이름');
  });

  it('should handle empty rationale', () => {
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { rationale: '' }
    );

    expect(entry.rationale).toBe('');
  });

  it('should handle zero confidence', () => {
    const suggestion = createAliasSuggestion(
      'a' as SemanticPath,
      'b' as SemanticPath,
      { confidence: 0 }
    );

    expect(suggestion.confidence).toBe(0);
  });

  it('should handle very long fragment ID lists', () => {
    const fragments = Array.from({ length: 100 }, (_, i) => `frag_${i}`);
    const entry = createAliasEntry(
      'a' as SemanticPath,
      'b' as SemanticPath,
      createTestProvenance(),
      { affectedFragments: fragments }
    );

    expect(entry.affectedFragments).toHaveLength(100);
  });

  it('should work with all alias statuses', () => {
    const statuses: AliasStatus[] = ['suggested', 'applied', 'rejected'];

    for (const status of statuses) {
      const entry = createAliasEntry(
        'a' as SemanticPath,
        'b' as SemanticPath,
        createTestProvenance(),
        { status }
      );
      expect(entry.status).toBe(status);
    }
  });
});
