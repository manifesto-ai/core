/**
 * Codebook Operations Tests
 *
 * Tests for Codebook CRUD operations with immutability guarantees.
 * All mutations return NEW codebook instances.
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import type { Codebook, AliasEntry, AliasSuggestion, AliasId } from '../../src/types/codebook.js';
import type { Provenance } from '../../src/types/provenance.js';
import {
  getAliasById,
  getAliasForPath,
  resolveToCanonical,
  resolveAllToCanonical,
  getAliasesForCanonical,
  getAliasesByStatus,
  getPendingAliases,
  getAppliedAliases,
  getRejectedAliases,
  hasAliasForPath,
  getAllCanonicalPaths,
  addAliasSuggestion,
  addAliasSuggestions,
  applyAlias,
  rejectAlias,
  removeAlias,
  addUserAlias,
  clearRejectedAliases,
  clearPendingAliases,
  wouldAliasConflict,
  getAliasConflicts,
  validateCodebook,
  sortCodebookEntries,
  sortAliasesByConfidence,
  getCodebookStats,
} from '../../src/patch/codebook.js';
import { createCodebook, createAliasSuggestion } from '../../src/types/codebook.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestCodebook(entries: AliasEntry[] = []): Codebook {
  const codebook = createCodebook('Test Codebook');
  return {
    ...codebook,
    entries,
  };
}

function createTestProvenance(): Provenance {
  return {
    artifactId: 'test-artifact',
    location: { kind: 'generated', note: 'test' },
  };
}

function createTestEntry(overrides: Partial<AliasEntry> = {}): AliasEntry {
  return {
    id: 'alias-1' as AliasId,
    aliasPath: 'data.oldName' as SemanticPath,
    canonicalPath: 'data.newName' as SemanticPath,
    status: 'suggested',
    confidence: 0.9,
    rationale: 'Similar names',
    origin: createTestProvenance(),
    affectedFragments: [],
    createdAt: Date.now(),
    ...overrides,
  };
}

function createTestSuggestion(overrides: Partial<AliasSuggestion> = {}): AliasSuggestion {
  return createAliasSuggestion(
    (overrides.aliasPath ?? 'data.alias') as SemanticPath,
    (overrides.canonicalPath ?? 'data.canonical') as SemanticPath,
    {
      confidence: overrides.confidence ?? 0.85,
      rationale: overrides.rationale ?? 'Test rationale',
      affectedFragments: overrides.affectedFragments ?? [],
    }
  );
}

// ============================================================================
// Query Operations Tests
// ============================================================================

describe('Codebook Query Operations', () => {
  describe('getAliasById', () => {
    it('should return alias entry by ID', () => {
      const entry = createTestEntry({ id: 'alias-123' as AliasId });
      const codebook = createTestCodebook([entry]);

      const result = getAliasById(codebook, 'alias-123' as AliasId);

      expect(result).toBeDefined();
      expect(result?.id).toBe('alias-123');
    });

    it('should return undefined for non-existent ID', () => {
      const codebook = createTestCodebook([createTestEntry()]);

      const result = getAliasById(codebook, 'non-existent' as AliasId);

      expect(result).toBeUndefined();
    });
  });

  describe('getAliasForPath', () => {
    it('should return applied alias for path', () => {
      const entry = createTestEntry({
        aliasPath: 'data.oldPath' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      const result = getAliasForPath(codebook, 'data.oldPath' as SemanticPath);

      expect(result).toBeDefined();
      expect(result?.aliasPath).toBe('data.oldPath');
    });

    it('should not return suggested alias', () => {
      const entry = createTestEntry({
        aliasPath: 'data.oldPath' as SemanticPath,
        status: 'suggested',
      });
      const codebook = createTestCodebook([entry]);

      const result = getAliasForPath(codebook, 'data.oldPath' as SemanticPath);

      expect(result).toBeUndefined();
    });

    it('should not return rejected alias', () => {
      const entry = createTestEntry({
        aliasPath: 'data.oldPath' as SemanticPath,
        status: 'rejected',
      });
      const codebook = createTestCodebook([entry]);

      const result = getAliasForPath(codebook, 'data.oldPath' as SemanticPath);

      expect(result).toBeUndefined();
    });
  });

  describe('resolveToCanonical', () => {
    it('should resolve alias path to canonical', () => {
      const entry = createTestEntry({
        aliasPath: 'data.alias' as SemanticPath,
        canonicalPath: 'data.canonical' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      const result = resolveToCanonical(codebook, 'data.alias' as SemanticPath);

      expect(result).toBe('data.canonical');
    });

    it('should return original path if no alias exists', () => {
      const codebook = createTestCodebook([]);

      const result = resolveToCanonical(codebook, 'data.unknown' as SemanticPath);

      expect(result).toBe('data.unknown');
    });
  });

  describe('resolveAllToCanonical', () => {
    it('should resolve multiple paths', () => {
      const entry1 = createTestEntry({
        id: 'alias-1' as AliasId,
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.canonical_a' as SemanticPath,
        status: 'applied',
      });
      const entry2 = createTestEntry({
        id: 'alias-2' as AliasId,
        aliasPath: 'data.b' as SemanticPath,
        canonicalPath: 'data.canonical_b' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry1, entry2]);

      const paths = ['data.a', 'data.b', 'data.c'] as SemanticPath[];
      const result = resolveAllToCanonical(codebook, paths);

      expect(result).toEqual(['data.canonical_a', 'data.canonical_b', 'data.c']);
    });
  });

  describe('getAliasesForCanonical', () => {
    it('should return all aliases pointing to canonical path', () => {
      const entry1 = createTestEntry({
        id: 'alias-1' as AliasId,
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.canonical' as SemanticPath,
        status: 'applied',
      });
      const entry2 = createTestEntry({
        id: 'alias-2' as AliasId,
        aliasPath: 'data.b' as SemanticPath,
        canonicalPath: 'data.canonical' as SemanticPath,
        status: 'applied',
      });
      const entry3 = createTestEntry({
        id: 'alias-3' as AliasId,
        aliasPath: 'data.c' as SemanticPath,
        canonicalPath: 'data.other' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry1, entry2, entry3]);

      const result = getAliasesForCanonical(codebook, 'data.canonical' as SemanticPath);

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.aliasPath)).toContain('data.a');
      expect(result.map((e) => e.aliasPath)).toContain('data.b');
    });
  });

  describe('getAliasesByStatus', () => {
    it('should filter by status', () => {
      const entries = [
        createTestEntry({ id: 'a1' as AliasId, status: 'suggested' }),
        createTestEntry({ id: 'a2' as AliasId, status: 'applied' }),
        createTestEntry({ id: 'a3' as AliasId, status: 'rejected' }),
        createTestEntry({ id: 'a4' as AliasId, status: 'suggested' }),
      ];
      const codebook = createTestCodebook(entries);

      expect(getAliasesByStatus(codebook, 'suggested')).toHaveLength(2);
      expect(getAliasesByStatus(codebook, 'applied')).toHaveLength(1);
      expect(getAliasesByStatus(codebook, 'rejected')).toHaveLength(1);
    });
  });

  describe('status convenience functions', () => {
    const entries = [
      createTestEntry({ id: 'a1' as AliasId, status: 'suggested' }),
      createTestEntry({ id: 'a2' as AliasId, status: 'applied' }),
      createTestEntry({ id: 'a3' as AliasId, status: 'rejected' }),
    ];
    const codebook = createTestCodebook(entries);

    it('getPendingAliases should return suggested', () => {
      expect(getPendingAliases(codebook)).toHaveLength(1);
      expect(getPendingAliases(codebook)[0]?.id).toBe('a1');
    });

    it('getAppliedAliases should return applied', () => {
      expect(getAppliedAliases(codebook)).toHaveLength(1);
      expect(getAppliedAliases(codebook)[0]?.id).toBe('a2');
    });

    it('getRejectedAliases should return rejected', () => {
      expect(getRejectedAliases(codebook)).toHaveLength(1);
      expect(getRejectedAliases(codebook)[0]?.id).toBe('a3');
    });
  });

  describe('hasAliasForPath', () => {
    it('should return true for applied alias', () => {
      const entry = createTestEntry({
        aliasPath: 'data.test' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      expect(hasAliasForPath(codebook, 'data.test' as SemanticPath)).toBe(true);
    });

    it('should return false for non-applied alias', () => {
      const entry = createTestEntry({
        aliasPath: 'data.test' as SemanticPath,
        status: 'suggested',
      });
      const codebook = createTestCodebook([entry]);

      expect(hasAliasForPath(codebook, 'data.test' as SemanticPath)).toBe(false);
    });
  });

  describe('getAllCanonicalPaths', () => {
    it('should return unique canonical paths', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          canonicalPath: 'data.a' as SemanticPath,
          status: 'applied',
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          canonicalPath: 'data.a' as SemanticPath,
          status: 'applied',
        }),
        createTestEntry({
          id: 'a3' as AliasId,
          canonicalPath: 'data.b' as SemanticPath,
          status: 'applied',
        }),
      ];
      const codebook = createTestCodebook(entries);

      const result = getAllCanonicalPaths(codebook);

      expect(result).toHaveLength(2);
      expect(result).toContain('data.a');
      expect(result).toContain('data.b');
    });

    it('should return sorted paths', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          canonicalPath: 'data.z' as SemanticPath,
          status: 'applied',
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          canonicalPath: 'data.a' as SemanticPath,
          status: 'applied',
        }),
      ];
      const codebook = createTestCodebook(entries);

      const result = getAllCanonicalPaths(codebook);

      expect(result).toEqual(['data.a', 'data.z']);
    });
  });
});

// ============================================================================
// Mutation Operations Tests
// ============================================================================

describe('Codebook Mutation Operations', () => {
  describe('addAliasSuggestion', () => {
    it('should add suggestion and return new codebook', () => {
      const codebook = createTestCodebook([]);
      const suggestion = createTestSuggestion();
      const origin = createTestProvenance();

      const newCodebook = addAliasSuggestion(codebook, suggestion, origin);

      expect(newCodebook).not.toBe(codebook); // Immutability
      expect(newCodebook.entries).toHaveLength(1);
      expect(newCodebook.entries[0]?.status).toBe('suggested');
      expect(codebook.entries).toHaveLength(0); // Original unchanged
    });

    it('should update version and timestamp', async () => {
      const codebook = createTestCodebook([]);
      // Wait 1ms to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 1));

      const suggestion = createTestSuggestion();
      const origin = createTestProvenance();

      const newCodebook = addAliasSuggestion(codebook, suggestion, origin);

      // Version format is v_<timestamp>
      expect(newCodebook.version).toMatch(/^v_\d+$/);
      expect(newCodebook.updatedAt).toBeGreaterThanOrEqual(codebook.updatedAt);
    });
  });

  describe('addAliasSuggestions', () => {
    it('should add multiple suggestions', () => {
      const codebook = createTestCodebook([]);
      const suggestions = [
        createTestSuggestion({ aliasPath: 'data.a' as SemanticPath }),
        createTestSuggestion({ aliasPath: 'data.b' as SemanticPath }),
      ];
      const origin = createTestProvenance();

      const newCodebook = addAliasSuggestions(codebook, suggestions, origin);

      expect(newCodebook.entries).toHaveLength(2);
    });
  });

  describe('applyAlias', () => {
    it('should apply suggested alias', () => {
      const entry = createTestEntry({ id: 'alias-1' as AliasId, status: 'suggested' });
      const codebook = createTestCodebook([entry]);

      const { codebook: newCodebook, entry: appliedEntry } = applyAlias(
        codebook,
        'alias-1' as AliasId
      );

      expect(newCodebook).not.toBe(codebook);
      expect(appliedEntry?.status).toBe('applied');
      expect(appliedEntry?.resolvedAt).toBeDefined();
      expect(newCodebook.entries[0]?.status).toBe('applied');
    });

    it('should not change already applied alias', () => {
      const entry = createTestEntry({ id: 'alias-1' as AliasId, status: 'applied' });
      const codebook = createTestCodebook([entry]);

      const { codebook: newCodebook, entry: returnedEntry } = applyAlias(
        codebook,
        'alias-1' as AliasId
      );

      expect(newCodebook).toBe(codebook); // No change
      expect(returnedEntry?.status).toBe('applied');
    });

    it('should return undefined entry for non-existent alias', () => {
      const codebook = createTestCodebook([]);

      const { codebook: newCodebook, entry } = applyAlias(codebook, 'non-existent' as AliasId);

      expect(newCodebook).toBe(codebook);
      expect(entry).toBeUndefined();
    });
  });

  describe('rejectAlias', () => {
    it('should reject alias and add reason', () => {
      const entry = createTestEntry({ id: 'alias-1' as AliasId, status: 'suggested' });
      const codebook = createTestCodebook([entry]);

      const newCodebook = rejectAlias(codebook, 'alias-1' as AliasId, 'Not applicable');

      expect(newCodebook).not.toBe(codebook);
      expect(newCodebook.entries[0]?.status).toBe('rejected');
      expect(newCodebook.entries[0]?.rationale).toContain('Not applicable');
    });
  });

  describe('removeAlias', () => {
    it('should remove alias from codebook', () => {
      const entry = createTestEntry({ id: 'alias-1' as AliasId });
      const codebook = createTestCodebook([entry]);

      const newCodebook = removeAlias(codebook, 'alias-1' as AliasId);

      expect(newCodebook).not.toBe(codebook);
      expect(newCodebook.entries).toHaveLength(0);
    });
  });

  describe('addUserAlias', () => {
    it('should add user alias as immediately applied', () => {
      const codebook = createTestCodebook([]);

      const newCodebook = addUserAlias(
        codebook,
        'data.alias' as SemanticPath,
        'data.canonical' as SemanticPath,
        createTestProvenance(),
        'User defined'
      );

      expect(newCodebook.entries).toHaveLength(1);
      expect(newCodebook.entries[0]?.status).toBe('applied');
      expect(newCodebook.entries[0]?.confidence).toBe(1.0);
    });
  });

  describe('clearRejectedAliases', () => {
    it('should remove only rejected aliases', () => {
      const entries = [
        createTestEntry({ id: 'a1' as AliasId, status: 'suggested' }),
        createTestEntry({ id: 'a2' as AliasId, status: 'applied' }),
        createTestEntry({ id: 'a3' as AliasId, status: 'rejected' }),
      ];
      const codebook = createTestCodebook(entries);

      const newCodebook = clearRejectedAliases(codebook);

      expect(newCodebook.entries).toHaveLength(2);
      expect(newCodebook.entries.every((e) => e.status !== 'rejected')).toBe(true);
    });
  });

  describe('clearPendingAliases', () => {
    it('should remove only suggested aliases', () => {
      const entries = [
        createTestEntry({ id: 'a1' as AliasId, status: 'suggested' }),
        createTestEntry({ id: 'a2' as AliasId, status: 'applied' }),
        createTestEntry({ id: 'a3' as AliasId, status: 'rejected' }),
      ];
      const codebook = createTestCodebook(entries);

      const newCodebook = clearPendingAliases(codebook);

      expect(newCodebook.entries).toHaveLength(2);
      expect(newCodebook.entries.every((e) => e.status !== 'suggested')).toBe(true);
    });
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('Codebook Validation', () => {
  describe('wouldAliasConflict', () => {
    it('should detect conflict with existing alias', () => {
      const entry = createTestEntry({
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.x' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      const result = wouldAliasConflict(codebook, 'data.a' as SemanticPath, 'data.y' as SemanticPath);

      expect(result).toBe(true);
    });

    it('should detect cycle (canonical is already an alias)', () => {
      const entry = createTestEntry({
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.b' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      const result = wouldAliasConflict(codebook, 'data.b' as SemanticPath, 'data.a' as SemanticPath);

      expect(result).toBe(true);
    });

    it('should detect self-reference', () => {
      const codebook = createTestCodebook([]);

      const result = wouldAliasConflict(codebook, 'data.a' as SemanticPath, 'data.a' as SemanticPath);

      expect(result).toBe(true);
    });

    it('should allow non-conflicting alias', () => {
      const codebook = createTestCodebook([]);

      const result = wouldAliasConflict(codebook, 'data.a' as SemanticPath, 'data.b' as SemanticPath);

      expect(result).toBe(false);
    });
  });

  describe('getAliasConflicts', () => {
    it('should return conflict descriptions', () => {
      const entry = createTestEntry({
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.x' as SemanticPath,
        status: 'applied',
      });
      const codebook = createTestCodebook([entry]);

      const conflicts = getAliasConflicts(codebook, 'data.a' as SemanticPath, 'data.y' as SemanticPath);

      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toContain('data.a');
    });
  });

  describe('validateCodebook', () => {
    it('should validate consistent codebook', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          aliasPath: 'data.a' as SemanticPath,
          canonicalPath: 'data.canonical' as SemanticPath,
          status: 'applied',
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          aliasPath: 'data.b' as SemanticPath,
          canonicalPath: 'data.canonical' as SemanticPath,
          status: 'applied',
        }),
      ];
      const codebook = createTestCodebook(entries);

      const result = validateCodebook(codebook);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect duplicate alias paths', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          aliasPath: 'data.same' as SemanticPath,
          canonicalPath: 'data.x' as SemanticPath,
          status: 'applied',
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          aliasPath: 'data.same' as SemanticPath,
          canonicalPath: 'data.y' as SemanticPath,
          status: 'applied',
        }),
      ];
      const codebook = createTestCodebook(entries);

      const result = validateCodebook(codebook);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('should detect self-referential alias', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          aliasPath: 'data.a' as SemanticPath,
          canonicalPath: 'data.a' as SemanticPath,
          status: 'applied',
        }),
      ];
      const codebook = createTestCodebook(entries);

      const result = validateCodebook(codebook);

      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes('Self-referential'))).toBe(true);
    });
  });
});

// ============================================================================
// Sorting Tests
// ============================================================================

describe('Codebook Sorting', () => {
  describe('sortCodebookEntries', () => {
    it('should sort by status (applied first)', () => {
      const entries = [
        createTestEntry({ id: 'a1' as AliasId, status: 'rejected' }),
        createTestEntry({ id: 'a2' as AliasId, status: 'suggested' }),
        createTestEntry({ id: 'a3' as AliasId, status: 'applied' }),
      ];
      const codebook = createTestCodebook(entries);

      const sorted = sortCodebookEntries(codebook);

      expect(sorted.entries[0]?.status).toBe('applied');
      expect(sorted.entries[1]?.status).toBe('suggested');
      expect(sorted.entries[2]?.status).toBe('rejected');
    });

    it('should sort by confidence within same status', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          status: 'suggested',
          confidence: 0.5,
          aliasPath: 'data.a' as SemanticPath,
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          status: 'suggested',
          confidence: 0.9,
          aliasPath: 'data.b' as SemanticPath,
        }),
      ];
      const codebook = createTestCodebook(entries);

      const sorted = sortCodebookEntries(codebook);

      expect(sorted.entries[0]?.confidence).toBe(0.9);
      expect(sorted.entries[1]?.confidence).toBe(0.5);
    });
  });

  describe('sortAliasesByConfidence', () => {
    it('should sort entries by confidence descending', () => {
      const entries = [
        createTestEntry({ id: 'a1' as AliasId, confidence: 0.5 }),
        createTestEntry({ id: 'a2' as AliasId, confidence: 0.9 }),
        createTestEntry({ id: 'a3' as AliasId, confidence: 0.7 }),
      ];

      const sorted = sortAliasesByConfidence(entries);

      expect(sorted[0]?.confidence).toBe(0.9);
      expect(sorted[1]?.confidence).toBe(0.7);
      expect(sorted[2]?.confidence).toBe(0.5);
    });
  });
});

// ============================================================================
// Statistics Tests
// ============================================================================

describe('Codebook Statistics', () => {
  describe('getCodebookStats', () => {
    it('should return correct statistics', () => {
      const entries = [
        createTestEntry({
          id: 'a1' as AliasId,
          status: 'suggested',
          canonicalPath: 'data.x' as SemanticPath,
        }),
        createTestEntry({
          id: 'a2' as AliasId,
          status: 'applied',
          canonicalPath: 'data.y' as SemanticPath,
        }),
        createTestEntry({
          id: 'a3' as AliasId,
          status: 'applied',
          canonicalPath: 'data.y' as SemanticPath,
        }),
        createTestEntry({ id: 'a4' as AliasId, status: 'rejected' }),
      ];
      const codebook = createTestCodebook(entries);

      const stats = getCodebookStats(codebook);

      expect(stats.total).toBe(4);
      expect(stats.applied).toBe(2);
      expect(stats.suggested).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.uniqueCanonicalPaths).toBe(1); // Only 'data.y' is applied
    });

    it('should handle empty codebook', () => {
      const codebook = createTestCodebook([]);

      const stats = getCodebookStats(codebook);

      expect(stats.total).toBe(0);
      expect(stats.applied).toBe(0);
      expect(stats.suggested).toBe(0);
      expect(stats.rejected).toBe(0);
      expect(stats.uniqueCanonicalPaths).toBe(0);
    });
  });
});

// ============================================================================
// Immutability Invariant Tests
// ============================================================================

describe('Codebook Immutability Invariants', () => {
  it('INVARIANT: addAliasSuggestion does not mutate original', () => {
    const codebook = createTestCodebook([]);
    const originalEntries = [...codebook.entries];

    addAliasSuggestion(codebook, createTestSuggestion(), createTestProvenance());

    expect(codebook.entries).toEqual(originalEntries);
  });

  it('INVARIANT: applyAlias does not mutate original', () => {
    const entry = createTestEntry({ id: 'test' as AliasId, status: 'suggested' });
    const codebook = createTestCodebook([entry]);
    const originalStatus = codebook.entries[0]?.status;

    applyAlias(codebook, 'test' as AliasId);

    expect(codebook.entries[0]?.status).toBe(originalStatus);
  });

  it('INVARIANT: rejectAlias does not mutate original', () => {
    const entry = createTestEntry({ id: 'test' as AliasId, status: 'suggested' });
    const codebook = createTestCodebook([entry]);
    const originalStatus = codebook.entries[0]?.status;

    rejectAlias(codebook, 'test' as AliasId);

    expect(codebook.entries[0]?.status).toBe(originalStatus);
  });
});
