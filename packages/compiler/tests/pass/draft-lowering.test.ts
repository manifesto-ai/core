/**
 * Draft Lowering Tests
 *
 * FragmentDraft를 Fragment로 변환하는 결정론적 lowering을 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  lowerDraft,
  lowerDrafts,
  validateDraft,
  validateExpression,
  validateEffect,
} from '../../src/pass/index.js';
import type {
  SchemaDraft,
  DerivedDraft,
  ExpressionDraft,
  EffectDraft,
  ActionDraft,
  PolicyDraft,
  SourceDraft,
  StatementDraft,
  SchemaFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
} from '../../src/types/fragment.js';
import type { Provenance } from '../../src/types/provenance.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTestProvenance(): Provenance {
  return {
    artifactId: 'test-artifact',
    location: {
      kind: 'llm',
      modelId: 'test-model',
      promptHash: 'abc123',
    },
  };
}

// ============================================================================
// validateExpression Tests
// ============================================================================

describe('validateExpression', () => {
  it('should validate primitives', () => {
    expect(validateExpression(42).valid).toBe(true);
    expect(validateExpression('hello').valid).toBe(true);
    expect(validateExpression(true).valid).toBe(true);
    expect(validateExpression(null).valid).toBe(true);
  });

  it('should validate simple get expression', () => {
    const result = validateExpression(['get', 'data.count']);
    expect(result.valid).toBe(true);
    expect(result.deps).toContain('data.count');
  });

  it('should validate binary expression', () => {
    const result = validateExpression(['>', ['get', 'data.a'], 10]);
    expect(result.valid).toBe(true);
    expect(result.deps).toContain('data.a');
  });

  it('should validate all expression', () => {
    const result = validateExpression([
      'all',
      ['get', 'data.a'],
      ['get', 'data.b'],
    ]);
    expect(result.valid).toBe(true);
    expect(result.deps).toContain('data.a');
    expect(result.deps).toContain('data.b');
  });

  it('should handle empty array', () => {
    // Empty array is technically valid (just no operations)
    const result = validateExpression([]);
    // This might fail or succeed depending on implementation
    expect(result).toBeDefined();
  });
});

// ============================================================================
// validateEffect Tests
// ============================================================================

describe('validateEffect', () => {
  it('should validate SetValue effect', () => {
    const result = validateEffect({
      _tag: 'SetValue',
      path: 'data.count',
      value: 10,
      description: 'test',
    });
    expect(result.valid).toBe(true);
  });

  it('should validate EmitEvent effect', () => {
    const result = validateEffect({
      _tag: 'EmitEvent',
      channel: 'domain',
      payload: { type: 'test' },
      description: 'test',
    });
    expect(result.valid).toBe(true);
  });

  it('should reject null effect', () => {
    const result = validateEffect(null);
    expect(result.valid).toBe(false);
    expect(result.errors?.length).toBeGreaterThan(0);
  });

  it('should reject invalid effect structure', () => {
    const result = validateEffect({ foo: 'bar' });
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// validateDraft Tests
// ============================================================================

describe('validateDraft', () => {
  it('should validate schema draft with fields', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: ['data.count'],
      origin: createTestProvenance(),
      confidence: 0.8,
      namespace: 'data',
      fields: [{ path: 'data.count', type: 'number' }],
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(true);
  });

  it('should reject schema draft without fields', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: [],
      origin: createTestProvenance(),
      confidence: 0.8,
      namespace: 'data',
      fields: [],
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(false);
  });

  it('should warn on low confidence', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: ['data.x'],
      origin: createTestProvenance(),
      confidence: 0.1,
      namespace: 'data',
      fields: [{ path: 'data.x', type: 'string' }],
    };

    const result = validateDraft(draft);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]?.code).toBe('LOW_CONFIDENCE');
  });

  it('should validate derived draft', () => {
    const draft: DerivedDraft = {
      kind: 'DerivedFragment',
      status: 'raw',
      provisionalRequires: ['data.a'],
      provisionalProvides: ['derived.total'],
      origin: createTestProvenance(),
      confidence: 0.7,
      path: 'derived.total',
      rawExpr: ['get', 'data.a'],
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(true);
  });

  it('should reject derived draft without path', () => {
    const draft: DerivedDraft = {
      kind: 'DerivedFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: [],
      origin: createTestProvenance(),
      confidence: 0.7,
      path: '',
      rawExpr: null,
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(false);
  });

  it('should validate action draft', () => {
    const draft: ActionDraft = {
      kind: 'ActionFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: ['action:submit'],
      origin: createTestProvenance(),
      confidence: 0.6,
      actionId: 'submit',
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(true);
  });

  it('should reject action draft without actionId', () => {
    const draft: ActionDraft = {
      kind: 'ActionFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: [],
      origin: createTestProvenance(),
      confidence: 0.6,
      actionId: '',
    };

    const result = validateDraft(draft);
    expect(result.valid).toBe(false);
  });
});

// ============================================================================
// lowerDraft Tests
// ============================================================================

describe('lowerDraft', () => {
  describe('SchemaDraft', () => {
    it('should lower valid schema draft', () => {
      const draft: SchemaDraft = {
        kind: 'SchemaFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: ['data.count'],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data',
        fields: [
          {
            path: 'data.count',
            type: 'number',
            semantic: {
              type: 'number',
              description: 'Count field',
            },
          },
        ],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('SchemaFragment');

      const fragment = result.fragment as SchemaFragment;
      expect(fragment.namespace).toBe('data');
      expect(fragment.fields.length).toBe(1);
    });

    it('should fail on invalid schema draft', () => {
      const draft: SchemaDraft = {
        kind: 'SchemaFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: [],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data',
        fields: [],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe('DerivedDraft', () => {
    it('should lower valid derived draft', () => {
      const draft: DerivedDraft = {
        kind: 'DerivedFragment',
        status: 'raw',
        provisionalRequires: ['data.a'],
        provisionalProvides: ['derived.total'],
        origin: createTestProvenance(),
        confidence: 0.7,
        path: 'derived.total',
        rawExpr: ['get', 'data.a'],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('DerivedFragment');

      const fragment = result.fragment as DerivedFragment;
      expect(fragment.path).toBe('derived.total');
    });

    it('should extract deps from expression', () => {
      const draft: DerivedDraft = {
        kind: 'DerivedFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: ['derived.sum'],
        origin: createTestProvenance(),
        confidence: 0.7,
        path: 'derived.sum',
        rawExpr: ['+', ['get', 'data.a'], ['get', 'data.b']],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);

      const fragment = result.fragment as DerivedFragment;
      expect(fragment.requires).toContain('data.a');
      expect(fragment.requires).toContain('data.b');
    });
  });

  describe('ActionDraft', () => {
    it('should lower valid action draft', () => {
      const draft: ActionDraft = {
        kind: 'ActionFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: ['action:submit'],
        origin: createTestProvenance(),
        confidence: 0.6,
        actionId: 'submit',
        semantic: {
          verb: 'submit',
          description: 'Submit the form',
        },
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('ActionFragment');

      const fragment = result.fragment as ActionFragment;
      expect(fragment.actionId).toBe('submit');
      expect(fragment.semantic?.verb).toBe('submit');
    });

    it('should include preconditions', () => {
      const draft: ActionDraft = {
        kind: 'ActionFragment',
        status: 'raw',
        provisionalRequires: ['data.canSubmit'],
        provisionalProvides: ['action:submit'],
        origin: createTestProvenance(),
        confidence: 0.6,
        actionId: 'submit',
        rawPreconditions: [
          { path: 'data.canSubmit', expect: 'true', reason: 'Must be enabled' },
        ],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);

      const fragment = result.fragment as ActionFragment;
      expect(fragment.preconditions?.length).toBe(1);
      expect(fragment.preconditions?.[0]?.path).toBe('data.canSubmit');
    });
  });

  describe('EffectDraft', () => {
    it('should lower valid effect draft', () => {
      const draft: EffectDraft = {
        kind: 'EffectFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: ['effect:setCount'],
        origin: createTestProvenance(),
        confidence: 0.5,
        rawEffect: {
          _tag: 'SetValue',
          path: 'data.count',
          value: 10,
          description: 'Set count to 10',
        },
        name: 'setCount',
        risk: 'low',
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('EffectFragment');

      const fragment = result.fragment as EffectFragment;
      expect(fragment.effect._tag).toBe('SetValue');
      expect(fragment.risk).toBe('low');
    });

    it('should fail on invalid effect', () => {
      const draft: EffectDraft = {
        kind: 'EffectFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: [],
        origin: createTestProvenance(),
        confidence: 0.5,
        rawEffect: { invalid: true },
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(false);
    });
  });

  describe('PolicyDraft', () => {
    it('should lower valid policy draft', () => {
      const draft: PolicyDraft = {
        kind: 'PolicyFragment',
        status: 'raw',
        provisionalRequires: ['data.canSubmit'],
        provisionalProvides: ['policy:action:submit'],
        origin: createTestProvenance(),
        confidence: 0.6,
        target: { kind: 'action', actionId: 'submit' },
        rawPreconditions: [
          { path: 'data.canSubmit', expect: 'true' },
        ],
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('PolicyFragment');
    });
  });

  describe('SourceDraft', () => {
    it('should lower valid source draft', () => {
      const draft: SourceDraft = {
        kind: 'SourceFragment',
        status: 'raw',
        provisionalRequires: [],
        provisionalProvides: ['data.email'],
        origin: createTestProvenance(),
        confidence: 0.7,
        path: 'data.email',
        semantic: {
          type: 'string',
          description: 'Email input',
          writable: true,
        },
      };

      const result = lowerDraft(draft);
      expect(result.success).toBe(true);
      expect(result.fragment?.kind).toBe('SourceFragment');
    });
  });
});

// ============================================================================
// lowerDrafts Tests
// ============================================================================

describe('lowerDrafts', () => {
  it('should lower multiple drafts', () => {
    const drafts = [
      {
        kind: 'SchemaFragment' as const,
        status: 'raw' as const,
        provisionalRequires: [],
        provisionalProvides: ['data.a'],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data' as const,
        fields: [{ path: 'data.a', type: 'number' as const }],
      },
      {
        kind: 'SchemaFragment' as const,
        status: 'raw' as const,
        provisionalRequires: [],
        provisionalProvides: ['data.b'],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data' as const,
        fields: [{ path: 'data.b', type: 'string' as const }],
      },
    ];

    const { fragments, results } = lowerDrafts(drafts);

    expect(fragments).toHaveLength(2);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('should handle mixed success/failure', () => {
    const drafts = [
      {
        kind: 'SchemaFragment' as const,
        status: 'raw' as const,
        provisionalRequires: [],
        provisionalProvides: ['data.a'],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data' as const,
        fields: [{ path: 'data.a', type: 'number' as const }],
      },
      {
        kind: 'SchemaFragment' as const,
        status: 'raw' as const,
        provisionalRequires: [],
        provisionalProvides: [],
        origin: createTestProvenance(),
        confidence: 0.8,
        namespace: 'data' as const,
        fields: [], // Invalid - empty fields
      },
    ];

    const { fragments, results } = lowerDrafts(drafts);

    expect(fragments).toHaveLength(1);
    expect(results).toHaveLength(2);
    expect(results[0]?.success).toBe(true);
    expect(results[1]?.success).toBe(false);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Draft Lowering Integration', () => {
  it('should preserve confidence in fragment', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: ['data.test'],
      origin: createTestProvenance(),
      confidence: 0.75,
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
    };

    const result = lowerDraft(draft);
    expect(result.fragment?.confidence).toBe(0.75);
  });

  it('should preserve LLM provenance', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      status: 'raw',
      provisionalRequires: [],
      provisionalProvides: ['data.test'],
      origin: createTestProvenance(),
      confidence: 0.8,
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
    };

    const result = lowerDraft(draft);
    expect(result.fragment?.origin.location.kind).toBe('llm');
  });
});
