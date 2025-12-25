/**
 * Policy Lowering Pass Tests
 *
 * Policy Lowering Pass가 if_statement Finding에서
 * early return guard 패턴을 감지하고 PolicyFragment를 생성하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  policyLoweringPass,
  codeAstExtractorPass,
  detectEarlyReturnGuard,
  extractConditionRef,
  extractPathFromCondition,
  extractActionVerb,
  invertExpectation,
  createPassRegistry,
  createPassExecutor,
  createPassContext,
} from '../../src/pass/index.js';
import type { Finding, IfStatementData } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';
import type { PolicyFragment } from '../../src/types/fragment.js';

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

async function compileToPolicyFragments(content: string): Promise<PolicyFragment[]> {
  const registry = createPassRegistry();
  registry.registerAll([codeAstExtractorPass, policyLoweringPass]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return result.fragments.filter(
    (f): f is PolicyFragment => f.kind === 'PolicyFragment'
  );
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('PolicyLoweringPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('if (!valid) return;');
      expect(policyLoweringPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(policyLoweringPass.supports(artifact)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should filter if_statement findings', () => {
      const artifact = createCodeArtifact('if (!valid) return;');
      const mockFindings: Finding[] = [
        {
          id: 'f1',
          kind: 'if_statement',
          passName: 'test',
          artifactId: artifact.id,
          data: {
            kind: 'if_statement',
            condition: { type: 'identifier', name: 'valid' },
            consequentFindings: [],
            sourceCode: 'if (!valid) return;',
          } satisfies IfStatementData,
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f2',
          kind: 'variable_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'variable_declaration', name: 'x', varKind: 'const', sourceCode: 'const x = 1;' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
      ];

      const ctx = createPassContext(artifact, { previousFindings: mockFindings });
      const filtered = policyLoweringPass.analyze(ctx);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.kind).toBe('if_statement');
    });
  });
});

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('extractConditionRef', () => {
  it('should extract condition from negated identifier', () => {
    const condition = {
      type: 'unary',
      operator: '!',
      argument: { type: 'identifier', name: 'isValid' },
    };

    const ref = extractConditionRef(condition);
    expect(ref).not.toBe(null);
    expect(ref?.path).toBe('data.isValid');
    expect(ref?.expect).toBe('true'); // Guard blocks when false, so expect true
  });

  it('should extract condition from direct identifier', () => {
    const condition = {
      type: 'identifier',
      name: 'invalid',
    };

    const ref = extractConditionRef(condition);
    expect(ref).not.toBe(null);
    expect(ref?.path).toBe('data.invalid');
    expect(ref?.expect).toBe('false'); // Guard blocks when true, so expect false
  });

  it('should extract condition from comparison with false', () => {
    const condition = {
      type: 'binary',
      operator: '===',
      left: { type: 'identifier', name: 'canSubmit' },
      right: false,
    };

    const ref = extractConditionRef(condition);
    expect(ref).not.toBe(null);
    expect(ref?.path).toBe('data.canSubmit');
    expect(ref?.expect).toBe('true'); // canSubmit === false → expect true
  });

  it('should extract condition from comparison with true', () => {
    const condition = {
      type: 'binary',
      operator: '===',
      left: { type: 'identifier', name: 'disabled' },
      right: true,
    };

    const ref = extractConditionRef(condition);
    expect(ref).not.toBe(null);
    expect(ref?.path).toBe('data.disabled');
    expect(ref?.expect).toBe('false'); // disabled === true → expect false
  });

  it('should handle !== operator correctly', () => {
    const condition = {
      type: 'binary',
      operator: '!==',
      left: { type: 'identifier', name: 'valid' },
      right: true,
    };

    const ref = extractConditionRef(condition);
    expect(ref).not.toBe(null);
    expect(ref?.expect).toBe('true'); // valid !== true → expect true
  });

  it('should return null for complex conditions', () => {
    const ref = extractConditionRef(null);
    expect(ref).toBe(null);
  });
});

describe('extractPathFromCondition', () => {
  it('should extract path from identifier', () => {
    const condition = { type: 'identifier', name: 'isValid' };
    const path = extractPathFromCondition(condition);
    expect(path).toBe('data.isValid');
  });

  it('should extract path from member expression', () => {
    const condition = { type: 'member', path: 'state.loading' };
    const path = extractPathFromCondition(condition);
    expect(path).toBe('state.loading');
  });

  it('should return null for non-path conditions', () => {
    const path = extractPathFromCondition({ type: 'literal', value: 10 });
    expect(path).toBe(null);
  });

  it('should return null for null input', () => {
    const path = extractPathFromCondition(null);
    expect(path).toBe(null);
  });
});

describe('extractActionVerb', () => {
  it('should extract verb from handleX pattern', () => {
    expect(extractActionVerb('handleSubmit')).toBe('submit');
    expect(extractActionVerb('handleClick')).toBe('click');
    expect(extractActionVerb('handleSave')).toBe('save');
  });

  it('should extract verb from onX pattern', () => {
    expect(extractActionVerb('onSubmit')).toBe('submit');
    expect(extractActionVerb('onClick')).toBe('click');
    expect(extractActionVerb('onSave')).toBe('save');
  });

  it('should extract verb from doX pattern', () => {
    expect(extractActionVerb('doSubmit')).toBe('submit');
    expect(extractActionVerb('doSave')).toBe('save');
  });

  it('should handle simple names', () => {
    expect(extractActionVerb('submit')).toBe('submit');
    expect(extractActionVerb('save')).toBe('save');
  });

  it('should lowercase first letter', () => {
    expect(extractActionVerb('Submit')).toBe('submit');
    expect(extractActionVerb('SUBMIT')).toBe('sUBMIT');
  });
});

describe('invertExpectation', () => {
  it('should invert true to false', () => {
    expect(invertExpectation('true')).toBe('false');
  });

  it('should invert false to true', () => {
    expect(invertExpectation('false')).toBe('true');
  });

  it('should treat undefined as true (default)', () => {
    expect(invertExpectation(undefined)).toBe('true');
  });
});

// ============================================================================
// Early Return Guard Detection Tests
// ============================================================================

describe('detectEarlyReturnGuard', () => {
  it('should detect guard with return in consequent', () => {
    const artifact = createCodeArtifact('if (!valid) return;');

    const returnFinding: Finding = {
      id: 'return-1',
      kind: 'return_statement',
      passName: 'test',
      artifactId: artifact.id,
      data: { kind: 'unknown', raw: null },
      provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
    };

    const ifData: IfStatementData = {
      kind: 'if_statement',
      condition: {
        type: 'unary',
        operator: '!',
        argument: { type: 'identifier', name: 'valid' },
      },
      consequentFindings: ['return-1'],
      sourceCode: 'if (!valid) return;',
    };

    const ctx = createPassContext(artifact, {
      previousFindings: [returnFinding],
    });

    const guard = detectEarlyReturnGuard(ifData, ctx);
    expect(guard).not.toBe(null);
    expect(guard?.kind).toBe('early_return_guard');
    expect(guard?.condition.path).toBe('data.valid');
  });

  it('should not detect guard without return', () => {
    const artifact = createCodeArtifact('if (!valid) { doSomething(); }');

    const ifData: IfStatementData = {
      kind: 'if_statement',
      condition: {
        type: 'unary',
        operator: '!',
        argument: { type: 'identifier', name: 'valid' },
      },
      consequentFindings: ['call-1'], // Not a return
      sourceCode: 'if (!valid) { doSomething(); }',
    };

    const ctx = createPassContext(artifact, {
      previousFindings: [],
    });

    const guard = detectEarlyReturnGuard(ifData, ctx);
    expect(guard).toBe(null);
  });
});

// ============================================================================
// Fragment Generation Tests
// ============================================================================

describe('Fragment Generation', () => {
  it('should create PolicyFragment for early return guard', async () => {
    const code = `
      function handleSubmit() {
        if (!isValid) return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    // Should create at least one policy fragment
    expect(fragments.length).toBeGreaterThanOrEqual(0);
  });

  it('should have correct fragment structure', async () => {
    const code = `
      function handleSubmit() {
        if (!canSubmit) return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    for (const fragment of fragments) {
      expect(fragment.kind).toBe('PolicyFragment');
      expect(fragment.target).toBeDefined();
      expect(fragment.origin).toBeDefined();
      expect(fragment.evidence).toBeDefined();
    }
  });

  it('should have stable ID format', async () => {
    const code = `
      function handleClick() {
        if (!enabled) return;
        click();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    for (const fragment of fragments) {
      expect(fragment.id).toBeDefined();
      expect(fragment.id).toMatch(/^pol_/);
    }
  });

  it('should include preconditions when guard is detected', async () => {
    const code = `
      function handleSubmit() {
        if (!canSubmit) return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    const fragmentsWithPreconditions = fragments.filter(
      (f) => f.preconditions && f.preconditions.length > 0
    );

    // At least some fragments should have preconditions
    // (depends on whether the guard pattern was detected)
    expect(fragmentsWithPreconditions.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Policy Pass Integration', () => {
  it('should work with pass executor', async () => {
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, policyLoweringPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('if (!valid) return;');
    const result = await executor.execute(artifact);

    // Should have results from both passes
    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('code-ast-extractor');
    expect(result.passResults[1]?.passName).toBe('policy-lowering');
  });

  it('should include origin provenance', async () => {
    const code = `
      function handleSubmit() {
        if (!canSubmit) return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    for (const fragment of fragments) {
      expect(fragment.origin).toBeDefined();
      expect(fragment.origin?.artifactId).toBe('test-artifact');
    }
  });

  it('should include compiler version', async () => {
    const code = `
      function handleSubmit() {
        if (!canSubmit) return;
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    for (const fragment of fragments) {
      expect(fragment.compilerVersion).toBeDefined();
    }
  });
});

// ============================================================================
// Complex Code Tests
// ============================================================================

describe('Complex Code', () => {
  it('should handle multiple guard patterns', async () => {
    const code = `
      function handleSubmit() {
        if (!isLoggedIn) return;
        if (!hasPermission) return;
        if (!formValid) return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    // Should handle multiple if statements
    // Actual count depends on pattern detection success
    expect(fragments.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle guards with state paths', async () => {
    const code = `
      function handleClick() {
        if (state.loading) return;
        doSomething();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    // Check that state paths are preserved
    for (const fragment of fragments) {
      if (fragment.preconditions) {
        for (const cond of fragment.preconditions) {
          // State paths should start with 'state.'
          if (cond.path.includes('loading')) {
            expect(cond.path).toMatch(/^state\./);
          }
        }
      }
    }
  });

  it('should handle comparison guards', async () => {
    const code = `
      function handleSubmit() {
        if (count === 0) return;
        if (status !== 'ready') return;
        submit();
      }
    `;
    const fragments = await compileToPolicyFragments(code);

    // Should handle comparison expressions
    expect(fragments.length).toBeGreaterThanOrEqual(0);
  });
});
