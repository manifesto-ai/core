/**
 * Static Validation Tests
 *
 * Tests for static analysis rules including:
 * - Path format validation
 * - Type consistency
 * - Policy validation
 * - Effect validation
 * - Action completeness
 * - Provenance validation
 */

import { describe, it, expect } from 'vitest';
import {
  validatePaths,
  validateTypes,
  validatePolicies,
  validateEffects,
  validateActions,
  validateProvenance,
  validateStatic,
  validateFragmentsStatic,
  type ValidationContext,
} from '../../src/verifier/static.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  PolicyFragment,
  EffectFragment,
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
    schema: { path: 'data.input', type: 'string' },
    semantic: { type: 'string', description: 'Input field' },
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

function createPolicyFragment(overrides: Partial<PolicyFragment> = {}): PolicyFragment {
  return {
    id: 'policy-1',
    kind: 'PolicyFragment',
    requires: ['derived.canSubmit'],
    provides: ['policy:increment'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    target: { kind: 'action', actionId: 'increment' },
    preconditions: [{ path: 'derived.canSubmit' as any, expect: 'true' }],
    ...overrides,
  };
}

function createEffectFragment(overrides: Partial<EffectFragment> = {}): EffectFragment {
  return {
    id: 'effect-1',
    kind: 'EffectFragment',
    requires: [],
    provides: ['effect:setCount'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    name: 'setCount',
    effect: { _tag: 'SetValue', path: 'data.count' as any, value: 0 },
    risk: 'low',
    ...overrides,
  };
}

function createValidationContext(
  fragments: Fragment[],
  overrides: Partial<ValidationContext> = {}
): ValidationContext {
  const providedPaths = new Set<string>();
  const providedActions = new Set<string>();

  for (const fragment of fragments) {
    for (const provide of fragment.provides) {
      if (provide.startsWith('action:')) {
        providedActions.add(provide.slice(7));
      } else if (!provide.startsWith('effect:')) {
        providedPaths.add(provide);
      }
    }
  }

  return {
    fragments,
    providedPaths,
    providedActions,
    options: {
      validatePaths: true,
      validateTypes: true,
      validatePolicies: true,
      validateEffects: true,
      validateActions: true,
      validateProvenance: true,
      maxEffectRisk: 'high',
      requireActionVerb: false,
    },
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
// validatePaths Tests
// ============================================================================

describe('validatePaths', () => {
  it('should pass valid paths', () => {
    const ctx = createValidationContext([
      createSchemaFragment({ provides: ['data.count'] }),
      createDerivedFragment({ provides: ['derived.doubled'] }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should reject invalid path format', () => {
    const ctx = createValidationContext([
      createSchemaFragment({ provides: ['invalid-path'] }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PATH');
    expect(issues[0].message).toContain('invalid path format');
  });

  it('should reject paths without namespace', () => {
    const ctx = createValidationContext([
      createSchemaFragment({ provides: ['count'] }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PATH');
    expect(issues[0].message).toContain('namespace');
  });

  it('should accept all valid namespaces', () => {
    const ctx = createValidationContext([
      createSchemaFragment({ provides: ['data.x'] }),
      createSchemaFragment({ id: 's2', provides: ['state.y'] }),
      createDerivedFragment({ provides: ['derived.z'] }),
      createSchemaFragment({ id: 's3', provides: ['async.w'] }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should skip action: prefixes', () => {
    const ctx = createValidationContext([
      createActionFragment({ provides: ['action:submit'] }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should validate requires paths', () => {
    const ctx = createValidationContext([
      createDerivedFragment({
        provides: ['derived.x'],
        requires: ['invalid-require'],
      }),
    ]);

    const issues = validatePaths(ctx);

    expect(issues.some((i) => i.message.includes('requires'))).toBe(true);
  });
});

// ============================================================================
// validateTypes Tests
// ============================================================================

describe('validateTypes', () => {
  it('should pass valid types', () => {
    const ctx = createValidationContext([
      createSchemaFragment({
        fields: [{ path: 'data.x', type: 'string', semantic: {} }],
      }),
    ]);

    const issues = validateTypes(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should warn on unknown types', () => {
    const ctx = createValidationContext([
      createSchemaFragment({
        fields: [{ path: 'data.x', type: 'CustomType', semantic: {} }],
      }),
    ]);

    const issues = validateTypes(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].message).toContain('Unknown field type');
  });

  it('should detect type conflicts', () => {
    const ctx = createValidationContext([
      createSchemaFragment({
        id: 'a',
        provides: ['data.x'],
        fields: [{ path: 'data.x', type: 'string', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        provides: ['data.x'],
        fields: [{ path: 'data.x', type: 'number', semantic: {} }],
      }),
    ]);

    const issues = validateTypes(ctx);

    expect(issues.some((i) => i.message.includes('Type conflict'))).toBe(true);
  });

  it('should accept all valid types', () => {
    const ctx = createValidationContext([
      createSchemaFragment({
        fields: [
          { path: 'data.a', type: 'string', semantic: {} },
          { path: 'data.b', type: 'number', semantic: {} },
          { path: 'data.c', type: 'boolean', semantic: {} },
          { path: 'data.d', type: 'object', semantic: {} },
          { path: 'data.e', type: 'array', semantic: {} },
          { path: 'data.f', type: 'null', semantic: {} },
          { path: 'data.g', type: 'unknown', semantic: {} },
        ],
      }),
    ]);

    const issues = validateTypes(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should validate source fragment types', () => {
    const ctx = createValidationContext([
      createSourceFragment({
        schema: { path: 'data.input', type: 'InvalidType' as any },
        semantic: { type: 'InvalidType', description: 'Invalid type test' },
      }),
    ]);

    const issues = validateTypes(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
  });
});

// ============================================================================
// validatePolicies Tests
// ============================================================================

describe('validatePolicies', () => {
  it('should pass when precondition paths exist', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['derived.canSubmit'] }),
      createPolicyFragment({
        preconditions: [{ path: 'derived.canSubmit' as any, expect: 'true' }],
      }),
    ];
    const ctx = createValidationContext(fragments);

    const issues = validatePolicies(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should report missing precondition path', () => {
    const ctx = createValidationContext([
      createPolicyFragment({
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [{ path: 'derived.missing' as any, expect: 'true' }],
      }),
    ]);

    const issues = validatePolicies(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PRECONDITION_PATH');
  });

  it('should validate action fragment preconditions', () => {
    const ctx = createValidationContext([
      createActionFragment({
        preconditions: [{ path: 'derived.missing' as any, expect: 'true' }],
      }),
    ]);

    const issues = validatePolicies(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PRECONDITION_PATH');
  });

  it('should validate field policy relevantWhen paths', () => {
    const ctx = createValidationContext([
      createPolicyFragment({
        target: { kind: 'field', path: 'data.x' },
        preconditions: undefined, // Clear default preconditions
        fieldPolicy: {
          relevantWhen: [{ path: 'data.missing' as any, expect: 'true' }],
        },
      } as any),
    ]);

    const issues = validatePolicies(ctx);

    expect(issues.length).toBeGreaterThanOrEqual(1);
    expect(issues.some((i) => i.code === 'INVALID_PRECONDITION_PATH')).toBe(true);
  });
});

// ============================================================================
// validateEffects Tests
// ============================================================================

describe('validateEffects', () => {
  it('should pass valid effects', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.count'] }),
      createEffectFragment({
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 0 },
        risk: 'low',
      }),
    ];
    const ctx = createValidationContext(fragments);

    const issues = validateEffects(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should warn on high risk effects when max is medium', () => {
    // Create fragment with provided path so effect target is valid
    const fragments = [
      createSchemaFragment({ provides: ['data.count'] }),
      createEffectFragment({
        risk: 'high',
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 0 },
      }),
    ];
    const ctx = createValidationContext(fragments, {
      options: {
        validatePaths: true,
        validateTypes: true,
        validatePolicies: true,
        validateEffects: true,
        validateActions: true,
        validateProvenance: true,
        maxEffectRisk: 'medium',
        requireActionVerb: false,
      },
    });

    const issues = validateEffects(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('EFFECT_RISK_TOO_HIGH');
  });

  it('should warn on critical risk when max is high', () => {
    const ctx = createValidationContext(
      [createEffectFragment({ risk: 'critical' })],
      {
        options: {
          validatePaths: true,
          validateTypes: true,
          validatePolicies: true,
          validateEffects: true,
          validateActions: true,
          validateProvenance: true,
          maxEffectRisk: 'high',
          requireActionVerb: false,
        },
      }
    );

    const issues = validateEffects(ctx);

    expect(issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(true);
  });

  it('should validate SetValue targets undefined path', () => {
    const ctx = createValidationContext([
      createEffectFragment({
        effect: { _tag: 'SetValue', path: 'data.missing' as any, value: 0 },
      }),
    ]);

    const issues = validateEffects(ctx);

    expect(issues.some((i) => i.code === 'INVALID_EFFECT')).toBe(true);
    expect(issues.some((i) => i.message.includes('undefined path'))).toBe(true);
  });

  it('should validate action effects', () => {
    const ctx = createValidationContext([
      createActionFragment({
        risk: 'critical',
      }),
    ]);
    ctx.options.maxEffectRisk = 'medium';

    const issues = validateEffects(ctx);

    expect(issues.some((i) => i.code === 'EFFECT_RISK_TOO_HIGH')).toBe(true);
  });

  it('should validate nested Sequence effects', () => {
    const ctx = createValidationContext([
      createEffectFragment({
        effect: {
          _tag: 'Sequence',
          effects: [
            { _tag: 'SetValue', path: 'data.missing1' as any, value: 0 },
            { _tag: 'SetValue', path: 'data.missing2' as any, value: 0 },
          ],
        },
      }),
    ]);

    const issues = validateEffects(ctx);

    expect(issues.filter((i) => i.code === 'INVALID_EFFECT')).toHaveLength(2);
  });

  it('should validate Conditional branches', () => {
    const ctx = createValidationContext([
      createEffectFragment({
        effect: {
          _tag: 'Conditional',
          condition: ['get', 'data.x'],
          then: { _tag: 'SetValue', path: 'data.missing1' as any, value: 0 },
          else: { _tag: 'SetValue', path: 'data.missing2' as any, value: 0 },
        },
      }),
    ]);

    const issues = validateEffects(ctx);

    expect(issues.filter((i) => i.code === 'INVALID_EFFECT')).toHaveLength(2);
  });
});

// ============================================================================
// validateActions Tests
// ============================================================================

describe('validateActions', () => {
  it('should pass valid actions', () => {
    const ctx = createValidationContext([createActionFragment()]);

    const issues = validateActions(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should require verb when option is set', () => {
    const ctx = createValidationContext(
      [createActionFragment({ semantic: { description: 'test' } })],
      {
        options: {
          validatePaths: true,
          validateTypes: true,
          validatePolicies: true,
          validateEffects: true,
          validateActions: true,
          validateProvenance: true,
          maxEffectRisk: 'high',
          requireActionVerb: true,
        },
      }
    );

    const issues = validateActions(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('ACTION_VERB_REQUIRED');
  });

  it('should not require verb by default', () => {
    const ctx = createValidationContext([
      createActionFragment({ semantic: { description: 'test' } }),
    ]);

    const issues = validateActions(ctx);

    expect(issues).toHaveLength(0);
  });

  it('should require effect or effectRef', () => {
    const ctx = createValidationContext([
      createActionFragment({
        effect: undefined,
        effectRef: undefined,
      }),
    ]);

    const issues = validateActions(ctx);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_EFFECT');
    expect(issues[0].message).toContain('effect or effectRef');
  });

  it('should validate effectRef exists', () => {
    const ctx = createValidationContext([
      createActionFragment({
        effect: undefined,
        effectRef: 'nonexistent',
      }),
    ]);

    const issues = validateActions(ctx);

    expect(issues.some((i) => i.code === 'UNRESOLVED_REFERENCE')).toBe(true);
  });

  it('should pass when effectRef exists', () => {
    const ctx = createValidationContext([
      createEffectFragment({ name: 'myEffect', provides: ['effect:myEffect'] }),
      createActionFragment({
        effect: undefined,
        effectRef: 'myEffect',
      }),
    ]);

    const issues = validateActions(ctx);

    // Only INVALID_EFFECT for the effectRef action having no inline effect
    // The effectRef validation should pass since effect:myEffect exists
    expect(issues.filter((i) => i.code === 'UNRESOLVED_REFERENCE')).toHaveLength(0);
  });
});

// ============================================================================
// validateProvenance Tests
// ============================================================================

describe('validateProvenance', () => {
  it('should pass valid provenance', () => {
    const issues = validateProvenance([createSchemaFragment()]);

    expect(issues).toHaveLength(0);
  });

  it('should report missing origin', () => {
    const fragment = createSchemaFragment();
    (fragment as any).origin = undefined;

    const issues = validateProvenance([fragment]);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('MISSING_PROVENANCE');
  });

  it('should report missing location', () => {
    const fragment = createSchemaFragment();
    fragment.origin = { artifactId: 'test' } as any;

    const issues = validateProvenance([fragment]);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PROVENANCE');
    expect(issues[0].message).toContain('location');
  });

  it('should report missing artifactId', () => {
    const fragment = createSchemaFragment();
    fragment.origin = { location: { kind: 'generated', note: 'test' } } as any;

    const issues = validateProvenance([fragment]);

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('INVALID_PROVENANCE');
    expect(issues[0].message).toContain('artifactId');
  });
});

// ============================================================================
// validateStatic Tests
// ============================================================================

describe('validateStatic', () => {
  it('should run all validations by default', () => {
    const linkResult = createMinimalLinkResult([
      createSchemaFragment({ provides: ['data.x'] }),
    ]);

    const result = validateStatic(linkResult);

    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should aggregate issues from all validators', () => {
    const linkResult = createMinimalLinkResult([
      createSchemaFragment({
        provides: ['invalid-path'],
        fields: [{ path: 'invalid-path', type: 'UnknownType', semantic: {} }],
      }),
    ]);

    const result = validateStatic(linkResult);

    // Should have path issues and type issues
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('should respect disabled validations', () => {
    const linkResult = createMinimalLinkResult([
      createSchemaFragment({ provides: ['invalid-path'] }),
    ]);

    const result = validateStatic(linkResult, { validatePaths: false });

    // Path validation disabled, so no issues
    expect(result.issues.filter((i) => i.code === 'INVALID_PATH')).toHaveLength(0);
  });

  it('should count errors and warnings separately', () => {
    const linkResult = createMinimalLinkResult([
      createSchemaFragment({
        fields: [{ path: 'data.x', type: 'UnknownType', semantic: {} }],
      }),
    ]);

    const result = validateStatic(linkResult);

    // Unknown type is a warning, not an error
    expect(result.warningCount).toBeGreaterThan(0);
    expect(result.isValid).toBe(true); // Only errors make it invalid
  });

  it('should be invalid when errors exist', () => {
    const linkResult = createMinimalLinkResult([
      createSchemaFragment({ provides: ['invalid-path'] }),
    ]);

    const result = validateStatic(linkResult);

    expect(result.isValid).toBe(false);
    expect(result.errorCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// validateFragmentsStatic Tests
// ============================================================================

describe('validateFragmentsStatic', () => {
  it('should validate fragments directly', () => {
    const result = validateFragmentsStatic([
      createSchemaFragment({ provides: ['data.x'] }),
    ]);

    expect(result.isValid).toBe(true);
  });

  it('should accept options', () => {
    const result = validateFragmentsStatic(
      [createSchemaFragment({ provides: ['invalid-path'] })],
      { validatePaths: false }
    );

    expect(result.issues.filter((i) => i.code === 'INVALID_PATH')).toHaveLength(0);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('should handle empty fragments', () => {
    const result = validateStatic(createMinimalLinkResult([]));

    expect(result.isValid).toBe(true);
  });

  it('should handle fragments with no provides', () => {
    const fragment = createSchemaFragment({ provides: [] });
    const result = validateStatic(createMinimalLinkResult([fragment]));

    expect(result.isValid).toBe(true);
  });

  it('should handle complex fragment mix', () => {
    // Ensure all required paths are provided
    const fragments: Fragment[] = [
      createSchemaFragment({
        id: 'a',
        provides: ['data.x', 'data.count'],
        fields: [
          { path: 'data.x', type: 'number', semantic: {} },
          { path: 'data.count', type: 'number', semantic: {} },
        ],
      }),
      createSourceFragment({ id: 'b', provides: ['data.input'], path: 'data.input' }),
      createDerivedFragment({
        id: 'c',
        provides: ['derived.y'],
        requires: ['data.x'],
      }),
      createActionFragment({
        id: 'd',
        provides: ['action:submit'],
        requires: ['data.count'],
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 1 },
      }),
      createEffectFragment({
        id: 'e',
        provides: ['effect:reset'],
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 0 },
      }),
    ];

    const result = validateStatic(createMinimalLinkResult(fragments));

    expect(result.isValid).toBe(true);
  });
});
