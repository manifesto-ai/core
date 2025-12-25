/**
 * Fragment Base Tests
 *
 * Tests for fragment creation helpers and stable ID generation.
 */

import { describe, it, expect } from 'vitest';
import {
  createSchemaFragment,
  createSourceFragment,
  createExpressionFragment,
  createDerivedFragment,
  createPolicyFragment,
  createEffectFragment,
  createActionFragment,
  createStatementFragment,
  generateStableFragmentId,
  generateRandomFragmentId,
  generateOriginHash,
  extractKindFromFragmentId,
  cloneFragment,
  addEvidence,
  setConfidence,
  COMPILER_VERSION,
} from '../../src/fragment/index.js';
import {
  createProvenance,
  codeOrigin,
  createEvidence,
} from '../../src/types/provenance.js';
import type { Expression, Effect } from '@manifesto-ai/core';

// Test provenance for all tests
const testProvenance = createProvenance(
  'test-artifact',
  codeOrigin({
    file: 'test.ts',
    startLine: 1,
    startCol: 0,
    endLine: 1,
    endCol: 10,
  })
);

const testEvidence = [createEvidence('ast_node', 'VariableDeclaration', 'const x = 10')];

describe('Stable ID Generation', () => {
  it('should generate stable IDs for same input', () => {
    const id1 = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    const id2 = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    expect(id1).toBe(id2);
  });

  it('should generate different IDs for different provides', () => {
    const id1 = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    const id2 = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.world']
    );
    expect(id1).not.toBe(id2);
  });

  it('should generate different IDs for different kinds', () => {
    const id1 = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    const id2 = generateStableFragmentId(
      'DerivedFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    expect(id1).not.toBe(id2);
  });

  it('should include kind prefix in ID', () => {
    const schemaId = generateStableFragmentId(
      'SchemaFragment',
      testProvenance,
      [],
      ['data.hello']
    );
    expect(schemaId).toMatch(/^sch_/);

    const derivedId = generateStableFragmentId(
      'DerivedFragment',
      testProvenance,
      ['data.items'],
      ['derived.total']
    );
    expect(derivedId).toMatch(/^der_/);
  });

  it('should generate random IDs when requested', () => {
    const id1 = generateRandomFragmentId('SchemaFragment');
    const id2 = generateRandomFragmentId('SchemaFragment');
    expect(id1).not.toBe(id2);
    expect(id1).toMatch(/^sch_/);
  });

  it('should generate origin hash from content', () => {
    const hash1 = generateOriginHash('const x = 10');
    const hash2 = generateOriginHash('const x = 10');
    const hash3 = generateOriginHash('const y = 20');
    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  it('should extract kind from fragment ID', () => {
    expect(extractKindFromFragmentId('sch_abc123')).toBe('SchemaFragment');
    expect(extractKindFromFragmentId('der_xyz789')).toBe('DerivedFragment');
    expect(extractKindFromFragmentId('act_def456')).toBe('ActionFragment');
    expect(extractKindFromFragmentId('unknown_id')).toBeNull();
  });
});

describe('SchemaFragment', () => {
  it('should create a schema fragment with correct fields', () => {
    const fragment = createSchemaFragment({
      namespace: 'data',
      fields: [
        {
          path: 'data.hello',
          type: 'number',
          defaultValue: 10,
          semantic: {
            type: 'counter',
            description: 'A hello counter',
          },
        },
      ],
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('SchemaFragment');
    expect(fragment.namespace).toBe('data');
    expect(fragment.fields).toHaveLength(1);
    expect(fragment.fields[0]?.path).toBe('data.hello');
    expect(fragment.provides).toContain('data.hello');
    expect(fragment.requires).toHaveLength(0);
    expect(fragment.compilerVersion).toBe(COMPILER_VERSION);
  });
});

describe('SourceFragment', () => {
  it('should create a source fragment', () => {
    const fragment = createSourceFragment({
      path: 'data.couponCode',
      semantic: {
        type: 'string',
        description: 'Coupon code for discount',
        writable: true,
      },
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('SourceFragment');
    expect(fragment.path).toBe('data.couponCode');
    expect(fragment.provides).toContain('data.couponCode');
    expect(fragment.semantic.writable).toBe(true);
  });
});

describe('ExpressionFragment', () => {
  it('should create an expression fragment', () => {
    const expr: Expression = ['>', ['get', 'data.hello'], 10];
    const fragment = createExpressionFragment({
      expr,
      requires: ['data.hello'],
      name: 'helloCheck',
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('ExpressionFragment');
    expect(fragment.expr).toEqual(expr);
    expect(fragment.requires).toContain('data.hello');
    expect(fragment.provides).toContain('expr:helloCheck');
  });
});

describe('DerivedFragment', () => {
  it('should create a derived fragment', () => {
    const expr: Expression = ['sum', ['map', ['get', 'data.items'], '$.price']];
    const fragment = createDerivedFragment({
      path: 'derived.total',
      expr,
      deps: ['data.items'],
      requires: ['data.items'],
      semantic: {
        type: 'currency',
        description: 'Total price of all items',
      },
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('DerivedFragment');
    expect(fragment.path).toBe('derived.total');
    expect(fragment.provides).toContain('derived.total');
    expect(fragment.requires).toContain('data.items');
    expect(fragment.deps).toContain('data.items');
  });
});

describe('PolicyFragment', () => {
  it('should create a policy fragment for action', () => {
    const fragment = createPolicyFragment({
      target: { kind: 'action', actionId: 'checkout' },
      preconditions: [
        { path: 'derived.canCheckout', expect: 'true', reason: 'Must be able to checkout' },
      ],
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('PolicyFragment');
    expect(fragment.target).toEqual({ kind: 'action', actionId: 'checkout' });
    expect(fragment.preconditions).toHaveLength(1);
    expect(fragment.requires).toContain('derived.canCheckout');
    expect(fragment.provides).toContain('policy:action:checkout');
  });

  it('should create a policy fragment for field', () => {
    const fragment = createPolicyFragment({
      target: { kind: 'field', path: 'data.couponCode' },
      fieldPolicy: {
        relevantWhen: [{ path: 'derived.hasItems', expect: 'true' }],
        editableWhen: [{ path: 'state.isSubmitting', expect: 'false' }],
      },
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('PolicyFragment');
    expect(fragment.requires).toContain('derived.hasItems');
    expect(fragment.requires).toContain('state.isSubmitting');
  });
});

describe('EffectFragment', () => {
  it('should create an effect fragment', () => {
    const effect: Effect = {
      _tag: 'EmitEvent',
      channel: 'domain',
      payload: { type: 'doHello' },
      description: 'Emit hello event',
    };
    const fragment = createEffectFragment({
      effect,
      requires: [],
      risk: 'low',
      name: 'doHello',
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('EffectFragment');
    expect(fragment.effect).toEqual(effect);
    expect(fragment.risk).toBe('low');
    expect(fragment.provides).toContain('effect:doHello');
  });
});

describe('ActionFragment', () => {
  it('should create an action fragment', () => {
    const effect: Effect = {
      _tag: 'SetValue',
      path: 'data.submitted',
      value: true,
      description: 'Mark as submitted',
    };
    const fragment = createActionFragment({
      actionId: 'submit',
      requires: ['data.items'],
      preconditions: [{ path: 'derived.canSubmit', expect: 'true' }],
      effect,
      semantic: {
        verb: 'submit',
        description: 'Submit the order',
        risk: 'medium',
      },
      risk: 'medium',
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('ActionFragment');
    expect(fragment.actionId).toBe('submit');
    expect(fragment.provides).toContain('action:submit');
    expect(fragment.requires).toContain('data.items');
    expect(fragment.requires).toContain('derived.canSubmit');
    expect(fragment.risk).toBe('medium');
  });
});

describe('StatementFragment', () => {
  it('should create a statement fragment', () => {
    const fragment = createStatementFragment({
      statementType: 'if',
      requires: ['data.hello'],
      sourceCode: 'if (hello > 10) { doHello() }',
      origin: testProvenance,
      evidence: testEvidence,
    });

    expect(fragment.kind).toBe('StatementFragment');
    expect(fragment.statementType).toBe('if');
    expect(fragment.sourceCode).toBe('if (hello > 10) { doHello() }');
  });
});

describe('Fragment Utilities', () => {
  it('should clone a fragment with new ID', () => {
    const original = createSchemaFragment({
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
      origin: testProvenance,
      evidence: testEvidence,
    });

    const newProvenance = createProvenance(
      'new-artifact',
      codeOrigin({ startLine: 10, startCol: 0, endLine: 10, endCol: 20 })
    );

    const cloned = cloneFragment(original, newProvenance);

    expect(cloned.id).not.toBe(original.id);
    expect(cloned.kind).toBe(original.kind);
    expect(cloned.fields).toEqual(original.fields);
    expect(cloned.origin).toBe(newProvenance);
  });

  it('should add evidence to a fragment', () => {
    const fragment = createSchemaFragment({
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
      origin: testProvenance,
      evidence: testEvidence,
    });

    const newEvidence = createEvidence('rule', 'schema-inference', 'Inferred from variable');
    const updated = addEvidence(fragment, newEvidence);

    expect(updated.evidence).toHaveLength(2);
    expect(updated.evidence).toContain(newEvidence);
  });

  it('should set confidence score', () => {
    const fragment = createSchemaFragment({
      namespace: 'data',
      fields: [{ path: 'data.test', type: 'string' }],
      origin: testProvenance,
      evidence: testEvidence,
    });

    const updated = setConfidence(fragment, 0.85);
    expect(updated.confidence).toBe(0.85);

    // Should clamp to [0, 1]
    const clamped = setConfidence(fragment, 1.5);
    expect(clamped.confidence).toBe(1);
  });
});
