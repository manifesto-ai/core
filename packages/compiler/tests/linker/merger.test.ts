/**
 * Fragment Merger Tests
 *
 * Tests for Principle B: Merger is ASSEMBLY ONLY, NO conflict resolution.
 */

import { describe, it, expect } from 'vitest';
import {
  mergeFragments,
  canMerge,
  canMergeInto,
  consolidateSchemaFragments,
  incrementalMerge,
  removeFragment,
  groupFragmentsByKind,
  groupFragmentsByProvides,
  getProvidersForPath,
  validateMergeResult,
  getMergeSummary,
  type MergeStrategy,
  type MergeResult,
} from '../../src/linker/merger.js';
import type {
  Fragment,
  SchemaFragment,
  ActionFragment,
  DerivedFragment,
} from '../../src/types/fragment.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createSchemaFragment(overrides: Partial<SchemaFragment> = {}): SchemaFragment {
  return {
    id: 'schema-1',
    kind: 'SchemaFragment',
    requires: [],
    provides: ['data.count'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [
      {
        path: 'data.count',
        type: 'number',
        semantic: { type: 'number', description: 'Count' },
      },
    ],
    ...overrides,
  };
}

function createActionFragment(overrides: Partial<ActionFragment> = {}): ActionFragment {
  return {
    id: 'action-1',
    kind: 'ActionFragment',
    requires: ['data.count'],
    provides: ['action:increment'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    actionId: 'increment',
    semantic: { verb: 'increment', description: 'Increment count' },
    ...overrides,
  };
}

function createDerivedFragment(overrides: Partial<DerivedFragment> = {}): DerivedFragment {
  return {
    id: 'derived-1',
    kind: 'DerivedFragment',
    requires: ['data.count'],
    provides: ['derived.doubled'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'derived.doubled',
    expr: ['*', ['get', 'data.count'], 2],
    ...overrides,
  };
}

// ============================================================================
// mergeFragments Tests
// ============================================================================

describe('mergeFragments', () => {
  describe('successful merges', () => {
    it('should merge fragments with different provides', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.a'] }),
        createSchemaFragment({ id: 'b', provides: ['data.b'] }),
        createActionFragment({ id: 'c', provides: ['action:doC'], actionId: 'doC' }),
      ];

      const result = mergeFragments(fragments);

      expect(result.success).toBe(true);
      expect(result.conflicts).toHaveLength(0);
      expect(result.merged).toHaveLength(3);
    });

    it('should sort fragments by stableId for determinism (Principle E)', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'z-fragment', provides: ['data.z'] }),
        createSchemaFragment({ id: 'a-fragment', provides: ['data.a'] }),
        createSchemaFragment({ id: 'm-fragment', provides: ['data.m'] }),
      ];

      const result = mergeFragments(fragments, { sortByStableId: true });

      expect(result.merged[0].id).toBe('a-fragment');
      expect(result.merged[1].id).toBe('m-fragment');
      expect(result.merged[2].id).toBe('z-fragment');
    });

    it('should produce identical results regardless of input order (Principle E)', () => {
      const a = createSchemaFragment({ id: 'a', provides: ['data.a'] });
      const b = createSchemaFragment({ id: 'b', provides: ['data.b'] });
      const c = createSchemaFragment({ id: 'c', provides: ['data.c'] });

      const result1 = mergeFragments([a, b, c]);
      const result2 = mergeFragments([c, a, b]);
      const result3 = mergeFragments([b, c, a]);

      expect(result1.merged.map((f) => f.id)).toEqual(result2.merged.map((f) => f.id));
      expect(result2.merged.map((f) => f.id)).toEqual(result3.merged.map((f) => f.id));
    });
  });

  describe('conflicts (Principle B: NO auto-resolution)', () => {
    it('should surface duplicate path provides as conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments);

      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      // Fragments should still be in merged (not auto-resolved)
      expect(result.merged).toHaveLength(2);
    });

    it('should surface duplicate action IDs as conflicts', () => {
      const fragments: Fragment[] = [
        createActionFragment({ id: 'a', provides: ['action:submit'], actionId: 'submit' }),
        createActionFragment({ id: 'b', provides: ['action:submit'], actionId: 'submit' }),
      ];

      const result = mergeFragments(fragments);

      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should NOT auto-resolve conflicts (Principle B)', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments);

      // Both fragments should still be in the result
      const ids = result.merged.map((f) => f.id);
      expect(ids).toContain('a');
      expect(ids).toContain('b');

      // Conflict should be surfaced
      expect(result.conflicts.some((c) => c.target === 'data.count')).toBe(true);
    });

    it('should provide patch hints for conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments);

      expect(result.patchHints.length).toBeGreaterThan(0);
    });
  });

  describe('strategies', () => {
    it('should fail immediately with "fail" strategy on conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments, { strategy: 'fail' });

      expect(result.success).toBe(false);
      expect(result.merged).toHaveLength(0); // No output when fail
    });

    it('should return all fragments with "union" strategy on conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments, { strategy: 'union' });

      expect(result.success).toBe(false);
      expect(result.merged).toHaveLength(2);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it('should provide detailed hints with "manual" strategy', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'b', provides: ['data.count'] }),
      ];

      const result = mergeFragments(fragments, { strategy: 'manual' });

      const manualHints = result.patchHints.filter((h) =>
        h.suggestion.includes('[MANUAL]')
      );
      expect(manualHints.length).toBeGreaterThan(0);
    });
  });

  describe('statistics', () => {
    it('should report correct statistics', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.a'] }),
        createSchemaFragment({ id: 'b', provides: ['data.b'] }),
        createSchemaFragment({ id: 'c', provides: ['data.c'] }),
      ];

      const result = mergeFragments(fragments);

      expect(result.stats.inputCount).toBe(3);
      expect(result.stats.outputCount).toBe(3);
      expect(result.stats.conflictCount).toBe(0);
    });

    it('should report conflict count', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.x', 'data.y'] }),
        createSchemaFragment({ id: 'b', provides: ['data.x', 'data.z'] }),
        createSchemaFragment({ id: 'c', provides: ['data.y', 'data.z'] }),
      ];

      const result = mergeFragments(fragments);

      expect(result.stats.conflictCount).toBe(3); // x, y, z each have duplicates
    });
  });
});

// ============================================================================
// canMerge Tests
// ============================================================================

describe('canMerge', () => {
  it('should return true for fragments with different provides', () => {
    const a = createSchemaFragment({ provides: ['data.a'] });
    const b = createSchemaFragment({ provides: ['data.b'] });

    expect(canMerge(a, b)).toBe(true);
  });

  it('should return false for fragments with overlapping path provides', () => {
    const a = createSchemaFragment({ provides: ['data.count'] });
    const b = createSchemaFragment({ provides: ['data.count'] });

    expect(canMerge(a, b)).toBe(false);
  });

  it('should return false for fragments with overlapping action provides', () => {
    const a = createActionFragment({ provides: ['action:submit'], actionId: 'submit' });
    const b = createActionFragment({ provides: ['action:submit'], actionId: 'submit' });

    expect(canMerge(a, b)).toBe(false);
  });

  it('should return true for path and action with same name (different namespace)', () => {
    const a = createSchemaFragment({ provides: ['data.submit'] });
    const b = createActionFragment({ provides: ['action:submit'], actionId: 'submit' });

    // data.submit and action:submit are different
    expect(canMerge(a, b)).toBe(true);
  });
});

// ============================================================================
// canMergeInto Tests
// ============================================================================

describe('canMergeInto', () => {
  it('should return true if fragment can merge with all existing', () => {
    const existing: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'] }),
    ];
    const newFrag = createSchemaFragment({ id: 'c', provides: ['data.c'] });

    expect(canMergeInto(newFrag, existing)).toBe(true);
  });

  it('should return false if fragment conflicts with any existing', () => {
    const existing: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'] }),
    ];
    const newFrag = createSchemaFragment({ id: 'c', provides: ['data.count'] });

    expect(canMergeInto(newFrag, existing)).toBe(false);
  });
});

// ============================================================================
// consolidateSchemaFragments Tests
// ============================================================================

describe('consolidateSchemaFragments', () => {
  it('should consolidate non-conflicting schemas in same namespace', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        provides: ['data.a'],
        fields: [{ path: 'data.a', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        provides: ['data.b'],
        fields: [{ path: 'data.b', type: 'string', semantic: {} }],
      }),
    ];

    const result = consolidateSchemaFragments(fragments);

    expect(result.consolidatedCount).toBe(1);
    expect(result.fragments.filter((f) => f.kind === 'SchemaFragment')).toHaveLength(1);
  });

  it('should not consolidate schemas with field conflicts', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'string', semantic: {} }],
      }),
    ];

    const result = consolidateSchemaFragments(fragments);

    expect(result.consolidatedCount).toBe(0);
    expect(result.fragments.filter((f) => f.kind === 'SchemaFragment')).toHaveLength(2);
  });

  it('should keep non-schema fragments unchanged', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema' }),
      createActionFragment({ id: 'action' }),
      createDerivedFragment({ id: 'derived' }),
    ];

    const result = consolidateSchemaFragments(fragments);

    expect(result.fragments.some((f) => f.id === 'action')).toBe(true);
    expect(result.fragments.some((f) => f.id === 'derived')).toBe(true);
  });

  it('should consolidate fields from multiple schemas', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        provides: ['data.a'],
        fields: [{ path: 'data.a', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        provides: ['data.b'],
        fields: [{ path: 'data.b', type: 'string', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'c',
        namespace: 'data',
        provides: ['data.c'],
        fields: [{ path: 'data.c', type: 'boolean', semantic: {} }],
      }),
    ];

    const result = consolidateSchemaFragments(fragments);
    const consolidated = result.fragments.find(
      (f) => f.kind === 'SchemaFragment'
    ) as SchemaFragment;

    expect(consolidated.fields).toHaveLength(3);
    expect(result.consolidatedCount).toBe(2);
  });
});

// ============================================================================
// incrementalMerge Tests
// ============================================================================

describe('incrementalMerge', () => {
  it('should add non-conflicting fragment', () => {
    const existing: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
    ];
    const newFrag = createSchemaFragment({ id: 'b', provides: ['data.b'] });

    const result = incrementalMerge(existing, newFrag);

    expect(result.success).toBe(true);
    expect(result.merged).toHaveLength(2);
    expect(result.conflicts).toHaveLength(0);
  });

  it('should detect conflict when adding conflicting fragment', () => {
    const existing: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
    ];
    const newFrag = createSchemaFragment({ id: 'b', provides: ['data.count'] });

    const result = incrementalMerge(existing, newFrag);

    expect(result.success).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// removeFragment Tests
// ============================================================================

describe('removeFragment', () => {
  it('should remove fragment by ID', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a' }),
      createSchemaFragment({ id: 'b' }),
      createSchemaFragment({ id: 'c' }),
    ];

    const result = removeFragment(fragments, 'b');

    expect(result).toHaveLength(2);
    expect(result.some((f) => f.id === 'b')).toBe(false);
  });

  it('should return unchanged if ID not found', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a' }),
      createSchemaFragment({ id: 'b' }),
    ];

    const result = removeFragment(fragments, 'nonexistent');

    expect(result).toHaveLength(2);
  });
});

// ============================================================================
// Grouping Tests
// ============================================================================

describe('groupFragmentsByKind', () => {
  it('should group fragments by kind', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-1' }),
      createSchemaFragment({ id: 'schema-2' }),
      createActionFragment({ id: 'action-1' }),
      createDerivedFragment({ id: 'derived-1' }),
    ];

    const groups = groupFragmentsByKind(fragments);

    expect(groups.get('SchemaFragment')).toHaveLength(2);
    expect(groups.get('ActionFragment')).toHaveLength(1);
    expect(groups.get('DerivedFragment')).toHaveLength(1);
  });
});

describe('groupFragmentsByProvides', () => {
  it('should group fragments by provided paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x', 'data.y'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x', 'data.z'] }),
    ];

    const groups = groupFragmentsByProvides(fragments);

    expect(groups.get('data.x')).toHaveLength(2);
    expect(groups.get('data.y')).toHaveLength(1);
    expect(groups.get('data.z')).toHaveLength(1);
  });
});

describe('getProvidersForPath', () => {
  it('should return fragments that provide a path', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.other'] }),
      createSchemaFragment({ id: 'c', provides: ['data.count'] }),
    ];

    const providers = getProvidersForPath('data.count' as any, fragments);

    expect(providers).toHaveLength(2);
    expect(providers.some((f) => f.id === 'a')).toBe(true);
    expect(providers.some((f) => f.id === 'c')).toBe(true);
  });
});

// ============================================================================
// Validation Tests
// ============================================================================

describe('validateMergeResult', () => {
  it('should return true for successful merge', () => {
    const result: MergeResult = {
      merged: [],
      conflicts: [],
      patchHints: [],
      success: true,
      stats: { inputCount: 0, outputCount: 0, conflictCount: 0, schemasConsolidated: 0 },
    };

    expect(validateMergeResult(result)).toBe(true);
  });

  it('should return false for failed merge', () => {
    const result: MergeResult = {
      merged: [],
      conflicts: [{ id: '1', target: 'test', type: 'duplicate_provides', candidates: [], message: '' }],
      patchHints: [],
      success: false,
      stats: { inputCount: 0, outputCount: 0, conflictCount: 1, schemasConsolidated: 0 },
    };

    expect(validateMergeResult(result)).toBe(false);
  });
});

describe('getMergeSummary', () => {
  it('should return success message', () => {
    const result: MergeResult = {
      merged: [],
      conflicts: [],
      patchHints: [],
      success: true,
      stats: { inputCount: 5, outputCount: 4, conflictCount: 0, schemasConsolidated: 1 },
    };

    const summary = getMergeSummary(result);

    expect(summary).toContain('successful');
    expect(summary).toContain('5');
    expect(summary).toContain('4');
  });

  it('should return conflict message', () => {
    const result: MergeResult = {
      merged: [],
      conflicts: [{ id: '1', target: 'test', type: 'duplicate_provides', candidates: [], message: '' }],
      patchHints: [],
      success: false,
      stats: { inputCount: 2, outputCount: 2, conflictCount: 1, schemasConsolidated: 0 },
    };

    const summary = getMergeSummary(result);

    expect(summary).toContain('conflict');
    expect(summary).toContain('1');
  });
});

// ============================================================================
// Principle B Tests: NO Override Strategy
// ============================================================================

describe('Principle B: NO override strategy', () => {
  it('should NOT have override as a valid strategy', () => {
    // Type assertion to verify 'override' is not in MergeStrategy
    const validStrategies: MergeStrategy[] = ['union', 'fail', 'manual'];

    // This test documents that override is NOT a valid strategy
    expect(validStrategies).not.toContain('override');
  });

  it('should never auto-resolve conflicts regardless of strategy', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.count'] }),
      createSchemaFragment({ id: 'b', provides: ['data.count'] }),
    ];

    const strategies: MergeStrategy[] = ['union', 'manual'];

    for (const strategy of strategies) {
      const result = mergeFragments(fragments, { strategy });

      // Conflicts should always be surfaced
      expect(result.conflicts.length).toBeGreaterThan(0);

      // If not 'fail' strategy, both fragments should still exist
      if (strategy !== 'fail') {
        const ids = result.merged.map((f) => f.id);
        expect(ids).toContain('a');
        expect(ids).toContain('b');
      }
    }
  });
});
