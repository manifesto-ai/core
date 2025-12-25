/**
 * Domain Builder Tests
 *
 * Tests for Principle C: Schema Materialization → Zod directly.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  buildDomainDraft,
  buildDataSchema,
  buildStateSchema,
  buildSources,
  buildDerived,
  buildActions,
  fragmentTypeToZod,
  fragmentTypeToZodWithConstraints,
  mergeSchemaFields,
  extractAllPaths,
  validateDomainDraft,
  type DomainBuildResult,
} from '../../src/linker/domain-builder.js';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  DerivedFragment,
  ActionFragment,
  EffectFragment,
  PolicyFragment,
} from '../../src/types/fragment.js';
import type { Issue } from '../../src/types/issue.js';

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
    schema: { path: 'data.input', type: 'string' },
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

function createEffectFragment(overrides: Partial<EffectFragment> = {}): EffectFragment {
  return {
    id: 'effect-1',
    kind: 'EffectFragment',
    requires: [],
    provides: ['effect:doSomething'],
    origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
    evidence: [],
    compilerVersion: '0.1.0',
    name: 'doSomething',
    effect: {
      _tag: 'SetValue',
      path: 'data.x' as any,
      value: 1,
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

// ============================================================================
// fragmentTypeToZod Tests (Principle C)
// ============================================================================

describe('fragmentTypeToZod', () => {
  it('should map string type to z.string()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('string', issues);

    expect(zodType._def.typeName).toBe('ZodString');
    expect(issues).toHaveLength(0);
  });

  it('should map number type to z.number()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('number', issues);

    expect(zodType._def.typeName).toBe('ZodNumber');
    expect(issues).toHaveLength(0);
  });

  it('should map boolean type to z.boolean()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('boolean', issues);

    expect(zodType._def.typeName).toBe('ZodBoolean');
    expect(issues).toHaveLength(0);
  });

  it('should map object type to z.record()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('object', issues);

    expect(zodType._def.typeName).toBe('ZodRecord');
    expect(issues).toHaveLength(0);
  });

  it('should map array type to z.array()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('array', issues);

    expect(zodType._def.typeName).toBe('ZodArray');
    expect(issues).toHaveLength(0);
  });

  it('should map null type to z.null()', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('null', issues);

    expect(zodType._def.typeName).toBe('ZodNull');
    expect(issues).toHaveLength(0);
  });

  it('should map unknown type to z.unknown() and create issue (Principle C)', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZod('customType', issues);

    expect(zodType._def.typeName).toBe('ZodUnknown');
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe('UNKNOWN_TYPE');
    expect(issues[0].severity).toBe('warning');
  });

  it('should include context in unknown type issue', () => {
    const issues: Issue[] = [];
    fragmentTypeToZod('unknownType', issues, {
      path: 'data.test',
      fragmentId: 'frag-1',
    });

    expect(issues[0].path).toBe('data.test');
    expect(issues[0].relatedFragments).toContain('frag-1');
    expect(issues[0].context?.originalType).toBe('unknownType');
  });

  it('should handle case-insensitive type names', () => {
    const issues: Issue[] = [];

    expect(fragmentTypeToZod('STRING', issues)._def.typeName).toBe('ZodString');
    expect(fragmentTypeToZod('Number', issues)._def.typeName).toBe('ZodNumber');
    expect(fragmentTypeToZod('BOOLEAN', issues)._def.typeName).toBe('ZodBoolean');
    expect(issues).toHaveLength(0);
  });

  it('should handle integer and float as number', () => {
    const issues: Issue[] = [];

    expect(fragmentTypeToZod('integer', issues)._def.typeName).toBe('ZodNumber');
    expect(fragmentTypeToZod('float', issues)._def.typeName).toBe('ZodNumber');
    expect(issues).toHaveLength(0);
  });
});

describe('fragmentTypeToZodWithConstraints', () => {
  it('should create nullable type', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZodWithConstraints(
      'string',
      { nullable: true },
      issues
    );

    expect(zodType._def.typeName).toBe('ZodNullable');
  });

  it('should create optional type', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZodWithConstraints(
      'string',
      { optional: true },
      issues
    );

    expect(zodType._def.typeName).toBe('ZodOptional');
  });

  it('should create type with default', () => {
    const issues: Issue[] = [];
    const zodType = fragmentTypeToZodWithConstraints(
      'number',
      { default: 42 },
      issues
    );

    expect(zodType._def.typeName).toBe('ZodDefault');
  });
});

// ============================================================================
// buildDataSchema Tests (Principle C)
// ============================================================================

describe('buildDataSchema', () => {
  it('should build z.object from SchemaFragments', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        namespace: 'data',
        fields: [
          { path: 'data.count', type: 'number', semantic: { type: 'number' } },
          { path: 'data.name', type: 'string', semantic: { type: 'string' } },
        ],
      }),
    ];

    const schema = buildDataSchema(fragments, issues);

    expect(schema._def.typeName).toBe('ZodObject');
    expect(schema.shape.count).toBeDefined();
    expect(schema.shape.name).toBeDefined();
    expect(schema.shape.count._def.typeName).toBe('ZodNumber');
    expect(schema.shape.name._def.typeName).toBe('ZodString');
  });

  it('should only include data namespace schemas', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        namespace: 'data',
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        namespace: 'state',
        fields: [{ path: 'state.loading', type: 'boolean', semantic: {} }],
      }),
    ];

    const schema = buildDataSchema(fragments, issues);

    expect(schema.shape.count).toBeDefined();
    expect(schema.shape.loading).toBeUndefined();
  });

  it('should merge fields from multiple SchemaFragments', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        id: 'a',
        namespace: 'data',
        fields: [{ path: 'data.a', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'b',
        namespace: 'data',
        fields: [{ path: 'data.b', type: 'string', semantic: {} }],
      }),
    ];

    const schema = buildDataSchema(fragments, issues);

    expect(schema.shape.a).toBeDefined();
    expect(schema.shape.b).toBeDefined();
  });

  it('should record issue for unknown types', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        namespace: 'data',
        fields: [{ path: 'data.custom', type: 'CustomType', semantic: {} }],
      }),
    ];

    const schema = buildDataSchema(fragments, issues);

    expect(schema.shape.custom._def.typeName).toBe('ZodUnknown');
    expect(issues.some((i) => i.code === 'UNKNOWN_TYPE')).toBe(true);
  });
});

describe('buildStateSchema', () => {
  it('should build z.object from state namespace SchemaFragments', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        namespace: 'state',
        fields: [
          { path: 'state.loading', type: 'boolean', semantic: {} },
          { path: 'state.error', type: 'string', semantic: {} },
        ],
      }),
    ];

    const schema = buildStateSchema(fragments, issues);

    expect(schema._def.typeName).toBe('ZodObject');
    expect(schema.shape.loading._def.typeName).toBe('ZodBoolean');
    expect(schema.shape.error._def.typeName).toBe('ZodString');
  });

  it('should exclude data namespace schemas', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSchemaFragment({
        namespace: 'data',
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        namespace: 'state',
        fields: [{ path: 'state.loading', type: 'boolean', semantic: {} }],
      }),
    ];

    const schema = buildStateSchema(fragments, issues);

    expect(schema.shape.count).toBeUndefined();
    expect(schema.shape.loading).toBeDefined();
  });
});

// ============================================================================
// buildSources Tests
// ============================================================================

describe('buildSources', () => {
  it('should build source definitions', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSourceFragment({
        path: 'data.input',
        schema: { path: 'data.input', type: 'string', defaultValue: 'hello' },
      }),
    ];

    const sources = buildSources(fragments, issues);

    expect(sources['data.input']).toBeDefined();
    expect(sources['data.input'].schema._def.typeName).toBe('ZodString');
    expect(sources['data.input'].defaultValue).toBe('hello');
  });

  it('should include semantic metadata', () => {
    const issues: Issue[] = [];
    const fragments = [
      createSourceFragment({
        path: 'data.input',
        semantic: { type: 'string', description: 'User input' },
      }),
    ];

    const sources = buildSources(fragments, issues);

    expect(sources['data.input'].semantic.description).toBe('User input');
  });
});

// ============================================================================
// buildDerived Tests
// ============================================================================

describe('buildDerived', () => {
  it('should build derived definitions', () => {
    const issues: Issue[] = [];
    const fragments = [
      createDerivedFragment({
        path: 'derived.doubled',
        requires: ['data.count'],
        expr: ['*', ['get', 'data.count'], 2],
      }),
    ];

    const derived = buildDerived(fragments, issues);

    expect(derived['derived.doubled']).toBeDefined();
    expect(derived['derived.doubled'].deps).toContain('data.count');
    expect(derived['derived.doubled'].expr).toEqual(['*', ['get', 'data.count'], 2]);
  });

  it('should include semantic metadata', () => {
    const issues: Issue[] = [];
    const fragments = [
      createDerivedFragment({
        semantic: { type: 'number', description: 'Doubled count' },
      }),
    ];

    const derived = buildDerived(fragments, issues);

    expect(derived['derived.doubled'].semantic.description).toBe('Doubled count');
  });
});

// ============================================================================
// buildActions Tests
// ============================================================================

describe('buildActions', () => {
  it('should build action definitions with inline effect', () => {
    const issues: Issue[] = [];
    const fragments = [
      createActionFragment({
        actionId: 'increment',
        effect: {
          _tag: 'SetValue',
          path: 'data.count' as any,
          value: ['+', ['get', 'data.count'], 1],
        },
      }),
    ];

    const actions = buildActions(fragments, [], [], issues);

    expect(actions['increment']).toBeDefined();
    expect(actions['increment'].effect._tag).toBe('SetValue');
  });

  it('should build action definitions with effect reference', () => {
    const issues: Issue[] = [];
    const actionFragments = [
      createActionFragment({
        actionId: 'doThing',
        effect: undefined,
        effectRef: 'doSomething',
      }),
    ];
    const effectFragments = [
      createEffectFragment({
        name: 'doSomething',
        effect: {
          _tag: 'SetValue',
          path: 'data.x' as any,
          value: 1,
        },
      }),
    ];

    const actions = buildActions(actionFragments, effectFragments, [], issues);

    expect(actions['doThing']).toBeDefined();
    expect(actions['doThing'].effect._tag).toBe('SetValue');
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('should report error for missing effect reference', () => {
    const issues: Issue[] = [];
    const actionFragments = [
      createActionFragment({
        actionId: 'doThing',
        effect: undefined,
        effectRef: 'nonexistent',
      }),
    ];

    const actions = buildActions(actionFragments, [], [], issues);

    expect(actions['doThing']).toBeUndefined();
    expect(issues.some((i) => i.code === 'MISSING_EFFECT_REF')).toBe(true);
  });

  it('should report error for action without effect', () => {
    const issues: Issue[] = [];
    const actionFragments = [
      createActionFragment({
        actionId: 'noEffect',
        effect: undefined,
        effectRef: undefined,
      }),
    ];

    const actions = buildActions(actionFragments, [], [], issues);

    expect(actions['noEffect']).toBeUndefined();
    expect(issues.some((i) => i.code === 'MISSING_ACTION_EFFECT')).toBe(true);
  });

  it('should collect preconditions from PolicyFragments', () => {
    const issues: Issue[] = [];
    const actionFragments = [
      createActionFragment({
        actionId: 'submit',
        preconditions: [
          { path: 'derived.isReady' as any, expect: 'true', reason: 'Ready' },
        ],
      }),
    ];
    const policyFragments = [
      createPolicyFragment({
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [
          { path: 'derived.isValid' as any, expect: 'true', reason: 'Valid' },
        ],
      }),
    ];

    const actions = buildActions(actionFragments, [], policyFragments, issues);

    expect(actions['submit'].preconditions).toHaveLength(2);
    expect(
      actions['submit'].preconditions!.some((p) => p.path === 'derived.isReady')
    ).toBe(true);
    expect(
      actions['submit'].preconditions!.some((p) => p.path === 'derived.isValid')
    ).toBe(true);
  });

  it('should include action semantic metadata', () => {
    const issues: Issue[] = [];
    const fragments = [
      createActionFragment({
        actionId: 'submit',
        semantic: {
          verb: 'submit',
          description: 'Submit the form',
          risk: 'medium',
        },
      }),
    ];

    const actions = buildActions(fragments, [], [], issues);

    expect(actions['submit'].semantic.verb).toBe('submit');
    expect(actions['submit'].semantic.description).toBe('Submit the form');
    expect(actions['submit'].semantic.risk).toBe('medium');
  });
});

// ============================================================================
// buildDomainDraft Tests (Main Function)
// ============================================================================

describe('buildDomainDraft', () => {
  it('should build complete domain draft', () => {
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
      createDerivedFragment({ id: 'derived-doubled' }),
      createActionFragment({ id: 'action-increment' }),
    ];

    const result = buildDomainDraft(fragments);

    expect(result.domain).toBeDefined();
    expect(result.zodSchemas.data).toBeDefined();
    expect(result.zodSchemas.state).toBeDefined();
    expect(result.domain.sources).toBeDefined();
    expect(result.domain.derived).toBeDefined();
    expect(result.domain.actions).toBeDefined();
  });

  it('should set domain metadata from options', () => {
    const fragments: Fragment[] = [];

    const result = buildDomainDraft(fragments, {
      domainId: 'my-domain',
      domainName: 'My Domain',
      domainDescription: 'A test domain',
    });

    expect(result.domain.id).toBe('my-domain');
    expect(result.domain.name).toBe('My Domain');
    expect(result.domain.description).toBe('A test domain');
  });

  it('should calculate initial state from state schema defaults', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        namespace: 'state',
        fields: [
          { path: 'state.loading', type: 'boolean', semantic: {} },
          { path: 'state.count', type: 'number', semantic: {} },
        ],
      }),
    ];

    const result = buildDomainDraft(fragments);

    expect(result.domain.initialState).toEqual({
      loading: false,
      count: 0,
    });
  });

  it('should use provided default initial state', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        namespace: 'state',
        fields: [{ path: 'state.loading', type: 'boolean', semantic: {} }],
      }),
    ];

    const result = buildDomainDraft(fragments, {
      defaultInitialState: { loading: true },
    });

    expect(result.domain.initialState).toEqual({ loading: true });
  });

  it('should return isExecutable: true when no errors (Principle C)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({
        namespace: 'data',
        fields: [{ path: 'data.count', type: 'number', semantic: {} }],
      }),
    ];

    const result = buildDomainDraft(fragments);

    expect(result.isExecutable).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('should return isExecutable: false when errors exist', () => {
    const fragments: Fragment[] = [
      createActionFragment({
        actionId: 'broken',
        effect: undefined,
        effectRef: undefined,
      }),
    ];

    const result = buildDomainDraft(fragments);

    expect(result.isExecutable).toBe(false);
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('should include statistics', () => {
    const fragments: Fragment[] = [
      createSourceFragment({ id: 'src-1', path: 'data.a' }),
      createSourceFragment({ id: 'src-2', path: 'data.b' }),
      createDerivedFragment({ id: 'der-1', path: 'derived.x' }),
      createActionFragment({ id: 'act-1', actionId: 'action1' }),
    ];

    const result = buildDomainDraft(fragments);

    expect(result.stats.sourcesCount).toBe(2);
    expect(result.stats.derivedCount).toBe(1);
    expect(result.stats.actionsCount).toBe(1);
  });

  it('should sort fragments by stableId (Principle E)', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ id: 'z-schema', namespace: 'data' }),
      createSchemaFragment({ id: 'a-schema', namespace: 'data' }),
    ];

    const result1 = buildDomainDraft(fragments, { sortByStableId: true });
    const result2 = buildDomainDraft([...fragments].reverse(), { sortByStableId: true });

    // Results should be identical regardless of input order
    expect(Object.keys(result1.domain.dataSchema).sort()).toEqual(
      Object.keys(result2.domain.dataSchema).sort()
    );
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('mergeSchemaFields', () => {
  it('should merge fields from multiple schemas', () => {
    const fragments = [
      createSchemaFragment({
        fields: [
          { path: 'data.a', type: 'number', semantic: {} },
          { path: 'data.b', type: 'string', semantic: {} },
        ],
      }),
      createSchemaFragment({
        fields: [
          { path: 'data.c', type: 'boolean', semantic: {} },
        ],
      }),
    ];

    const fields = mergeSchemaFields(fragments);

    expect(fields.size).toBe(3);
    expect(fields.has('data.a')).toBe(true);
    expect(fields.has('data.b')).toBe(true);
    expect(fields.has('data.c')).toBe(true);
  });

  it('should override with later fragment fields', () => {
    const fragments = [
      createSchemaFragment({
        id: 'first',
        fields: [{ path: 'data.x', type: 'number', semantic: {} }],
      }),
      createSchemaFragment({
        id: 'second',
        fields: [{ path: 'data.x', type: 'string', semantic: {} }],
      }),
    ];

    const fields = mergeSchemaFields(fragments);

    expect(fields.get('data.x')?.type).toBe('string');
  });
});

describe('extractAllPaths', () => {
  it('should extract all non-action paths', () => {
    const fragments: Fragment[] = [
      createSchemaFragment({ provides: ['data.a', 'data.b'] }),
      createDerivedFragment({ provides: ['derived.x'] }),
      createActionFragment({ provides: ['action:submit'] }),
    ];

    const paths = extractAllPaths(fragments);

    expect(paths.has('data.a')).toBe(true);
    expect(paths.has('data.b')).toBe(true);
    expect(paths.has('derived.x')).toBe(true);
    expect(paths.has('action:submit')).toBe(false);
  });
});

describe('validateDomainDraft', () => {
  it('should warn about empty data schema', () => {
    const draft = {
      dataSchema: {},
      stateSchema: {},
      sources: {},
      derived: {},
      actions: {},
    };

    const issues = validateDomainDraft(draft);

    expect(issues.some((i) => i.code === 'EMPTY_DATA_SCHEMA')).toBe(true);
  });

  it('should error on actions without effects', () => {
    const draft = {
      dataSchema: { count: 'number' },
      stateSchema: {},
      sources: {},
      derived: {},
      actions: {
        broken: {
          deps: [],
          effect: undefined as any,
          semantic: { type: 'action', description: '', verb: '' },
        },
      },
    };

    const issues = validateDomainDraft(draft);

    expect(issues.some((i) => i.code === 'ACTION_WITHOUT_EFFECT')).toBe(true);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
  });
});
