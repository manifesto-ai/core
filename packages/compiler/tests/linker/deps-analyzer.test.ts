/**
 * Dependency Analyzer Tests
 *
 * Tests for Principle D: Effect deps need separate traversal from Expression deps.
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeExpressionDeps,
  analyzeEffectDeps,
  traverseEffectAST,
  analyzeFragmentDeps,
  buildFragmentDependencyGraph,
  detectCycles,
  topologicalSortFragments,
  getDependentFragments,
  getDependencyFragments,
  getPathProvider,
  hasNoDependencies,
  getRootFragments,
  type CategorizedDeps,
  type FragmentDepsAnalysis,
  type FragmentDependencyGraph,
} from '../../src/linker/deps-analyzer.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
  ExpressionFragment,
} from '../../src/types/fragment.js';
import type { Expression, Effect, ConditionRef } from '@manifesto-ai/core';

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

function createEffectFragment(overrides: Partial<EffectFragment> = {}): EffectFragment {
  return {
    id: 'effect-1',
    kind: 'EffectFragment',
    requires: ['data.count'],
    provides: ['effect:setCount'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    name: 'setCount',
    effect: {
      _tag: 'SetValue',
      path: 'data.count' as any,
      value: ['get', 'data.count'],
    },
    ...overrides,
  };
}

function createPolicyFragment(overrides: Partial<PolicyFragment> = {}): PolicyFragment {
  return {
    id: 'policy-1',
    kind: 'PolicyFragment',
    requires: ['derived.isValid'],
    provides: [],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    target: { kind: 'action', actionId: 'submit' },
    preconditions: [
      { path: 'derived.isValid' as any, expect: 'true', reason: 'Must be valid' },
    ],
    ...overrides,
  };
}

function createExpressionFragment(
  overrides: Partial<ExpressionFragment> = {}
): ExpressionFragment {
  return {
    id: 'expr-1',
    kind: 'ExpressionFragment',
    requires: ['data.a', 'data.b'],
    provides: [],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    name: 'sum',
    expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
    ...overrides,
  };
}

// ============================================================================
// analyzeExpressionDeps Tests
// ============================================================================

describe('analyzeExpressionDeps', () => {
  it('should extract paths from simple get expression', () => {
    const expr: Expression = ['get', 'data.count'];
    const deps = analyzeExpressionDeps(expr);

    expect(deps).toContain('data.count');
  });

  it('should extract paths from binary expression', () => {
    const expr: Expression = ['+', ['get', 'data.a'], ['get', 'data.b']];
    const deps = analyzeExpressionDeps(expr);

    expect(deps).toContain('data.a');
    expect(deps).toContain('data.b');
  });

  it('should extract paths from nested expression', () => {
    const expr: Expression = ['*', ['+', ['get', 'data.x'], ['get', 'data.y']], ['get', 'data.z']];
    const deps = analyzeExpressionDeps(expr);

    expect(deps).toContain('data.x');
    expect(deps).toContain('data.y');
    expect(deps).toContain('data.z');
    expect(deps).toHaveLength(3);
  });

  it('should extract paths from conditional expression', () => {
    const expr: Expression = ['if', ['get', 'data.condition'], ['get', 'data.a'], ['get', 'data.b']];
    const deps = analyzeExpressionDeps(expr);

    expect(deps).toContain('data.condition');
    expect(deps).toContain('data.a');
    expect(deps).toContain('data.b');
  });

  it('should return empty array for literal values', () => {
    const expr: Expression = 42;
    const deps = analyzeExpressionDeps(expr);

    expect(deps).toEqual([]);
  });
});

// ============================================================================
// traverseEffectAST / analyzeEffectDeps Tests (Principle D)
// ============================================================================

describe('traverseEffectAST', () => {
  describe('SetValue', () => {
    it('should extract write path from SetValue', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.count' as any,
        value: 10,
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.count');
    });

    it('should extract read paths from SetValue value expression', () => {
      const effect: Effect = {
        _tag: 'SetValue',
        path: 'data.result' as any,
        value: ['+', ['get', 'data.a'], ['get', 'data.b']],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.result');
      expect(deps.readPaths).toContain('data.a');
      expect(deps.readPaths).toContain('data.b');
    });
  });

  describe('SetState', () => {
    it('should extract write path from SetState', () => {
      const effect: Effect = {
        _tag: 'SetState',
        path: 'state.loading' as any,
        value: true,
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('state.loading');
    });

    it('should extract read paths from SetState value expression', () => {
      const effect: Effect = {
        _tag: 'SetState',
        path: 'state.error' as any,
        value: ['get', 'data.errorMessage'],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('state.error');
      expect(deps.readPaths).toContain('data.errorMessage');
    });
  });

  describe('Sequence', () => {
    it('should traverse all effects in sequence', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as any, value: 1 },
          { _tag: 'SetValue', path: 'data.b' as any, value: ['get', 'data.x'] },
          { _tag: 'SetState', path: 'state.done' as any, value: true },
        ],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.a');
      expect(deps.writePaths).toContain('data.b');
      expect(deps.writePaths).toContain('state.done');
      expect(deps.readPaths).toContain('data.x');
    });
  });

  describe('Parallel', () => {
    it('should traverse all effects in parallel', () => {
      const effect: Effect = {
        _tag: 'Parallel',
        effects: [
          { _tag: 'SetValue', path: 'data.a' as any, value: ['get', 'data.x'] },
          { _tag: 'SetValue', path: 'data.b' as any, value: ['get', 'data.y'] },
        ],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.a');
      expect(deps.writePaths).toContain('data.b');
      expect(deps.readPaths).toContain('data.x');
      expect(deps.readPaths).toContain('data.y');
    });
  });

  describe('Conditional', () => {
    it('should extract condition deps and traverse branches', () => {
      const effect: Effect = {
        _tag: 'Conditional',
        condition: ['get', 'data.shouldUpdate'],
        then: { _tag: 'SetValue', path: 'data.a' as any, value: 1 },
        else: { _tag: 'SetValue', path: 'data.b' as any, value: 2 },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toContain('data.shouldUpdate');
      expect(deps.writePaths).toContain('data.a');
      expect(deps.writePaths).toContain('data.b');
    });

    it('should handle conditional without else branch', () => {
      const effect: Effect = {
        _tag: 'Conditional',
        condition: ['get', 'data.condition'],
        then: { _tag: 'SetValue', path: 'data.result' as any, value: 1 },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toContain('data.condition');
      expect(deps.writePaths).toContain('data.result');
    });
  });

  describe('Catch', () => {
    it('should traverse try, catch, and finally branches', () => {
      const effect: Effect = {
        _tag: 'Catch',
        try: { _tag: 'SetValue', path: 'data.a' as any, value: ['get', 'data.x'] },
        catch: { _tag: 'SetValue', path: 'data.error' as any, value: 'error' },
        finally: { _tag: 'SetState', path: 'state.loading' as any, value: false },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.a');
      expect(deps.writePaths).toContain('data.error');
      expect(deps.writePaths).toContain('state.loading');
      expect(deps.readPaths).toContain('data.x');
    });

    it('should handle Catch without finally', () => {
      const effect: Effect = {
        _tag: 'Catch',
        try: { _tag: 'SetValue', path: 'data.a' as any, value: 1 },
        catch: { _tag: 'SetValue', path: 'data.error' as any, value: 'error' },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('data.a');
      expect(deps.writePaths).toContain('data.error');
    });
  });

  describe('ApiCall', () => {
    it('should extract deps from body expressions', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        method: 'POST',
        endpoint: '/api/submit',
        body: {
          value: ['get', 'data.formValue'],
          count: ['get', 'data.count'],
        },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toContain('data.formValue');
      expect(deps.readPaths).toContain('data.count');
      expect(deps.asyncTriggerPaths).toContain('async.apiCall');
    });

    it('should extract deps from query expressions', () => {
      const effect: Effect = {
        _tag: 'ApiCall',
        method: 'GET',
        endpoint: '/api/search',
        query: {
          q: ['get', 'data.searchTerm'],
        },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toContain('data.searchTerm');
      expect(deps.asyncTriggerPaths).toContain('async.apiCall');
    });
  });

  describe('EmitEvent', () => {
    it('should not extract path dependencies', () => {
      const effect: Effect = {
        _tag: 'EmitEvent',
        channel: 'user.created',
        payload: { id: '123' },
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toHaveLength(0);
      expect(deps.writePaths).toHaveLength(0);
    });
  });

  describe('Delay', () => {
    it('should not extract path dependencies', () => {
      const effect: Effect = {
        _tag: 'Delay',
        ms: 1000,
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toHaveLength(0);
      expect(deps.writePaths).toHaveLength(0);
    });
  });

  describe('Navigate', () => {
    it('should extract deps from dynamic path', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: ['concat', '/user/', ['get', 'data.userId']],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toContain('data.userId');
    });

    it('should not extract deps from static path', () => {
      const effect: Effect = {
        _tag: 'Navigate',
        to: '/home',
      };

      const deps = traverseEffectAST(effect);

      expect(deps.readPaths).toHaveLength(0);
    });
  });

  describe('nested complex effects', () => {
    it('should handle deeply nested effects', () => {
      const effect: Effect = {
        _tag: 'Sequence',
        effects: [
          { _tag: 'SetState', path: 'state.loading' as any, value: true },
          {
            _tag: 'Catch',
            try: {
              _tag: 'Conditional',
              condition: ['get', 'data.shouldFetch'],
              then: {
                _tag: 'ApiCall',
                method: 'GET',
                endpoint: '/api/data',
                query: { id: ['get', 'data.id'] },
              },
            },
            catch: { _tag: 'SetState', path: 'state.error' as any, value: 'Failed' },
          },
          { _tag: 'SetState', path: 'state.loading' as any, value: false },
        ],
      };

      const deps = traverseEffectAST(effect);

      expect(deps.writePaths).toContain('state.loading');
      expect(deps.writePaths).toContain('state.error');
      expect(deps.readPaths).toContain('data.shouldFetch');
      expect(deps.readPaths).toContain('data.id');
      expect(deps.asyncTriggerPaths).toContain('async.apiCall');
    });
  });
});

// ============================================================================
// analyzeFragmentDeps Tests
// ============================================================================

describe('analyzeFragmentDeps', () => {
  describe('DerivedFragment', () => {
    it('should analyze expression deps', () => {
      const fragment = createDerivedFragment({
        expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
      });
      const allProvides = new Set(['data.price', 'data.quantity']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.readPaths).toContain('data.price');
      expect(analysis.computedDeps.readPaths).toContain('data.quantity');
    });

    it('should report missing dependencies', () => {
      const fragment = createDerivedFragment({
        requires: ['data.price'],
        expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
      });
      const allProvides = new Set(['data.price']); // quantity not provided

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.missingDeps).toContain('data.quantity');
      expect(analysis.issues.some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
    });

    it('should report unused dependencies', () => {
      const fragment = createDerivedFragment({
        requires: ['data.price', 'data.unused'],
        expr: ['get', 'data.price'],
      });
      const allProvides = new Set(['data.price', 'data.unused']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.unusedDeps).toContain('data.unused');
      expect(analysis.issues.some((i) => i.code === 'UNUSED_PATH')).toBe(true);
    });
  });

  describe('ActionFragment', () => {
    it('should analyze precondition deps', () => {
      const fragment = createActionFragment({
        preconditions: [
          { path: 'derived.isValid' as any, expect: 'true', reason: 'Must be valid' },
          { path: 'derived.hasPermission' as any, expect: 'true', reason: 'Must have permission' },
        ],
      });
      const allProvides = new Set(['derived.isValid', 'derived.hasPermission']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.policyPaths).toContain('derived.isValid');
      expect(analysis.computedDeps.policyPaths).toContain('derived.hasPermission');
      expect(analysis.computedDeps.readPaths).toContain('derived.isValid');
    });

    it('should analyze inline effect deps', () => {
      const fragment = createActionFragment({
        effect: {
          _tag: 'SetValue',
          path: 'data.count' as any,
          value: ['+', ['get', 'data.count'], 1],
        },
      });
      const allProvides = new Set(['data.count']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.writePaths).toContain('data.count');
      expect(analysis.computedDeps.readPaths).toContain('data.count');
    });
  });

  describe('EffectFragment', () => {
    it('should analyze effect deps', () => {
      const fragment = createEffectFragment({
        effect: {
          _tag: 'Sequence',
          effects: [
            { _tag: 'SetValue', path: 'data.a' as any, value: ['get', 'data.x'] },
            { _tag: 'SetState', path: 'state.done' as any, value: true },
          ],
        },
      });
      const allProvides = new Set(['data.a', 'data.x', 'state.done']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.writePaths).toContain('data.a');
      expect(analysis.computedDeps.writePaths).toContain('state.done');
      expect(analysis.computedDeps.readPaths).toContain('data.x');
    });
  });

  describe('PolicyFragment', () => {
    it('should analyze precondition deps', () => {
      const fragment = createPolicyFragment({
        preconditions: [
          { path: 'derived.canSubmit' as any, expect: 'true', reason: 'Can submit' },
        ],
      });
      const allProvides = new Set(['derived.canSubmit']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.policyPaths).toContain('derived.canSubmit');
    });

    it('should analyze field policy deps', () => {
      const fragment = createPolicyFragment({
        target: { kind: 'field', path: 'data.email' as any },
        preconditions: [],
        fieldPolicy: {
          relevantWhen: [{ path: 'data.showEmail' as any, expect: 'true' }],
          editableWhen: [{ path: 'data.isEditing' as any, expect: 'true' }],
          requiredWhen: [{ path: 'data.isRequired' as any, expect: 'true' }],
        },
      });
      const allProvides = new Set(['data.showEmail', 'data.isEditing', 'data.isRequired']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.policyPaths).toContain('data.showEmail');
      expect(analysis.computedDeps.policyPaths).toContain('data.isEditing');
      expect(analysis.computedDeps.policyPaths).toContain('data.isRequired');
    });
  });

  describe('ExpressionFragment', () => {
    it('should analyze expression deps', () => {
      const fragment = createExpressionFragment({
        expr: ['and', ['get', 'data.a'], ['get', 'data.b']],
      });
      const allProvides = new Set(['data.a', 'data.b']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.readPaths).toContain('data.a');
      expect(analysis.computedDeps.readPaths).toContain('data.b');
    });
  });

  describe('SchemaFragment', () => {
    it('should have no computed deps', () => {
      const fragment = createSchemaFragment();
      const allProvides = new Set(['data.count']);

      const analysis = analyzeFragmentDeps(fragment, allProvides);

      expect(analysis.computedDeps.readPaths).toHaveLength(0);
      expect(analysis.computedDeps.writePaths).toHaveLength(0);
    });
  });
});

// ============================================================================
// buildFragmentDependencyGraph Tests
// ============================================================================

describe('buildFragmentDependencyGraph', () => {
  it('should build graph with path providers', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-count', provides: ['data.count'] }),
      createDerivedFragment({
        id: 'derived-doubled',
        requires: ['data.count'],
        provides: ['derived.doubled'],
        expr: ['*', ['get', 'data.count'], 2],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);

    expect(graph.pathProviders.get('data.count' as any)).toBe('schema-count');
    expect(graph.pathProviders.get('derived.doubled' as any)).toBe('derived-doubled');
  });

  it('should build dependency edges', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-count', provides: ['data.count'] }),
      createDerivedFragment({
        id: 'derived-doubled',
        requires: ['data.count'],
        provides: ['derived.doubled'],
        expr: ['*', ['get', 'data.count'], 2],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);

    const deps = graph.dependencies.get('derived-doubled');
    expect(deps?.has('schema-count')).toBe(true);

    const dependents = graph.dependents.get('schema-count');
    expect(dependents?.has('derived-doubled')).toBe(true);
  });

  it('should skip action: and effect: provides when building path providers', () => {
    const fragments: Fragment[] = [
      createActionFragment({
        id: 'action-submit',
        provides: ['action:submit', 'data.result'],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);

    expect(graph.pathProviders.has('action:submit' as any)).toBe(false);
    expect(graph.pathProviders.get('data.result' as any)).toBe('action-submit');
  });

  it('should collect categorized deps for each fragment', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-price', provides: ['data.price'] }),
      createSchemaFragment({ id: 'schema-qty', provides: ['data.quantity'] }),
      createDerivedFragment({
        id: 'derived-total',
        provides: ['derived.total'],
        expr: ['*', ['get', 'data.price'], ['get', 'data.quantity']],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);

    const totalDeps = graph.categorizedDeps.get('derived-total');
    expect(totalDeps?.readPaths).toContain('data.price');
    expect(totalDeps?.readPaths).toContain('data.quantity');
  });
});

// ============================================================================
// detectCycles Tests
// ============================================================================

describe('detectCycles', () => {
  it('should detect no cycles in acyclic graph', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        expr: ['get', 'data.a'],
      }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        expr: ['get', 'derived.b'],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const result = detectCycles(graph);

    expect(result.hasCycles).toBe(false);
    expect(result.cycles).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect direct cycle', () => {
    // Create a cycle: a -> b -> a
    const dependencies = new Map<string, Set<string>>();
    dependencies.set('a', new Set(['b']));
    dependencies.set('b', new Set(['a']));

    const graph: FragmentDependencyGraph = {
      dependencies,
      dependents: new Map(),
      pathProviders: new Map(),
      categorizedDeps: new Map(),
    };

    const result = detectCycles(graph);

    expect(result.hasCycles).toBe(true);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
  });

  it('should detect indirect cycle', () => {
    // Create a cycle: a -> b -> c -> a
    const dependencies = new Map<string, Set<string>>();
    dependencies.set('a', new Set(['b']));
    dependencies.set('b', new Set(['c']));
    dependencies.set('c', new Set(['a']));

    const graph: FragmentDependencyGraph = {
      dependencies,
      dependents: new Map(),
      pathProviders: new Map(),
      categorizedDeps: new Map(),
    };

    const result = detectCycles(graph);

    expect(result.hasCycles).toBe(true);
  });

  it('should handle independent subgraphs', () => {
    const dependencies = new Map<string, Set<string>>();
    dependencies.set('a', new Set(['b']));
    dependencies.set('b', new Set());
    dependencies.set('c', new Set(['d']));
    dependencies.set('d', new Set());

    const graph: FragmentDependencyGraph = {
      dependencies,
      dependents: new Map(),
      pathProviders: new Map(),
      categorizedDeps: new Map(),
    };

    const result = detectCycles(graph);

    expect(result.hasCycles).toBe(false);
  });
});

// ============================================================================
// topologicalSortFragments Tests
// ============================================================================

describe('topologicalSortFragments', () => {
  it('should sort fragments in dependency order', () => {
    const schemaA = createSchemaFragment({ id: 'a', provides: ['data.a'] });
    const derivedB = createDerivedFragment({
      id: 'b',
      provides: ['derived.b'],
      expr: ['get', 'data.a'],
    });
    const derivedC = createDerivedFragment({
      id: 'c',
      provides: ['derived.c'],
      expr: ['get', 'derived.b'],
    });

    const fragments = [derivedC, derivedB, schemaA]; // Intentionally out of order
    const graph = buildFragmentDependencyGraph(fragments);
    const sorted = topologicalSortFragments(fragments, graph);

    expect(sorted).not.toBeNull();
    if (sorted) {
      const aIndex = sorted.findIndex((f) => f.id === 'a');
      const bIndex = sorted.findIndex((f) => f.id === 'b');
      const cIndex = sorted.findIndex((f) => f.id === 'c');

      expect(aIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(cIndex);
    }
  });

  it('should return null for cyclic graph', () => {
    const dependencies = new Map<string, Set<string>>();
    dependencies.set('a', new Set(['b']));
    dependencies.set('b', new Set(['a']));

    const graph: FragmentDependencyGraph = {
      dependencies,
      dependents: new Map(),
      pathProviders: new Map(),
      categorizedDeps: new Map(),
    };

    const fragments = [
      createSchemaFragment({ id: 'a' }),
      createSchemaFragment({ id: 'b' }),
    ];

    const sorted = topologicalSortFragments(fragments, graph);

    expect(sorted).toBeNull();
  });

  it('should handle independent fragments', () => {
    const schemaA = createSchemaFragment({ id: 'a', provides: ['data.a'] });
    const schemaB = createSchemaFragment({ id: 'b', provides: ['data.b'] });
    const schemaC = createSchemaFragment({ id: 'c', provides: ['data.c'] });

    const fragments = [schemaC, schemaA, schemaB];
    const graph = buildFragmentDependencyGraph(fragments);
    const sorted = topologicalSortFragments(fragments, graph);

    expect(sorted).not.toBeNull();
    expect(sorted).toHaveLength(3);
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('getDependentFragments', () => {
  it('should return fragments that depend on given fragment', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        expr: ['get', 'data.a'],
      }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        expr: ['get', 'data.a'],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const dependents = getDependentFragments('a', graph);

    expect(dependents).toContain('b');
    expect(dependents).toContain('c');
  });
});

describe('getDependencyFragments', () => {
  it('should return fragments that given fragment depends on', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'] }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        expr: ['+', ['get', 'data.a'], ['get', 'data.b']],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const deps = getDependencyFragments('c', graph);

    expect(deps).toContain('a');
    expect(deps).toContain('b');
  });
});

describe('getPathProvider', () => {
  it('should return fragment that provides given path', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-count', provides: ['data.count'] }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const provider = getPathProvider('data.count' as any, graph);

    expect(provider).toBe('schema-count');
  });

  it('should return undefined for unknown path', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-count', provides: ['data.count'] }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const provider = getPathProvider('data.unknown' as any, graph);

    expect(provider).toBeUndefined();
  });
});

describe('hasNoDependencies', () => {
  it('should return true for root fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        expr: ['get', 'data.a'],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);

    expect(hasNoDependencies('a', graph)).toBe(true);
    expect(hasNoDependencies('b', graph)).toBe(false);
  });
});

describe('getRootFragments', () => {
  it('should return all fragments with no dependencies', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'] }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        expr: ['get', 'data.a'],
      }),
    ];

    const graph = buildFragmentDependencyGraph(fragments);
    const roots = getRootFragments(graph);

    expect(roots).toContain('a');
    expect(roots).toContain('b');
    expect(roots).not.toContain('c');
  });
});
