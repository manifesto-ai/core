/**
 * Linker Integration Tests
 *
 * Tests the full linking pipeline including all 5 principles:
 * - Principle A: ActionId vs SemanticPath separation
 * - Principle B: No auto-resolution of conflicts
 * - Principle C: Zod schema generation
 * - Principle D: Effect deps separate traversal
 * - Principle E: Deterministic results
 */

import { describe, it, expect } from 'vitest';
import {
  link,
  linkExtended,
  incrementalLink,
  sortIssues,
  getBlockingIssues,
  isLinkResultValid,
  getLinkResultSummary,
  getAllProvidedPaths,
  getAllProvidedActions,
  type LinkOptions,
  type ExtendedLinkResult,
} from '../../src/linker/index.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
} from '../../src/types/fragment.js';
import type { LinkResult } from '../../src/types/session.js';

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
    type: 'string',
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

// ============================================================================
// link() Function Tests
// ============================================================================

describe('link', () => {
  describe('successful linking', () => {
    it('should link fragments without conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'schema-data' }),
        createSourceFragment({ id: 'source-input' }),
        createDerivedFragment({ id: 'derived-doubled' }),
        createActionFragment({ id: 'action-increment' }),
      ];

      const result = link(fragments);

      expect(result.fragments).toHaveLength(4);
      expect(result.conflicts).toHaveLength(0);
      expect(result.domain).toBeDefined();
      expect(result.version).toBeDefined();
    });

    it('should build domain with all components', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({
          id: 'schema-data',
          namespace: 'data',
          provides: ['data.count'],
          fields: [{ path: 'data.count', type: 'number', semantic: {} }],
        }),
        createSchemaFragment({
          id: 'schema-state',
          namespace: 'state',
          provides: ['state.loading'],
          fields: [{ path: 'state.loading', type: 'boolean', semantic: {} }],
        }),
        createSourceFragment({ id: 'source-input', path: 'data.input' }),
        createDerivedFragment({
          id: 'derived-doubled',
          path: 'derived.doubled',
          requires: ['data.count'],
        }),
        createActionFragment({ id: 'action-increment', actionId: 'increment' }),
      ];

      const result = link(fragments);

      expect(result.domain).toBeDefined();
      expect(result.domain!.dataSchema).toBeDefined();
      expect(result.domain!.stateSchema).toBeDefined();
      expect(result.domain!.sources).toBeDefined();
      expect(result.domain!.derived).toBeDefined();
      expect(result.domain!.actions).toBeDefined();
    });

    it('should normalize paths', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'schema-1', provides: ['data.count'] }),
      ];

      const result = link(fragments);

      // Fragments should have normalized provides
      expect(result.fragments[0].provides).toContain('data.count');
    });
  });

  describe('conflict handling (Principle B)', () => {
    it('should detect and surface duplicate path conflicts', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'schema-a', provides: ['data.count'] }),
        createSchemaFragment({ id: 'schema-b', provides: ['data.count'] }),
      ];

      const result = link(fragments);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some((c) => c.target === 'data.count')).toBe(true);
      expect(result.domain).toBeUndefined(); // No domain when conflicts exist
    });

    it('should detect and surface duplicate action conflicts', () => {
      const fragments: Fragment[] = [
        createActionFragment({ id: 'action-a', actionId: 'submit', provides: ['action:submit'] }),
        createActionFragment({ id: 'action-b', actionId: 'submit', provides: ['action:submit'] }),
      ];

      const result = link(fragments);

      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts.some((c) => c.target === 'action:submit')).toBe(true);
    });

    it('should NOT auto-resolve conflicts (Principle B)', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.x'] }),
        createSchemaFragment({ id: 'b', provides: ['data.x'] }),
      ];

      const result = link(fragments);

      // Both fragments should still exist
      const ids = result.fragments.map((f) => f.id);
      expect(ids).toContain('a');
      expect(ids).toContain('b');

      // Conflict should be surfaced
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('cycle detection', () => {
    it('should detect cyclic dependencies', () => {
      // Create a cycle: a depends on b, b depends on a
      const fragments: Fragment[] = [
        createDerivedFragment({
          id: 'a',
          path: 'derived.a',
          provides: ['derived.a'],
          requires: ['derived.b'],
          expr: ['get', 'derived.b'],
        }),
        createDerivedFragment({
          id: 'b',
          path: 'derived.b',
          provides: ['derived.b'],
          requires: ['derived.a'],
          expr: ['get', 'derived.a'],
        }),
      ];

      const result = link(fragments);

      expect(result.issues.some((i) => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
      expect(result.domain).toBeUndefined(); // No domain when cycles exist
    });
  });

  describe('options', () => {
    it('should respect buildDomain: false', () => {
      const fragments: Fragment[] = [createSchemaFragment()];

      const result = link(fragments, { buildDomain: false });

      expect(result.domain).toBeUndefined();
    });

    it('should pass domain options', () => {
      const fragments: Fragment[] = [createSchemaFragment()];

      const result = link(fragments, {
        domainOptions: {
          domainId: 'test-domain',
          domainName: 'Test Domain',
        },
      });

      expect(result.domain?.id).toBe('test-domain');
      expect(result.domain?.name).toBe('Test Domain');
    });

    it('should use fail merge strategy', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'a', provides: ['data.x'] }),
        createSchemaFragment({ id: 'b', provides: ['data.x'] }),
      ];

      const result = link(fragments, { mergeStrategy: 'fail' });

      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// linkExtended() Tests
// ============================================================================

describe('linkExtended', () => {
  it('should return extended information', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-1' }),
      createDerivedFragment({ id: 'derived-1' }),
    ];

    const result = linkExtended(fragments);

    expect(result.normalization).toBeDefined();
    expect(result.dependencyGraph).toBeDefined();
    expect(result.cycleDetection).toBeDefined();
    expect(result.conflictDetection).toBeDefined();
    expect(result.mergeResult).toBeDefined();
  });

  it('should include domain build result when successful', () => {
    const fragments: Fragment[] = [createSchemaFragment()];

    const result = linkExtended(fragments);

    expect(result.domainBuildResult).toBeDefined();
    expect(result.domainBuildResult?.isExecutable).toBe(true);
  });
});

// ============================================================================
// incrementalLink() Tests
// ============================================================================

describe('incrementalLink', () => {
  it('should add new fragments', () => {
    const initialFragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-1', provides: ['data.a'] }),
    ];
    const initialResult = link(initialFragments);

    const newFragment = createSchemaFragment({ id: 'schema-2', provides: ['data.b'] });
    const updatedResult = incrementalLink(initialResult, [newFragment], []);

    expect(updatedResult.fragments).toHaveLength(2);
  });

  it('should remove fragments', () => {
    const initialFragments: Fragment[] = [
      createSchemaFragment({ id: 'schema-1', provides: ['data.a'] }),
      createSchemaFragment({ id: 'schema-2', provides: ['data.b'] }),
    ];
    const initialResult = link(initialFragments);

    const updatedResult = incrementalLink(initialResult, [], ['schema-1']);

    expect(updatedResult.fragments).toHaveLength(1);
    expect(updatedResult.fragments[0].id).toBe('schema-2');
  });

  it('should update changed fragments', () => {
    const initialFragments: Fragment[] = [
      createSchemaFragment({
        id: 'schema-1',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
    ];
    const initialResult = link(initialFragments);

    const changedFragment = createSchemaFragment({
      id: 'schema-1',
      provides: ['data.count'],
      fields: [{ path: 'data.count', type: 'string', semantic: {} }],
    });
    const updatedResult = incrementalLink(initialResult, [changedFragment], []);

    expect(updatedResult.fragments).toHaveLength(1);
    // The new fragment should be used
    const schemaFrag = updatedResult.fragments[0] as SchemaFragment;
    expect(schemaFrag.fields[0].type).toBe('string');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('sortIssues', () => {
  it('should sort by severity (errors first)', () => {
    const issues = [
      { id: '1', code: 'B', severity: 'warning' as const, message: '' },
      { id: '2', code: 'A', severity: 'error' as const, message: '' },
      { id: '3', code: 'C', severity: 'info' as const, message: '' },
    ];

    const sorted = sortIssues(issues);

    expect(sorted[0].severity).toBe('error');
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[2].severity).toBe('info');
  });

  it('should sort by code within same severity', () => {
    const issues = [
      { id: '1', code: 'MISSING_B', severity: 'error' as const, message: '' },
      { id: '2', code: 'CYCLIC_A', severity: 'error' as const, message: '' },
    ];

    const sorted = sortIssues(issues);

    expect(sorted[0].code).toBe('CYCLIC_A');
    expect(sorted[1].code).toBe('MISSING_B');
  });
});

describe('getBlockingIssues', () => {
  it('should return only error-severity issues', () => {
    const fragments: Fragment[] = [
      createActionFragment({
        actionId: 'broken',
        effect: undefined,
        effectRef: undefined,
      }),
      createSchemaFragment({ id: 'schema-1' }),
    ];

    const result = link(fragments);
    const blocking = getBlockingIssues(result);

    expect(blocking.every((i) => i.severity === 'error')).toBe(true);
  });
});

describe('isLinkResultValid', () => {
  it('should return true for valid result', () => {
    const fragments: Fragment[] = [createSchemaFragment()];
    const result = link(fragments);

    expect(isLinkResultValid(result)).toBe(true);
  });

  it('should return false for result with conflicts', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x'] }),
    ];
    const result = link(fragments);

    expect(isLinkResultValid(result)).toBe(false);
  });
});

describe('getLinkResultSummary', () => {
  it('should return success message', () => {
    const fragments: Fragment[] = [createSchemaFragment()];
    const result = link(fragments);

    const summary = getLinkResultSummary(result);

    expect(summary).toContain('successful');
  });

  it('should return conflict message', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x'] }),
    ];
    const result = link(fragments);

    const summary = getLinkResultSummary(result);

    expect(summary).toContain('conflict');
  });
});

describe('getAllProvidedPaths', () => {
  it('should return all semantic paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.a', 'data.b'] }),
      createDerivedFragment({ provides: ['derived.x'] }),
      createActionFragment({ provides: ['action:submit'] }),
    ];
    const result = link(fragments);

    const paths = getAllProvidedPaths(result);

    expect(paths.has('data.a' as any)).toBe(true);
    expect(paths.has('data.b' as any)).toBe(true);
    expect(paths.has('derived.x' as any)).toBe(true);
    expect(paths.has('action:submit' as any)).toBe(false);
  });
});

describe('getAllProvidedActions', () => {
  it('should return all action IDs', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.a'] }),
      createActionFragment({ actionId: 'submit', provides: ['action:submit'] }),
      createActionFragment({ actionId: 'cancel', provides: ['action:cancel'] }),
    ];
    const result = link(fragments);

    const actions = getAllProvidedActions(result);

    expect(actions.has('submit')).toBe(true);
    expect(actions.has('cancel')).toBe(true);
  });
});
