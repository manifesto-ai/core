/**
 * Action Pass Tests
 *
 * Action Pass가 function_declaration Finding에서 액션 패턴을 감지하고
 * ActionFragment를 생성하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  actionPass,
  codeAstExtractorPass,
  isActionHandler,
  extractActionId,
  extractSemanticVerb,
  findRelatedEffects,
  findRelatedPolicies,
  collectPreconditions,
  determineMaxRisk,
  createPassRegistry,
  createPassExecutor,
  createPassContext,
} from '../../src/pass/index.js';
import type { Finding, FunctionDeclarationData } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';
import type { ActionFragment, EffectFragment, PolicyFragment } from '../../src/types/fragment.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createCodeArtifact(content: string, language: 'js' | 'ts' = 'ts'): CodeArtifact {
  return {
    id: 'test-artifact',
    kind: 'code',
    language,
    content,
  };
}

async function compileToActionFragments(content: string): Promise<ActionFragment[]> {
  const registry = createPassRegistry();
  registry.registerAll([codeAstExtractorPass, actionPass]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return result.fragments.filter(
    (f): f is ActionFragment => f.kind === 'ActionFragment'
  );
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('ActionPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('function handleSubmit() {}');
      expect(actionPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(actionPass.supports(artifact)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should filter action handler functions', () => {
      const artifact = createCodeArtifact('function handleSubmit() {}');
      const mockFindings: Finding[] = [
        {
          id: 'f1',
          kind: 'function_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: {
            kind: 'function_declaration',
            name: 'handleSubmit',
            params: [],
            isAsync: false,
            sourceCode: 'function handleSubmit() {}',
          } satisfies FunctionDeclarationData,
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f2',
          kind: 'function_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: {
            kind: 'function_declaration',
            name: 'utilityFunction',
            params: [],
            isAsync: false,
            sourceCode: 'function utilityFunction() {}',
          } satisfies FunctionDeclarationData,
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
      ];

      const ctx = createPassContext(artifact, { previousFindings: mockFindings });
      const filtered = actionPass.analyze(ctx);

      expect(filtered).toHaveLength(1);
      expect((filtered[0]?.data as FunctionDeclarationData).name).toBe('handleSubmit');
    });
  });
});

// ============================================================================
// Action Handler Detection Tests
// ============================================================================

describe('isActionHandler', () => {
  describe('handler patterns', () => {
    it('should detect handleX pattern', () => {
      expect(isActionHandler('handleSubmit')).toBe(true);
      expect(isActionHandler('handleClick')).toBe(true);
      expect(isActionHandler('handleSave')).toBe(true);
    });

    it('should detect onX pattern', () => {
      expect(isActionHandler('onSubmit')).toBe(true);
      expect(isActionHandler('onClick')).toBe(true);
      expect(isActionHandler('onSave')).toBe(true);
    });

    it('should detect doX pattern', () => {
      expect(isActionHandler('doSubmit')).toBe(true);
      expect(isActionHandler('doSave')).toBe(true);
      expect(isActionHandler('doDelete')).toBe(true);
    });
  });

  describe('action verbs', () => {
    it('should detect action verb patterns', () => {
      expect(isActionHandler('submit')).toBe(true);
      expect(isActionHandler('save')).toBe(true);
      expect(isActionHandler('delete')).toBe(true);
      expect(isActionHandler('create')).toBe(true);
      expect(isActionHandler('update')).toBe(true);
      expect(isActionHandler('cancel')).toBe(true);
      expect(isActionHandler('reset')).toBe(true);
      expect(isActionHandler('login')).toBe(true);
      expect(isActionHandler('logout')).toBe(true);
    });

    it('should detect verbs in compound names', () => {
      expect(isActionHandler('submitForm')).toBe(true);
      expect(isActionHandler('saveData')).toBe(true);
      expect(isActionHandler('deleteItem')).toBe(true);
    });
  });

  describe('non-action functions', () => {
    it('should not detect utility functions', () => {
      expect(isActionHandler('calculateTotal')).toBe(false);
      expect(isActionHandler('formatDate')).toBe(false);
      expect(isActionHandler('parseJSON')).toBe(false);
      expect(isActionHandler('validateInput')).toBe(false);
    });
  });
});

// ============================================================================
// Action ID Extraction Tests
// ============================================================================

describe('extractActionId', () => {
  it('should extract verb from handleX', () => {
    expect(extractActionId('handleSubmit')).toBe('submit');
    expect(extractActionId('handleClick')).toBe('click');
    expect(extractActionId('handleSave')).toBe('save');
  });

  it('should extract verb from onX', () => {
    expect(extractActionId('onSubmit')).toBe('submit');
    expect(extractActionId('onClick')).toBe('click');
  });

  it('should extract verb from doX', () => {
    expect(extractActionId('doSubmit')).toBe('submit');
    expect(extractActionId('doSave')).toBe('save');
  });

  it('should lowercase first letter for plain names', () => {
    expect(extractActionId('Submit')).toBe('submit');
    expect(extractActionId('SaveData')).toBe('saveData');
  });

  it('should keep already lowercase names', () => {
    expect(extractActionId('submit')).toBe('submit');
    expect(extractActionId('saveData')).toBe('saveData');
  });
});

// ============================================================================
// Semantic Verb Extraction Tests
// ============================================================================

describe('extractSemanticVerb', () => {
  it('should extract known verbs', () => {
    expect(extractSemanticVerb('submit')).toBe('submit');
    expect(extractSemanticVerb('submitForm')).toBe('submit');
    expect(extractSemanticVerb('save')).toBe('save');
    expect(extractSemanticVerb('saveData')).toBe('save');
    expect(extractSemanticVerb('delete')).toBe('delete');
    expect(extractSemanticVerb('deleteItem')).toBe('delete');
  });

  it('should extract first word for unknown patterns', () => {
    expect(extractSemanticVerb('foo')).toBe('foo');
    expect(extractSemanticVerb('bar')).toBe('bar');
  });
});

// ============================================================================
// Fragment Collection Tests
// ============================================================================

describe('findRelatedEffects', () => {
  it('should find effects matching action ID', () => {
    const artifact = createCodeArtifact('');
    const mockEffects: EffectFragment[] = [
      {
        id: 'eff_1',
        kind: 'EffectFragment',
        requires: [],
        provides: ['effect:set_count_0'],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        effect: { _tag: 'SetValue', path: 'data.count' as any, value: 10, description: 'test' },
        name: 'set_submit_count',
        risk: 'low',
      },
      {
        id: 'eff_2',
        kind: 'EffectFragment',
        requires: [],
        provides: ['effect:other'],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        effect: { _tag: 'SetValue', path: 'data.other' as any, value: 10, description: 'test' },
        name: 'set_other',
        risk: 'low',
      },
    ];

    const ctx = createPassContext(artifact, { existingFragments: mockEffects });
    const effects = findRelatedEffects('submit', 'handleSubmit', ctx);

    expect(effects).toHaveLength(1);
    expect(effects[0]?.name).toContain('submit');
  });
});

describe('findRelatedPolicies', () => {
  it('should find policies targeting action ID', () => {
    const artifact = createCodeArtifact('');
    const mockPolicies: PolicyFragment[] = [
      {
        id: 'pol_1',
        kind: 'PolicyFragment',
        requires: ['data.canSubmit' as any],
        provides: ['policy:action:submit'],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [{ path: 'data.canSubmit' as any, expect: 'true' }],
      },
      {
        id: 'pol_2',
        kind: 'PolicyFragment',
        requires: [],
        provides: ['policy:action:other'],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        target: { kind: 'action', actionId: 'other' },
      },
    ];

    const ctx = createPassContext(artifact, { existingFragments: mockPolicies });
    const policies = findRelatedPolicies('submit', ctx);

    expect(policies).toHaveLength(1);
    expect(policies[0]?.target).toEqual({ kind: 'action', actionId: 'submit' });
  });
});

describe('collectPreconditions', () => {
  it('should collect preconditions from policies', () => {
    const policies: PolicyFragment[] = [
      {
        id: 'pol_1',
        kind: 'PolicyFragment',
        requires: ['data.canSubmit' as any],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [
          { path: 'data.canSubmit' as any, expect: 'true' },
          { path: 'data.isValid' as any, expect: 'true' },
        ],
      },
    ];

    const preconditions = collectPreconditions(policies);
    expect(preconditions).toHaveLength(2);
  });

  it('should remove duplicate preconditions', () => {
    const policies: PolicyFragment[] = [
      {
        id: 'pol_1',
        kind: 'PolicyFragment',
        requires: [],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [{ path: 'data.canSubmit' as any, expect: 'true' }],
      },
      {
        id: 'pol_2',
        kind: 'PolicyFragment',
        requires: [],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        target: { kind: 'action', actionId: 'submit' },
        preconditions: [{ path: 'data.canSubmit' as any, expect: 'true' }],
      },
    ];

    const preconditions = collectPreconditions(policies);
    expect(preconditions).toHaveLength(1);
  });
});

describe('determineMaxRisk', () => {
  it('should return none when no effects', () => {
    expect(determineMaxRisk([])).toBe('none');
  });

  it('should return max risk from effects', () => {
    const effects: EffectFragment[] = [
      {
        id: 'eff_1',
        kind: 'EffectFragment',
        requires: [],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        effect: { _tag: 'SetValue', path: 'data.x' as any, value: 1, description: 'test' },
        risk: 'low',
      },
      {
        id: 'eff_2',
        kind: 'EffectFragment',
        requires: [],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        effect: { _tag: 'ApiCall', endpoint: '/api', method: 'DELETE', description: 'test' },
        risk: 'critical',
      },
    ];

    expect(determineMaxRisk(effects)).toBe('critical');
  });

  it('should handle undefined risk', () => {
    const effects: EffectFragment[] = [
      {
        id: 'eff_1',
        kind: 'EffectFragment',
        requires: [],
        provides: [],
        origin: { artifactId: 'test', location: { kind: 'generated', note: 'test' } },
        evidence: [],
        compilerVersion: '0.1.0',
        effect: { _tag: 'SetValue', path: 'data.x' as any, value: 1, description: 'test' },
        // No risk property
      },
    ];

    expect(determineMaxRisk(effects)).toBe('none');
  });
});

// ============================================================================
// Fragment Generation Tests
// ============================================================================

describe('Fragment Generation', () => {
  it('should create ActionFragment for handler function', async () => {
    const code = `function handleSubmit() { submit(); }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.kind).toBe('ActionFragment');
    expect(fragments[0]?.actionId).toBe('submit');
  });

  it('should create ActionFragment for onX pattern', async () => {
    const code = `function onSave() { saveData(); }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.actionId).toBe('save');
  });

  it('should include semantic metadata', async () => {
    const code = `function handleDelete() { deleteItem(); }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments[0]?.semantic).toBeDefined();
    expect(fragments[0]?.semantic?.verb).toBe('delete');
    expect(fragments[0]?.semantic?.description).toContain('delete');
  });

  it('should have stable ID format', async () => {
    const code = `function handleClick() { }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments[0]?.id).toBeDefined();
    expect(fragments[0]?.id).toMatch(/^act_/);
  });

  it('should include evidence', async () => {
    const code = `function handleSubmit() { }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments[0]?.evidence).toBeDefined();
    expect(fragments[0]?.evidence?.length).toBeGreaterThanOrEqual(1);
  });

  it('should not create fragment for non-action functions', async () => {
    const code = `function calculateTotal() { return 100; }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Action Pass Integration', () => {
  it('should work with pass executor', async () => {
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, actionPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('function handleSubmit() {}');
    const result = await executor.execute(artifact);

    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('code-ast-extractor');
    expect(result.passResults[1]?.passName).toBe('action-pass');
  });

  it('should include origin provenance', async () => {
    const code = `function handleSubmit() { }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments[0]?.origin).toBeDefined();
    expect(fragments[0]?.origin?.artifactId).toBe('test-artifact');
  });

  it('should include compiler version', async () => {
    const code = `function handleSubmit() { }`;
    const fragments = await compileToActionFragments(code);

    expect(fragments[0]?.compilerVersion).toBeDefined();
  });
});

// ============================================================================
// Complex Code Tests
// ============================================================================

describe('Complex Code', () => {
  it('should handle multiple action handlers', async () => {
    const code = `
      function handleSubmit() { submit(); }
      function onCancel() { cancel(); }
      function doReset() { reset(); }
    `;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(3);
    expect(fragments.map((f) => f.actionId).sort()).toEqual(['cancel', 'reset', 'submit']);
  });

  it('should handle async handlers', async () => {
    const code = `
      async function handleSave() {
        await saveData();
      }
    `;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.actionId).toBe('save');
  });

  it('should handle handlers with parameters', async () => {
    const code = `
      function handleDelete(id: string) {
        deleteItem(id);
      }
    `;
    const fragments = await compileToActionFragments(code);

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.actionId).toBe('delete');
  });
});
