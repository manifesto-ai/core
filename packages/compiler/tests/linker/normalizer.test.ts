/**
 * Normalizer Tests
 *
 * Tests for path canonicalization and ActionId separation (Principle A)
 */

import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  normalizeFragmentProvides,
  normalizeFragmentRequires,
  normalizeAllFragments,
  sortFragmentsByStableId,
  isSemanticPath,
  isActionId,
  extractActionId,
  getPathNamespace,
  getPathLocalName,
  buildSemanticPath,
  isDataPath,
  isDerivedPath,
  isStatePath,
  isAsyncPath,
  type NormalizerContext,
} from '../../src/linker/normalizer.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
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

function createSourceFragment(overrides: Partial<SourceFragment> = {}): SourceFragment {
  return {
    id: 'source-1',
    kind: 'SourceFragment',
    requires: [],
    provides: ['data.input'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    path: 'data.input',
    semantic: { type: 'string', description: 'Input' },
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

// ============================================================================
// isSemanticPath Tests
// ============================================================================

describe('isSemanticPath', () => {
  it('should return true for data.* paths', () => {
    expect(isSemanticPath('data.count')).toBe(true);
    expect(isSemanticPath('data.user.name')).toBe(true);
    expect(isSemanticPath('data.items')).toBe(true);
  });

  it('should return true for derived.* paths', () => {
    expect(isSemanticPath('derived.total')).toBe(true);
    expect(isSemanticPath('derived.isValid')).toBe(true);
  });

  it('should return true for state.* paths', () => {
    expect(isSemanticPath('state.loading')).toBe(true);
    expect(isSemanticPath('state.error')).toBe(true);
  });

  it('should return true for async.* paths', () => {
    expect(isSemanticPath('async.fetch')).toBe(true);
    expect(isSemanticPath('async.fetch.data')).toBe(true);
  });

  it('should return false for non-semantic paths', () => {
    expect(isSemanticPath('count')).toBe(false);
    expect(isSemanticPath('action:submit')).toBe(false);
    expect(isSemanticPath('effect:doSomething')).toBe(false);
    expect(isSemanticPath('unknown.path')).toBe(false);
  });
});

// ============================================================================
// isActionId Tests
// ============================================================================

describe('isActionId', () => {
  it('should return true for action: prefixed strings', () => {
    expect(isActionId('action:submit')).toBe(true);
    expect(isActionId('action:increment')).toBe(true);
  });

  it('should return true for effect: prefixed strings', () => {
    expect(isActionId('effect:doSomething')).toBe(true);
  });

  it('should return true for simple identifiers without dots', () => {
    expect(isActionId('submit')).toBe(true);
    expect(isActionId('increment')).toBe(true);
    expect(isActionId('handleClick')).toBe(true);
  });

  it('should return false for semantic paths', () => {
    expect(isActionId('data.count')).toBe(false);
    expect(isActionId('derived.total')).toBe(false);
    expect(isActionId('state.loading')).toBe(false);
  });
});

// ============================================================================
// extractActionId Tests
// ============================================================================

describe('extractActionId', () => {
  it('should strip action: prefix', () => {
    expect(extractActionId('action:submit')).toBe('submit');
    expect(extractActionId('action:increment')).toBe('increment');
  });

  it('should return unchanged if no prefix', () => {
    expect(extractActionId('submit')).toBe('submit');
    expect(extractActionId('increment')).toBe('increment');
  });
});

// ============================================================================
// normalizePath Tests
// ============================================================================

describe('normalizePath', () => {
  it('should not modify already canonical paths', () => {
    const result = normalizePath('data.count');
    expect(result.normalized).toBe('data.count');
    expect(result.wasModified).toBe(false);
  });

  it('should add data. prefix to unqualified paths', () => {
    const result = normalizePath('count');
    expect(result.normalized).toBe('data.count');
    expect(result.wasModified).toBe(true);
    expect(result.appliedRule).toBe('add_data_prefix');
  });

  it('should trim whitespace', () => {
    const result = normalizePath('  data.count  ');
    expect(result.normalized).toBe('data.count');
    expect(result.wasModified).toBe(true);
    expect(result.appliedRule).toBe('trim');
  });

  it('should respect custom defaultNamespace', () => {
    const context: NormalizerContext = { defaultNamespace: 'state' };
    const result = normalizePath('loading', context);
    expect(result.normalized).toBe('state.loading');
  });

  it('should apply custom rules', () => {
    const context: NormalizerContext = {
      customRules: [
        {
          pattern: /^user_/,
          normalize: (path) => `data.user.${path.slice(5)}`,
          name: 'user_prefix',
        },
      ],
    };
    const result = normalizePath('user_name', context);
    expect(result.normalized).toBe('data.user.name');
    expect(result.appliedRule).toBe('user_prefix');
  });
});

// ============================================================================
// normalizeFragmentProvides Tests (Principle A)
// ============================================================================

describe('normalizeFragmentProvides', () => {
  it('should separate paths and actions for ActionFragment', () => {
    const fragment = createActionFragment({
      provides: ['action:increment', 'data.result'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.actions).toContain('increment');
    expect(result.paths).toContain('data.result');
  });

  it('should handle actionId without action: prefix', () => {
    const fragment = createActionFragment({
      provides: ['increment'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.actions).toContain('increment');
  });

  it('should handle SchemaFragment paths', () => {
    const fragment = createSchemaFragment({
      provides: ['data.count', 'data.name'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.paths).toContain('data.count');
    expect(result.paths).toContain('data.name');
    expect(result.actions).toHaveLength(0);
  });

  it('should add namespace to unqualified SchemaFragment paths', () => {
    const fragment = createSchemaFragment({
      namespace: 'state',
      provides: ['loading'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.paths).toContain('state.loading');
  });

  it('should handle DerivedFragment paths', () => {
    const fragment = createDerivedFragment({
      provides: ['derived.total'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.paths).toContain('derived.total');
    expect(result.actions).toHaveLength(0);
  });

  it('should handle SourceFragment paths', () => {
    const fragment = createSourceFragment({
      provides: ['data.input'],
    });
    const result = normalizeFragmentProvides(fragment);

    expect(result.paths).toContain('data.input');
    expect(result.actions).toHaveLength(0);
  });
});

// ============================================================================
// normalizeFragmentRequires Tests
// ============================================================================

describe('normalizeFragmentRequires', () => {
  it('should normalize requires paths', () => {
    const fragment = createDerivedFragment({
      requires: ['data.count', 'count2'],
    });
    const result = normalizeFragmentRequires(fragment);

    expect(result).toContain('data.count');
    expect(result).toContain('data.count2');
  });

  it('should not modify already canonical requires', () => {
    const fragment = createDerivedFragment({
      requires: ['data.a', 'derived.b', 'state.c'],
    });
    const result = normalizeFragmentRequires(fragment);

    expect(result).toEqual(['data.a', 'derived.b', 'state.c']);
  });
});

// ============================================================================
// normalizeAllFragments Tests (Principle A + E)
// ============================================================================

describe('normalizeAllFragments', () => {
  it('should collect all provided paths and actions', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.count'] }),
      createDerivedFragment({ provides: ['derived.doubled'] }),
      createActionFragment({ provides: ['action:increment'] }),
    ];

    const result = normalizeAllFragments(fragments);

    expect(result.allProvidedPaths.has('data.count')).toBe(true);
    expect(result.allProvidedPaths.has('derived.doubled')).toBe(true);
    expect(result.allProvidedActions.has('increment')).toBe(true);
  });

  it('should collect all required paths', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        requires: ['data.count', 'data.multiplier'],
      }),
    ];

    const result = normalizeAllFragments(fragments);

    expect(result.allRequiredPaths.has('data.count')).toBe(true);
    expect(result.allRequiredPaths.has('data.multiplier')).toBe(true);
  });

  it('should build normalizedProvidesMap', () => {
    const schema = createSchemaFragment();
    const action = createActionFragment();
    const fragments: Fragment[] = [schema, action];

    const result = normalizeAllFragments(fragments);

    expect(result.normalizedProvidesMap.has(schema.id)).toBe(true);
    expect(result.normalizedProvidesMap.has(action.id)).toBe(true);

    const schemaProvides = result.normalizedProvidesMap.get(schema.id)!;
    expect(schemaProvides.paths.length).toBeGreaterThan(0);

    const actionProvides = result.normalizedProvidesMap.get(action.id)!;
    expect(actionProvides.actions.length).toBeGreaterThan(0);
  });

  it('should sort fragments by stableId (Principle E: Determinism)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'z-fragment' }),
      createSchemaFragment({ id: 'a-fragment' }),
      createSchemaFragment({ id: 'm-fragment' }),
    ];

    const result = normalizeAllFragments(fragments);

    expect(result.fragments[0].id).toBe('a-fragment');
    expect(result.fragments[1].id).toBe('m-fragment');
    expect(result.fragments[2].id).toBe('z-fragment');
  });

  it('should produce identical results regardless of input order (Principle E)', () => {
    const schema = createSchemaFragment({ id: 'schema-1' });
    const derived = createDerivedFragment({ id: 'derived-1' });
    const action = createActionFragment({ id: 'action-1' });

    const order1 = [schema, derived, action];
    const order2 = [action, schema, derived];
    const order3 = [derived, action, schema];

    const result1 = normalizeAllFragments(order1);
    const result2 = normalizeAllFragments(order2);
    const result3 = normalizeAllFragments(order3);

    // All results should have same order of fragments
    expect(result1.fragments.map((f) => f.id)).toEqual(result2.fragments.map((f) => f.id));
    expect(result2.fragments.map((f) => f.id)).toEqual(result3.fragments.map((f) => f.id));

    // All results should have same provided paths
    expect([...result1.allProvidedPaths]).toEqual([...result2.allProvidedPaths]);
    expect([...result1.allProvidedActions]).toEqual([...result2.allProvidedActions]);
  });
});

// ============================================================================
// sortFragmentsByStableId Tests (Principle E)
// ============================================================================

describe('sortFragmentsByStableId', () => {
  it('should sort fragments alphabetically by id', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'zebra' }),
      createSchemaFragment({ id: 'alpha' }),
      createSchemaFragment({ id: 'beta' }),
    ];

    const sorted = sortFragmentsByStableId(fragments);

    expect(sorted[0].id).toBe('alpha');
    expect(sorted[1].id).toBe('beta');
    expect(sorted[2].id).toBe('zebra');
  });

  it('should not mutate original array', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'z' }),
      createSchemaFragment({ id: 'a' }),
    ];
    const originalFirst = fragments[0].id;

    sortFragmentsByStableId(fragments);

    expect(fragments[0].id).toBe(originalFirst);
  });
});

// ============================================================================
// Path Utility Functions Tests
// ============================================================================

describe('getPathNamespace', () => {
  it('should extract namespace from path', () => {
    expect(getPathNamespace('data.count' as any)).toBe('data');
    expect(getPathNamespace('derived.total' as any)).toBe('derived');
    expect(getPathNamespace('state.loading' as any)).toBe('state');
    expect(getPathNamespace('async.fetch' as any)).toBe('async');
  });
});

describe('getPathLocalName', () => {
  it('should extract local name from path', () => {
    expect(getPathLocalName('data.count' as any)).toBe('count');
    expect(getPathLocalName('data.user.name' as any)).toBe('user.name');
  });
});

describe('buildSemanticPath', () => {
  it('should build path from namespace and local name', () => {
    expect(buildSemanticPath('data', 'count')).toBe('data.count');
    expect(buildSemanticPath('derived', 'total')).toBe('derived.total');
  });
});

describe('namespace checks', () => {
  it('should correctly identify data paths', () => {
    expect(isDataPath('data.count' as any)).toBe(true);
    expect(isDataPath('derived.total' as any)).toBe(false);
  });

  it('should correctly identify derived paths', () => {
    expect(isDerivedPath('derived.total' as any)).toBe(true);
    expect(isDerivedPath('data.count' as any)).toBe(false);
  });

  it('should correctly identify state paths', () => {
    expect(isStatePath('state.loading' as any)).toBe(true);
    expect(isStatePath('data.count' as any)).toBe(false);
  });

  it('should correctly identify async paths', () => {
    expect(isAsyncPath('async.fetch' as any)).toBe(true);
    expect(isAsyncPath('data.count' as any)).toBe(false);
  });
});
