/**
 * Verifier Integration Tests
 *
 * Tests the full verification pipeline including:
 * - DAG validation
 * - Static validation
 * - Integration with link results
 */

import { describe, it, expect } from 'vitest';
import {
  verify,
  verifyFull,
  verifyFragments,
  quickVerifyIsValid,
  getVerifyBlockingIssues,
  hasVerifyBlockingIssues,
  getVerifyResultSummary,
  type VerifyOptions,
} from '../../src/verifier/index.js';
import { link } from '../../src/linker/index.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
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
    fields: [{ path: 'data.count', type: 'number', semantic: {} }],
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
    semantic: {},
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
    effect: { _tag: 'SetValue', path: 'data.count' as any, value: 1 },
    semantic: { verb: 'increment', description: 'Increment count' },
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
// verify() Tests
// ============================================================================

describe('verify', () => {
  describe('valid results', () => {
    it('should pass for valid fragments', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'schema-data', provides: ['data.count'] }),
        createDerivedFragment({
          id: 'derived-doubled',
          provides: ['derived.doubled'],
          requires: ['data.count'],
        }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result = verify(linkResult);

      expect(result.isValid).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it('should pass for complete domain', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ provides: ['data.count'] }),
        createSourceFragment({ provides: ['data.input'] }),
        createDerivedFragment({
          provides: ['derived.doubled'],
          requires: ['data.count'],
        }),
        createActionFragment({
          provides: ['action:increment'],
          requires: ['data.count'],
          effect: { _tag: 'SetValue', path: 'data.count' as any, value: 1 },
        }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result = verify(linkResult);

      expect(result.isValid).toBe(true);
    });
  });

  describe('cycle detection', () => {
    it('should fail for cyclic dependencies', () => {
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

      const result = verify(linkResult);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === 'CYCLIC_DEPENDENCY')).toBe(true);
    });

    it('should skip cycle check when disabled', () => {
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

      const result = verify(linkResult, { checkCycles: false, checkDependencies: false });

      // Should not have CYCLIC_DEPENDENCY from DAG check
      expect(result.dagResult).toBeUndefined();
    });
  });

  describe('missing dependency detection', () => {
    it('should fail for missing dependencies', () => {
      const fragments: Fragment[] = [
        createDerivedFragment({
          provides: ['derived.x'],
          requires: ['data.missing'],
        }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result = verify(linkResult);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === 'MISSING_DEPENDENCY')).toBe(true);
    });
  });

  describe('static validation', () => {
    it('should detect invalid paths', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ provides: ['invalid-path'] }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result = verify(linkResult);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === 'INVALID_PATH')).toBe(true);
    });

    it('should detect missing provenance', () => {
      const fragment = createSchemaFragment();
      (fragment as any).origin = undefined;
      const linkResult = createMinimalLinkResult([fragment]);

      const result = verify(linkResult);

      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.code === 'MISSING_PROVENANCE')).toBe(true);
    });
  });

  describe('options', () => {
    it('should respect treatWarningsAsErrors', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({
          fields: [{ path: 'data.x', type: 'UnknownType', semantic: {} }],
        }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const normalResult = verify(linkResult);
      const strictResult = verify(linkResult, { treatWarningsAsErrors: true });

      expect(normalResult.isValid).toBe(true); // Warnings don't block
      expect(strictResult.isValid).toBe(false); // Warnings treated as errors
    });

    it('should disable individual checks', () => {
      const fragment = createSchemaFragment();
      (fragment as any).origin = undefined;
      const linkResult = createMinimalLinkResult([fragment]);

      const result = verify(linkResult, { checkProvenance: false });

      // Missing provenance should not be reported
      expect(result.issues.filter((i) => i.code === 'MISSING_PROVENANCE')).toHaveLength(0);
    });
  });

  describe('conflicts', () => {
    it('should fail when conflicts exist', () => {
      const linkResult: LinkResult = {
        fragments: [],
        conflicts: [
          {
            id: '1',
            target: 'data.x',
            type: 'duplicate_provides',
            candidates: ['a', 'b'],
            message: 'Duplicate',
          },
        ],
        issues: [],
        version: 'test',
      };

      const result = verify(linkResult);

      expect(result.isValid).toBe(false);
      expect(result.summary).toContain('conflict');
    });
  });

  describe('result structure', () => {
    it('should include DAG result', () => {
      const linkResult = createMinimalLinkResult([createSchemaFragment()]);

      const result = verify(linkResult);

      expect(result.dagResult).toBeDefined();
      expect(result.dagResult!.isValid).toBe(true);
    });

    it('should include static result', () => {
      const linkResult = createMinimalLinkResult([createSchemaFragment()]);

      const result = verify(linkResult);

      expect(result.staticResult).toBeDefined();
    });

    it('should provide summary message', () => {
      const linkResult = createMinimalLinkResult([createSchemaFragment()]);

      const result = verify(linkResult);

      expect(result.summary).toContain('passed');
    });

    it('should provide failure summary', () => {
      const fragments: Fragment[] = [
        createDerivedFragment({
          provides: ['derived.x'],
          requires: ['data.missing'],
        }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result = verify(linkResult);

      expect(result.summary).toContain('failed');
      expect(result.summary).toContain('error');
    });
  });

  describe('determinism (Principle E)', () => {
    it('should produce sorted issues', () => {
      const fragments: Fragment[] = [
        createSchemaFragment({ id: 'z', provides: ['data.z'] }),
        createSchemaFragment({ id: 'a', provides: ['data.a'] }),
      ];
      const linkResult = createMinimalLinkResult(fragments);

      const result1 = verify(linkResult);
      const result2 = verify(linkResult);

      expect(result1.issues.map((i) => i.id)).toEqual(result2.issues.map((i) => i.id));
    });

    it('should deduplicate issues', () => {
      const linkResult: LinkResult = {
        fragments: [createSchemaFragment()],
        conflicts: [],
        issues: [
          { id: 'dup', code: 'INVALID_PATH', severity: 'error', message: 'test' },
          { id: 'dup', code: 'INVALID_PATH', severity: 'error', message: 'test' },
        ],
        version: 'test',
      };

      const result = verify(linkResult);

      const dupIssues = result.issues.filter((i) => i.id === 'dup');
      expect(dupIssues).toHaveLength(1);
    });
  });
});

// ============================================================================
// verifyFull() Tests
// ============================================================================

describe('verifyFull', () => {
  it('should check all validations', () => {
    const linkResult = createMinimalLinkResult([createSchemaFragment()]);

    const result = verifyFull(linkResult);

    expect(result.dagResult).toBeDefined();
    expect(result.staticResult).toBeDefined();
  });
});

// ============================================================================
// verifyFragments() Tests
// ============================================================================

describe('verifyFragments', () => {
  it('should verify fragments directly', () => {
    const fragments: Fragment[] = [createSchemaFragment()];

    const result = verifyFragments(fragments);

    expect(result.isValid).toBe(true);
  });

  it('should detect issues in fragments', () => {
    const fragments: Fragment[] = [
      createDerivedFragment({
        provides: ['derived.x'],
        requires: ['data.missing'],
      }),
    ];

    const result = verifyFragments(fragments);

    expect(result.isValid).toBe(false);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('quickVerifyIsValid', () => {
  it('should return true for valid result', () => {
    const linkResult = createMinimalLinkResult([createSchemaFragment()]);

    expect(quickVerifyIsValid(linkResult)).toBe(true);
  });

  it('should return false for invalid result', () => {
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

    expect(quickVerifyIsValid(linkResult)).toBe(false);
  });
});

describe('getVerifyBlockingIssues', () => {
  it('should return only errors', () => {
    const linkResult: LinkResult = {
      fragments: [
        createSchemaFragment({
          fields: [{ path: 'data.x', type: 'UnknownType', semantic: {} }],
        }),
      ],
      conflicts: [],
      issues: [],
      version: 'test',
    };

    const result = verify(linkResult);
    const blocking = getVerifyBlockingIssues(result);

    expect(blocking.every((i) => i.severity === 'error')).toBe(true);
  });
});

describe('hasVerifyBlockingIssues', () => {
  it('should return true when errors exist', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['invalid-path'] }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = verify(linkResult);

    expect(hasVerifyBlockingIssues(result)).toBe(true);
  });

  it('should return false when no errors', () => {
    const linkResult = createMinimalLinkResult([createSchemaFragment()]);

    const result = verify(linkResult);

    expect(hasVerifyBlockingIssues(result)).toBe(false);
  });
});

describe('getVerifyResultSummary', () => {
  it('should return summary counts', () => {
    const linkResult = createMinimalLinkResult([createSchemaFragment()]);

    const result = verify(linkResult);
    const summary = getVerifyResultSummary(result);

    expect(summary.isValid).toBe(true);
    expect(summary.errors).toBe(0);
  });
});

// ============================================================================
// Integration with Linker
// ============================================================================

describe('linker + verifier integration', () => {
  it('should verify linked result', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'schema-data',
        provides: ['data.count'],
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
      createDerivedFragment({
        id: 'derived-doubled',
        provides: ['derived.doubled'],
        requires: ['data.count'],
      }),
      createActionFragment({
        id: 'action-increment',
        provides: ['action:increment'],
        requires: ['data.count'],
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 1 },
      }),
    ];

    const linkResult = link(fragments);
    const verifyResult = verify(linkResult);

    expect(verifyResult.isValid).toBe(true);
  });

  it('should detect issues from linker', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'a', provides: ['data.x'] }),
      createSchemaFragment({ id: 'b', provides: ['data.x'] }),
    ];

    const linkResult = link(fragments);
    const verifyResult = verify(linkResult);

    // Should have conflict
    expect(verifyResult.isValid).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty fragments', () => {
    const linkResult = createMinimalLinkResult([]);

    const result = verify(linkResult);

    expect(result.isValid).toBe(true);
  });

  it('should handle all options disabled', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['invalid-path'] }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = verify(linkResult, {
      checkCycles: false,
      checkDependencies: false,
      checkTypes: false,
      checkPolicies: false,
      checkEffects: false,
      checkActions: false,
      checkProvenance: false,
      checkPaths: false,
    });

    // Minimal validation should still pass
    expect(result.dagResult).toBeUndefined();
  });

  it('should handle warnings correctly', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        fields: [{ path: 'data.x', type: 'CustomType', semantic: {} }],
      }),
    ];
    const linkResult = createMinimalLinkResult(fragments);

    const result = verify(linkResult);

    expect(result.isValid).toBe(true); // Warnings don't invalidate
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.summary).toContain('warning');
  });
});
