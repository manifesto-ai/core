/**
 * Fragment Types Tests
 *
 * Tests for all fragment type guards in src/types/fragment.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import type {
  Fragment,
  SchemaFragment,
  SourceFragment,
  ExpressionFragment,
  DerivedFragment,
  PolicyFragment,
  EffectFragment,
  ActionFragment,
  StatementFragment,
} from '../../src/types/fragment.js';
import {
  isSchemaFragment,
  isSourceFragment,
  isExpressionFragment,
  isDerivedFragment,
  isPolicyFragment,
  isEffectFragment,
  isActionFragment,
  isStatementFragment,
} from '../../src/types/fragment.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseFragment(kind: string): Fragment {
  return {
    id: `test_${kind}_1`,
    kind: kind as any,
    requires: [],
    provides: ['test.path'],
    origin: {
      artifactId: 'test',
      location: { kind: 'generated' },
      createdAt: Date.now(),
    },
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    tags: [],
  } as any;
}

function createSchemaFrag(): SchemaFragment {
  return {
    ...createBaseFragment('SchemaFragment'),
    kind: 'SchemaFragment',
    namespace: 'data',
    fields: [{ path: 'data.count' as SemanticPath, type: 'number' }],
  } as SchemaFragment;
}

function createSourceFrag(): SourceFragment {
  return {
    ...createBaseFragment('SourceFragment'),
    kind: 'SourceFragment',
    path: 'data.input' as SemanticPath,
    schema: { path: 'data.input' as SemanticPath, type: 'string' },
    semantic: { type: 'string', description: 'User input' },
  } as SourceFragment;
}

function createExpressionFrag(): ExpressionFragment {
  return {
    ...createBaseFragment('ExpressionFragment'),
    kind: 'ExpressionFragment',
    name: 'isValid',
    expr: ['>', ['get', 'data.count'], 0],
    resultType: 'boolean',
  } as ExpressionFragment;
}

function createDerivedFrag(): DerivedFragment {
  return {
    ...createBaseFragment('DerivedFragment'),
    kind: 'DerivedFragment',
    path: 'derived.total' as SemanticPath,
    deps: ['data.count' as SemanticPath],
    expr: ['*', ['get', 'data.count'], 2],
  } as DerivedFragment;
}

function createPolicyFrag(): PolicyFragment {
  return {
    ...createBaseFragment('PolicyFragment'),
    kind: 'PolicyFragment',
    path: 'data.field' as SemanticPath,
    editable: ['literal', true],
    visible: ['literal', true],
  } as PolicyFragment;
}

function createEffectFrag(): EffectFragment {
  return {
    ...createBaseFragment('EffectFragment'),
    kind: 'EffectFragment',
    effect: ['sequence', []],
    risk: 'low',
  } as EffectFragment;
}

function createActionFrag(): ActionFragment {
  return {
    ...createBaseFragment('ActionFragment'),
    kind: 'ActionFragment',
    name: 'doSomething',
    effect: ['sequence', []],
    preconditions: [],
  } as ActionFragment;
}

function createStatementFrag(): StatementFragment {
  return {
    ...createBaseFragment('StatementFragment'),
    kind: 'StatementFragment',
    statementType: 'conditional',
    condition: ['literal', true],
    effect: ['sequence', []],
  } as StatementFragment;
}

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isSchemaFragment', () => {
  it('should return true for SchemaFragment', () => {
    expect(isSchemaFragment(createSchemaFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isSchemaFragment(createSourceFrag())).toBe(false);
    expect(isSchemaFragment(createDerivedFrag())).toBe(false);
    expect(isSchemaFragment(createEffectFrag())).toBe(false);
    expect(isSchemaFragment(createActionFrag())).toBe(false);
  });
});

describe('isSourceFragment', () => {
  it('should return true for SourceFragment', () => {
    expect(isSourceFragment(createSourceFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isSourceFragment(createSchemaFrag())).toBe(false);
    expect(isSourceFragment(createDerivedFrag())).toBe(false);
    expect(isSourceFragment(createEffectFrag())).toBe(false);
  });
});

describe('isExpressionFragment', () => {
  it('should return true for ExpressionFragment', () => {
    expect(isExpressionFragment(createExpressionFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isExpressionFragment(createSchemaFrag())).toBe(false);
    expect(isExpressionFragment(createDerivedFrag())).toBe(false);
  });
});

describe('isDerivedFragment', () => {
  it('should return true for DerivedFragment', () => {
    expect(isDerivedFragment(createDerivedFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isDerivedFragment(createSchemaFrag())).toBe(false);
    expect(isDerivedFragment(createSourceFrag())).toBe(false);
    expect(isDerivedFragment(createActionFrag())).toBe(false);
  });
});

describe('isPolicyFragment', () => {
  it('should return true for PolicyFragment', () => {
    expect(isPolicyFragment(createPolicyFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isPolicyFragment(createSchemaFrag())).toBe(false);
    expect(isPolicyFragment(createEffectFrag())).toBe(false);
  });
});

describe('isEffectFragment', () => {
  it('should return true for EffectFragment', () => {
    expect(isEffectFragment(createEffectFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isEffectFragment(createSchemaFrag())).toBe(false);
    expect(isEffectFragment(createActionFrag())).toBe(false);
  });
});

describe('isActionFragment', () => {
  it('should return true for ActionFragment', () => {
    expect(isActionFragment(createActionFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isActionFragment(createSchemaFrag())).toBe(false);
    expect(isActionFragment(createEffectFrag())).toBe(false);
    expect(isActionFragment(createStatementFrag())).toBe(false);
  });
});

describe('isStatementFragment', () => {
  it('should return true for StatementFragment', () => {
    expect(isStatementFragment(createStatementFrag())).toBe(true);
  });

  it('should return false for other fragment types', () => {
    expect(isStatementFragment(createSchemaFrag())).toBe(false);
    expect(isStatementFragment(createActionFrag())).toBe(false);
    expect(isStatementFragment(createEffectFrag())).toBe(false);
  });
});

// ============================================================================
// Type Narrowing Tests
// ============================================================================

describe('Type Narrowing', () => {
  it('should narrow SchemaFragment correctly', () => {
    const fragment: Fragment = createSchemaFrag();
    if (isSchemaFragment(fragment)) {
      // TypeScript should allow accessing SchemaFragment-specific fields
      expect(fragment.namespace).toBe('data');
      expect(fragment.fields).toBeDefined();
    }
  });

  it('should narrow DerivedFragment correctly', () => {
    const fragment: Fragment = createDerivedFrag();
    if (isDerivedFragment(fragment)) {
      expect(fragment.path).toBe('derived.total');
      expect(fragment.deps).toBeDefined();
      expect(fragment.expr).toBeDefined();
    }
  });

  it('should narrow ActionFragment correctly', () => {
    const fragment: Fragment = createActionFrag();
    if (isActionFragment(fragment)) {
      expect(fragment.name).toBe('doSomething');
      expect(fragment.effect).toBeDefined();
      expect(fragment.preconditions).toBeDefined();
    }
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle fragments with minimal fields', () => {
    const minimal: Fragment = {
      id: 'min',
      kind: 'SchemaFragment',
      requires: [],
      provides: [],
      origin: { artifactId: 'x', location: { kind: 'generated' }, createdAt: 0 },
      evidence: [],
      compilerVersion: '0.1.0',
      namespace: 'data',
      fields: [],
    } as any;

    expect(isSchemaFragment(minimal)).toBe(true);
    expect(isSourceFragment(minimal)).toBe(false);
  });

  it('should work with array of fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFrag(),
      createSourceFrag(),
      createDerivedFrag(),
      createEffectFrag(),
      createActionFrag(),
    ];

    const schemaFrags = fragments.filter(isSchemaFragment);
    const derivedFrags = fragments.filter(isDerivedFragment);
    const actionFrags = fragments.filter(isActionFragment);

    expect(schemaFrags).toHaveLength(1);
    expect(derivedFrags).toHaveLength(1);
    expect(actionFrags).toHaveLength(1);
  });
});
