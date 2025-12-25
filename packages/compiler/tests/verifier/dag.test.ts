/**
 * DAG Validation Tests
 *
 * Tests for Directed Acyclic Graph validation including:
 * - Cycle detection
 * - Missing dependency detection
 * - Topological sorting
 */

import { describe, it, expect } from 'vitest';
import {
  buildDependencyGraphFromFragments,
  buildDependencyGraphFromDomain,
  buildDependencyGraph,
  detectCyclesInGraph,
  validateDependencyExists,
  validateGraphDependencies,
  topologicalSort,
  validateDag,
  validateDagFromFragments,
  validateDomainDag,
  hasCycles,
  hasAllDependencies,
  type DependencyInfo,
  type DependencyGraph,
} from '../../src/verifier/dag.js';
import type {
  Fragment,
  SchemaFragment,
  DerivedFragment,
  ActionFragment,
} from '../../src/types/fragment.js';
import type { LinkResult, DomainDraft } from '../../src/types/session.js';
import type { SemanticPath } from '@manifesto-ai/core';

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
    fields: [{ path: 'data.count', type: 'number', semantic: {} }],
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
    semantic: {},
    ...overrides,
  };
}

function createMinimalLinkResult(fragments: Fragment[]): LinkResult {
  return {
    fragments,
    conflicts: [],
    issues: [],
    version: 'test',
  };
}

// ============================================================================
// buildDependencyGraphFromFragments Tests
// ============================================================================

describe('buildDependencyGraphFromFragments', () => {
  it('should build graph from simple fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.x'] }),
      createDerivedFragment({
        provides: ['derived.y'],
        requires: ['data.x'],
      }),
    ];

    const graph = buildDependencyGraphFromFragments(fragments);

    expect(graph.allPaths.has('data.x' as SemanticPath)).toBe(true);
    expect(graph.allPaths.has('derived.y' as SemanticPath)).toBe(true);
    expect(graph.dependencies.get('derived.y' as SemanticPath)).toEqual(['data.x']);
  });

  it('should exclude action: prefixes', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.x', 'action:submit'] }),
    ];

    const graph = buildDependencyGraphFromFragments(fragments);

    expect(graph.allPaths.has('data.x' as SemanticPath)).toBe(true);
    expect(graph.allPaths.has('action:submit' as SemanticPath)).toBe(false);
  });

  it('should handle multiple dependencies', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'], requires: [] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'], requires: [] }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        requires: ['data.a', 'data.b'],
      }),
    ];

    const graph = buildDependencyGraphFromFragments(fragments);

    expect(graph.dependencies.get('derived.c' as SemanticPath)).toEqual(['data.a', 'data.b']);
  });

  it('should handle empty fragments', () => {
    const graph = buildDependencyGraphFromFragments([]);

    expect(graph.allPaths.size).toBe(0);
    expect(graph.dependencies.size).toBe(0);
  });
});

// ============================================================================
// buildDependencyGraphFromDomain Tests
// ============================================================================

describe('buildDependencyGraphFromDomain', () => {
  it('should build graph from domain', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: { 'data.x': { type: 'string' } },
      stateSchema: {},
      sources: {},
      derived: {
        'derived.y': {
          expr: ['get', 'data.x'],
          deps: ['data.x' as SemanticPath],
        },
      },
      actions: {},
    };

    const graph = buildDependencyGraphFromDomain(domain);

    expect(graph.allPaths.has('data.x' as SemanticPath)).toBe(true);
    expect(graph.allPaths.has('derived.y' as SemanticPath)).toBe(true);
    expect(graph.dependencies.get('derived.y' as SemanticPath)).toEqual(['data.x']);
  });

  it('should handle state schema paths', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: {},
      stateSchema: { 'state.loading': { type: 'boolean' } },
      sources: {},
      derived: {},
      actions: {},
    };

    const graph = buildDependencyGraphFromDomain(domain);

    expect(graph.allPaths.has('state.loading' as SemanticPath)).toBe(true);
    expect(graph.dependencies.get('state.loading' as SemanticPath)).toEqual([]);
  });

  it('should handle sources', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: {},
      stateSchema: {},
      sources: { 'data.input': { type: 'string', semantic: {} } },
      derived: {},
      actions: {},
    };

    const graph = buildDependencyGraphFromDomain(domain);

    expect(graph.allPaths.has('data.input' as SemanticPath)).toBe(true);
  });
});

// ============================================================================
// detectCyclesInGraph Tests
// ============================================================================

describe('detectCyclesInGraph', () => {
  it('should detect no cycles in acyclic graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b', 'c'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, []],
        ['b' as SemanticPath, ['a' as SemanticPath]],
        ['c' as SemanticPath, ['b' as SemanticPath]],
      ]),
    };

    const cycles = detectCyclesInGraph(graph);

    expect(cycles).toHaveLength(0);
  });

  it('should detect simple cycle', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, ['b' as SemanticPath]],
        ['b' as SemanticPath, ['a' as SemanticPath]],
      ]),
    };

    const cycles = detectCyclesInGraph(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect self-referencing cycle', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a'] as SemanticPath[]),
      dependencies: new Map([['a' as SemanticPath, ['a' as SemanticPath]]]),
    };

    const cycles = detectCyclesInGraph(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should detect cycle in larger graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b', 'c', 'd'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, []],
        ['b' as SemanticPath, ['a' as SemanticPath, 'c' as SemanticPath]],
        ['c' as SemanticPath, ['d' as SemanticPath]],
        ['d' as SemanticPath, ['b' as SemanticPath]], // Cycle: b -> c -> d -> b
      ]),
    };

    const cycles = detectCyclesInGraph(graph);

    expect(cycles.length).toBeGreaterThan(0);
  });

  it('should handle empty graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(),
      dependencies: new Map(),
    };

    const cycles = detectCyclesInGraph(graph);

    expect(cycles).toHaveLength(0);
  });
});

// ============================================================================
// validateDependencyExists Tests
// ============================================================================

describe('validateDependencyExists', () => {
  it('should pass when all dependencies exist', () => {
    const deps: DependencyInfo[] = [
      { path: 'derived.x' as SemanticPath, dependsOn: ['data.a' as SemanticPath, 'data.b' as SemanticPath] },
    ];
    const allPaths = new Set(['data.a', 'data.b', 'derived.x'] as SemanticPath[]);

    const issues = validateDependencyExists(deps, allPaths);

    expect(issues).toHaveLength(0);
  });

  it('should report missing dependency', () => {
    const deps: DependencyInfo[] = [
      { path: 'derived.x' as SemanticPath, dependsOn: ['data.missing' as SemanticPath] },
    ];
    const allPaths = new Set(['derived.x'] as SemanticPath[]);

    const issues = validateDependencyExists(deps, allPaths);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('MISSING_DEPENDENCY');
    expect(issues[0].context?.missingDep).toBe('data.missing');
  });

  it('should report multiple missing dependencies', () => {
    const deps: DependencyInfo[] = [
      { path: 'derived.x' as SemanticPath, dependsOn: ['data.a' as SemanticPath, 'data.b' as SemanticPath] },
    ];
    const allPaths = new Set(['derived.x'] as SemanticPath[]);

    const issues = validateDependencyExists(deps, allPaths);

    expect(issues).toHaveLength(2);
  });

  it('should include fragment ID in issue', () => {
    const deps: DependencyInfo[] = [
      {
        path: 'derived.x' as SemanticPath,
        dependsOn: ['data.missing' as SemanticPath],
        fragmentId: 'frag-123',
      },
    ];
    const allPaths = new Set(['derived.x'] as SemanticPath[]);

    const issues = validateDependencyExists(deps, allPaths);

    expect(issues[0].relatedFragments).toEqual(['frag-123']);
  });
});

// ============================================================================
// validateGraphDependencies Tests
// ============================================================================

describe('validateGraphDependencies', () => {
  it('should validate graph with all deps present', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['data.a', 'derived.b'] as SemanticPath[]),
      dependencies: new Map([
        ['data.a' as SemanticPath, []],
        ['derived.b' as SemanticPath, ['data.a' as SemanticPath]],
      ]),
    };

    const issues = validateGraphDependencies(graph);

    expect(issues).toHaveLength(0);
  });

  it('should report missing deps in graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['derived.b'] as SemanticPath[]),
      dependencies: new Map([
        ['derived.b' as SemanticPath, ['data.missing' as SemanticPath]],
      ]),
    };

    const issues = validateGraphDependencies(graph);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('MISSING_DEPENDENCY');
  });

  it('should use provided paths if given', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['derived.b'] as SemanticPath[]),
      dependencies: new Map([
        ['derived.b' as SemanticPath, ['data.a' as SemanticPath]],
      ]),
    };
    const providedPaths = new Set(['data.a'] as SemanticPath[]);

    const issues = validateGraphDependencies(graph, providedPaths);

    expect(issues).toHaveLength(0);
  });
});

// ============================================================================
// topologicalSort Tests
// ============================================================================

describe('topologicalSort', () => {
  it('should sort acyclic graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b', 'c'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, []],
        ['b' as SemanticPath, ['a' as SemanticPath]],
        ['c' as SemanticPath, ['b' as SemanticPath]],
      ]),
    };

    const sorted = topologicalSort(graph);

    expect(sorted).not.toBeNull();
    // Dependencies should come before dependents
    expect(sorted!.indexOf('a' as SemanticPath)).toBeLessThan(sorted!.indexOf('b' as SemanticPath));
    expect(sorted!.indexOf('b' as SemanticPath)).toBeLessThan(sorted!.indexOf('c' as SemanticPath));
  });

  it('should return null for cyclic graph', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, ['b' as SemanticPath]],
        ['b' as SemanticPath, ['a' as SemanticPath]],
      ]),
    };

    const sorted = topologicalSort(graph);

    expect(sorted).toBeNull();
  });

  it('should handle independent nodes', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['a', 'b', 'c'] as SemanticPath[]),
      dependencies: new Map([
        ['a' as SemanticPath, []],
        ['b' as SemanticPath, []],
        ['c' as SemanticPath, []],
      ]),
    };

    const sorted = topologicalSort(graph);

    expect(sorted).not.toBeNull();
    expect(sorted!).toHaveLength(3);
  });

  it('should produce deterministic order', () => {
    const graph: DependencyGraph = {
      allPaths: new Set(['c', 'a', 'b'] as SemanticPath[]),
      dependencies: new Map([
        ['c' as SemanticPath, []],
        ['a' as SemanticPath, []],
        ['b' as SemanticPath, []],
      ]),
    };

    const sorted1 = topologicalSort(graph);
    const sorted2 = topologicalSort(graph);

    expect(sorted1).toEqual(sorted2);
    // Should be alphabetically sorted when no dependencies
    expect(sorted1).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================================
// validateDag Tests
// ============================================================================

describe('validateDag', () => {
  it('should validate valid DAG', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x'], requires: [] }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.y'],
        requires: ['data.x'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(true);
    expect(result.cycles).toHaveLength(0);
    expect(result.missingDependencies).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
    expect(result.sortedPaths).toBeDefined();
  });

  it('should detect cycles', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        id: 'a',
        provides: ['derived.a'],
        requires: ['derived.b'],
      }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        requires: ['derived.a'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
  });

  it('should detect missing dependencies', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        id: 'a',
        provides: ['derived.x'],
        requires: ['data.missing'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(false);
    expect(result.missingDependencies).toHaveLength(1);
    expect(result.missingDependencies[0].missingDep).toBe('data.missing');
  });

  it('should include sorted paths when valid', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'], requires: [] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'], requires: [] }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        requires: ['data.a', 'data.b'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.sortedPaths).toBeDefined();
    // data.a and data.b should come before derived.c
    const cIndex = result.sortedPaths!.indexOf('derived.c' as SemanticPath);
    const aIndex = result.sortedPaths!.indexOf('data.a' as SemanticPath);
    const bIndex = result.sortedPaths!.indexOf('data.b' as SemanticPath);
    expect(aIndex).toBeLessThan(cIndex);
    expect(bIndex).toBeLessThan(cIndex);
  });
});

// ============================================================================
// validateDagFromFragments Tests
// ============================================================================

describe('validateDagFromFragments', () => {
  it('should validate fragments directly', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.x'] }),
    ];

    const result = validateDagFromFragments(fragments);

    expect(result.isValid).toBe(true);
  });

  it('should detect issues in fragments', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        provides: ['derived.x'],
        requires: ['data.missing'],
      }),
    ];

    const result = validateDagFromFragments(fragments);

    expect(result.isValid).toBe(false);
    expect(result.missingDependencies.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// validateDomainDag Tests
// ============================================================================

describe('validateDomainDag', () => {
  it('should validate valid domain', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: { 'data.x': { type: 'number' } },
      stateSchema: {},
      sources: {},
      derived: {
        'derived.y': {
          expr: ['get', 'data.x'],
          deps: ['data.x' as SemanticPath],
        },
      },
      actions: {},
    };

    const result = validateDomainDag(domain);

    expect(result.isValid).toBe(true);
  });

  it('should detect cycle in domain', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: {},
      stateSchema: {},
      sources: {},
      derived: {
        'derived.a': {
          expr: ['get', 'derived.b'],
          deps: ['derived.b' as SemanticPath],
        },
        'derived.b': {
          expr: ['get', 'derived.a'],
          deps: ['derived.a' as SemanticPath],
        },
      },
      actions: {},
    };

    const result = validateDomainDag(domain);

    expect(result.isValid).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);
  });

  it('should detect missing dep in domain', () => {
    const domain: DomainDraft = {
      id: 'test',
      name: 'Test',
      dataSchema: {},
      stateSchema: {},
      sources: {},
      derived: {
        'derived.x': {
          expr: ['get', 'data.missing'],
          deps: ['data.missing' as SemanticPath],
        },
      },
      actions: {},
    };

    const result = validateDomainDag(domain);

    expect(result.isValid).toBe(false);
    expect(result.missingDependencies.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('hasCycles', () => {
  it('should return false for acyclic graph', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.x'] }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    expect(hasCycles(linkResult)).toBe(false);
  });

  it('should return true for cyclic graph', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        id: 'a',
        provides: ['derived.a'],
        requires: ['derived.b'],
      }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        requires: ['derived.a'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    expect(hasCycles(linkResult)).toBe(true);
  });
});

describe('hasAllDependencies', () => {
  it('should return true when all deps exist', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.x'] }),
      createDerivedFragment({
        provides: ['derived.y'],
        requires: ['data.x'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    expect(hasAllDependencies(linkResult)).toBe(true);
  });

  it('should return false when deps missing', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        provides: ['derived.x'],
        requires: ['data.missing'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    expect(hasAllDependencies(linkResult)).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle fragments with no deps', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'], requires: [] }),
      createSchemaFragment({ id: 'b', provides: ['data.b'], requires: [] }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(true);
  });

  it('should handle empty fragment list', () => {
    const linkResult = createMinimalLinkResult([]);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(true);
    expect(result.cycles).toHaveLength(0);
    expect(result.missingDependencies).toHaveLength(0);
  });

  it('should handle complex dependency chains', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.a'], requires: [] }),
      createDerivedFragment({
        id: 'b',
        provides: ['derived.b'],
        requires: ['data.a'],
      }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.c'],
        requires: ['derived.b'],
      }),
      createDerivedFragment({
        id: 'd',
        provides: ['derived.d'],
        requires: ['derived.c', 'data.a'],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = validateDag(linkResult);

    expect(result.isValid).toBe(true);
    expect(result.sortedPaths).toBeDefined();
  });
});
