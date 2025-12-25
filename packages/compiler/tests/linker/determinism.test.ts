/**
 * Determinism Tests (Principle E)
 *
 * These tests verify that the linker produces identical results
 * regardless of input order. This is critical for reproducibility.
 *
 * Principle E: Determinism must be enforced via sorting rules + tests
 */

import { describe, it, expect } from 'vitest';
import { link, linkExtended } from '../../src/linker/index.js';
import { sortFragmentsByStableId } from '../../src/linker/normalizer.js';
import { sortConflicts } from '../../src/linker/conflict-detector.js';
import type {
  Fragment,
  SchemaFragment,
  DerivedFragment,
  ActionFragment,
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
    semantic: { type: 'number', description: 'Doubled count' },
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
    effect: {
      _tag: 'SetValue',
      path: 'data.count' as any,
      value: ['+', ['get', 'data.count'], 1],
    },
    semantic: { verb: 'increment', description: 'Increment count' },
    ...overrides,
  };
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ============================================================================
// sortFragmentsByStableId Tests
// ============================================================================

describe('sortFragmentsByStableId', () => {
  it('should sort fragments alphabetically by ID', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'zebra' }),
      createSchemaFragment({ id: 'alpha' }),
      createSchemaFragment({ id: 'mike' }),
    ];

    const sorted = sortFragmentsByStableId(fragments);

    expect(sorted[0].id).toBe('alpha');
    expect(sorted[1].id).toBe('mike');
    expect(sorted[2].id).toBe('zebra');
  });

  it('should produce same order regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'c' }),
      createSchemaFragment({ id: 'a' }),
      createSchemaFragment({ id: 'b' }),
    ];

    const sorted1 = sortFragmentsByStableId(fragments);
    const sorted2 = sortFragmentsByStableId([...fragments].reverse());
    const sorted3 = sortFragmentsByStableId(shuffle(fragments));

    expect(sorted1.map((f) => f.id)).toEqual(sorted2.map((f) => f.id));
    expect(sorted2.map((f) => f.id)).toEqual(sorted3.map((f) => f.id));
  });

  it('should not mutate original array', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'b' }),
      createSchemaFragment({ id: 'a' }),
    ];
    const originalFirst = fragments[0].id;

    sortFragmentsByStableId(fragments);

    expect(fragments[0].id).toBe(originalFirst);
  });
});

// ============================================================================
// link() Determinism Tests
// ============================================================================

describe('link() determinism', () => {
  it('should produce identical fragment order regardless of input order', () => {
    const schema = createSchemaFragment({ id: 'schema-1' });
    const derived = createDerivedFragment({ id: 'derived-1' });
    const action = createActionFragment({ id: 'action-1' });

    const order1 = [schema, derived, action];
    const order2 = [action, schema, derived];
    const order3 = [derived, action, schema];

    const result1 = link(order1);
    const result2 = link(order2);
    const result3 = link(order3);

    // All results should have same fragment order
    expect(result1.fragments.map((f) => f.id)).toEqual(result2.fragments.map((f) => f.id));
    expect(result2.fragments.map((f) => f.id)).toEqual(result3.fragments.map((f) => f.id));
  });

  it('should produce identical conflict order regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x'] }),
      createSchemaFragment({ id: 'c', provides: ['data.y'] }),
      createSchemaFragment({ id: 'd', provides: ['data.y'] }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());
    const result3 = link(shuffle(fragments));

    // Conflict targets should be in same order
    expect(result1.conflicts.map((c) => c.target)).toEqual(
      result2.conflicts.map((c) => c.target)
    );
    expect(result2.conflicts.map((c) => c.target)).toEqual(
      result3.conflicts.map((c) => c.target)
    );
  });

  it('should produce identical issue order regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        fields: [{ path: 'data.x', type: 'unknownType1', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        fields: [{ path: 'data.y', type: 'unknownType2', semantic: {} }],
      }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());

    // Issue codes should be in same order
    expect(result1.issues.map((i) => i.code)).toEqual(result2.issues.map((i) => i.code));
  });

  it('should produce identical domain schema regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'c',
        namespace: 'data',
        provides: ['data.c'],
        fields: [{ path: 'data.c', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        provides: ['data.a'],
        fields: [{ path: 'data.a', type: 'string', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        provides: ['data.b'],
        fields: [{ path: 'data.b', type: 'boolean', semantic: {} }],
      }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());
    const result3 = link(shuffle(fragments));

    // Domain schemas should have same keys
    const keys1 = Object.keys(result1.domain!.dataSchema).sort();
    const keys2 = Object.keys(result2.domain!.dataSchema).sort();
    const keys3 = Object.keys(result3.domain!.dataSchema).sort();

    expect(keys1).toEqual(keys2);
    expect(keys2).toEqual(keys3);
  });

  it('should produce identical derived definitions regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema', provides: ['data.x', 'data.y'] }),
      createDerivedFragment({
        id: 'derived-z',
        path: 'derived.z',
        provides: ['derived.z'],
        requires: ['data.x'],
        expr: ['get', 'data.x'],
      }),
      createDerivedFragment({
        id: 'derived-w',
        path: 'derived.w',
        provides: ['derived.w'],
        requires: ['data.y'],
        expr: ['get', 'data.y'],
      }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());

    const derivedKeys1 = Object.keys(result1.domain!.derived).sort();
    const derivedKeys2 = Object.keys(result2.domain!.derived).sort();

    expect(derivedKeys1).toEqual(derivedKeys2);
  });

  it('should produce identical action definitions regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema' }),
      createActionFragment({ id: 'action-z', actionId: 'actionZ', provides: ['action:actionZ'] }),
      createActionFragment({ id: 'action-a', actionId: 'actionA', provides: ['action:actionA'] }),
      createActionFragment({ id: 'action-m', actionId: 'actionM', provides: ['action:actionM'] }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());

    const actionKeys1 = Object.keys(result1.domain!.actions).sort();
    const actionKeys2 = Object.keys(result2.domain!.actions).sort();

    expect(actionKeys1).toEqual(actionKeys2);
  });
});

// ============================================================================
// sortConflicts Determinism Tests
// ============================================================================

describe('sortConflicts determinism', () => {
  it('should sort conflicts deterministically', () => {
    const conflicts = [
      { id: '1', target: 'data.z', type: 'duplicate_provides' as const, candidates: ['b', 'a'], message: '' },
      { id: '2', target: 'data.a', type: 'duplicate_provides' as const, candidates: ['a', 'b'], message: '' },
      { id: '3', target: 'action:z', type: 'semantic_mismatch' as const, candidates: ['a'], message: '' },
    ];

    const sorted1 = sortConflicts(conflicts);
    const sorted2 = sortConflicts([...conflicts].reverse());

    expect(sorted1.map((c) => c.target)).toEqual(sorted2.map((c) => c.target));
  });

  it('should produce same order for any input permutation', () => {
    const conflicts = [
      { id: '1', target: 'x', type: 'duplicate_provides' as const, candidates: [], message: '' },
      { id: '2', target: 'y', type: 'schema_mismatch' as const, candidates: [], message: '' },
      { id: '3', target: 'z', type: 'semantic_mismatch' as const, candidates: [], message: '' },
    ];

    // Test multiple random permutations
    for (let i = 0; i < 5; i++) {
      const shuffled = shuffle(conflicts);
      const sorted = sortConflicts(shuffled);

      // First should be duplicate_provides (sorted first by type)
      expect(sorted[0].type).toBe('duplicate_provides');
    }
  });
});

// ============================================================================
// Multiple Run Consistency Tests
// ============================================================================

describe('multiple run consistency', () => {
  it('should produce identical results across multiple runs', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'schema-data',
        namespace: 'data',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
      createDerivedFragment({
        id: 'derived-doubled',
        provides: ['derived.doubled'],
      }),
      createActionFragment({
        id: 'action-increment',
        actionId: 'increment',
      }),
    ];

    const results: ReturnType<typeof link>[] = [];

    // Run link multiple times
    for (let i = 0; i < 5; i++) {
      results.push(link(shuffle(fragments)));
    }

    // All results should have same fragment IDs in same order
    const firstIds = results[0].fragments.map((f) => f.id);
    for (const result of results.slice(1)) {
      expect(result.fragments.map((f) => f.id)).toEqual(firstIds);
    }

    // All results should have same domain structure
    const firstDomainKeys = Object.keys(results[0].domain!.dataSchema).sort();
    for (const result of results.slice(1)) {
      expect(Object.keys(result.domain!.dataSchema).sort()).toEqual(firstDomainKeys);
    }
  });

  it('should produce identical extended results across multiple runs', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a' }),
      createSchemaFragment({ id: 'b', provides: ['data.b'] }),
    ];

    const results: ReturnType<typeof linkExtended>[] = [];

    for (let i = 0; i < 3; i++) {
      results.push(linkExtended(shuffle(fragments)));
    }

    // Normalization should be consistent
    const firstProvidedPaths = [...results[0].normalization!.allProvidedPaths];
    for (const result of results.slice(1)) {
      expect([...result.normalization!.allProvidedPaths]).toEqual(firstProvidedPaths);
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('determinism edge cases', () => {
  it('should handle empty fragment array', () => {
    const result1 = link([]);
    const result2 = link([]);

    expect(result1.fragments.length).toBe(result2.fragments.length);
    expect(result1.conflicts.length).toBe(result2.conflicts.length);
  });

  it('should handle single fragment', () => {
    const fragment = createSchemaFragment({ id: 'single' });

    const result1 = link([fragment]);
    const result2 = link([fragment]);

    expect(result1.fragments.map((f) => f.id)).toEqual(result2.fragments.map((f) => f.id));
  });

  it('should handle fragments with same prefix IDs', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-10', provides: ['data.a10'] }),
      createSchemaFragment({ id: 'schema-1', provides: ['data.a1'] }),
      createSchemaFragment({ id: 'schema-2', provides: ['data.a2'] }),
    ];

    const result1 = link(fragments);
    const result2 = link([...fragments].reverse());

    // Should sort by string comparison (1 < 10 < 2 in string sort)
    expect(result1.fragments.map((f) => f.id)).toEqual(result2.fragments.map((f) => f.id));
  });

  it('should handle large number of fragments', () => {
    const fragments: Fragment[] = [];
    for (let i = 0; i < 50; i++) {
      fragments.push(
        createSchemaFragment({
          id: `schema-${String(i).padStart(3, '0')}`,
          provides: [`data.field${i}`],
          fields: [{ path: `data.field${i}`, type: 'number', semantic: {} }],
        })
      );
    }

    const shuffled1 = shuffle(fragments);
    const shuffled2 = shuffle(fragments);

    const result1 = link(shuffled1);
    const result2 = link(shuffled2);

    expect(result1.fragments.map((f) => f.id)).toEqual(result2.fragments.map((f) => f.id));
  });
});
