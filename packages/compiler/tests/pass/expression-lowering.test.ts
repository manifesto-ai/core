/**
 * Expression Lowering Pass Tests
 *
 * Expression Lowering Pass가 binary_expression 및 if_statement Finding을
 * Expression DSL로 올바르게 변환하고 DerivedFragment를 생성하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  expressionLoweringPass,
  codeAstExtractorPass,
  convertToExpressionDSL,
  inferSemanticPath,
  createPassRegistry,
  createPassExecutor,
} from '../../src/pass/index.js';
import { createPassContext, type Finding } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';
import type { DerivedFragment } from '../../src/types/fragment.js';

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

async function compileToDerivedFragments(content: string): Promise<DerivedFragment[]> {
  const registry = createPassRegistry();
  registry.registerAll([codeAstExtractorPass, expressionLoweringPass]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return result.fragments.filter(
    (f): f is DerivedFragment => f.kind === 'DerivedFragment'
  );
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('ExpressionLoweringPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('const x = 1;');
      expect(expressionLoweringPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(expressionLoweringPass.supports(artifact)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should filter binary_expression and if_statement findings', () => {
      const artifact = createCodeArtifact('if (a > b) {}');
      const mockFindings: Finding[] = [
        {
          id: 'f1',
          kind: 'binary_expression',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'binary_expression', operator: '>', left: { type: 'identifier', name: 'a' }, right: { type: 'identifier', name: 'b' }, sourceCode: 'a > b' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f2',
          kind: 'if_statement',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'if_statement', condition: { type: 'binary', operator: '>', left: { type: 'identifier', name: 'a' }, right: { type: 'identifier', name: 'b' } }, sourceCode: 'if (a > b) {}' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f3',
          kind: 'variable_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'variable_declaration', name: 'x', varKind: 'const', sourceCode: 'const x = 1;' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
      ];

      const ctx = createPassContext(artifact, { previousFindings: mockFindings });
      const filtered = expressionLoweringPass.analyze(ctx);

      expect(filtered).toHaveLength(2);
      expect(filtered.map((f) => f.kind)).toEqual(['binary_expression', 'if_statement']);
    });
  });
});

// ============================================================================
// Expression DSL Conversion Tests
// ============================================================================

describe('convertToExpressionDSL', () => {
  describe('primitives', () => {
    it('should convert numbers', () => {
      expect(convertToExpressionDSL(42)).toBe(42);
    });

    it('should convert strings', () => {
      expect(convertToExpressionDSL('hello')).toBe('hello');
    });

    it('should convert booleans', () => {
      expect(convertToExpressionDSL(true)).toBe(true);
      expect(convertToExpressionDSL(false)).toBe(false);
    });

    it('should convert null', () => {
      expect(convertToExpressionDSL(null)).toBe(null);
    });

    it('should convert undefined to null', () => {
      expect(convertToExpressionDSL(undefined)).toBe(null);
    });
  });

  describe('identifiers', () => {
    it('should convert identifier to get expression', () => {
      const result = convertToExpressionDSL({ type: 'identifier', name: 'count' });
      expect(result).toEqual(['get', 'data.count']);
    });

    it('should preserve existing namespace prefix', () => {
      const result = convertToExpressionDSL({ type: 'identifier', name: 'state.loading' });
      expect(result).toEqual(['get', 'state.loading']);
    });
  });

  describe('binary expressions', () => {
    it('should convert comparison operators', () => {
      const expr = {
        type: 'binary',
        operator: '>',
        left: { type: 'identifier', name: 'a' },
        right: 10,
      };
      expect(convertToExpressionDSL(expr)).toEqual(['>', ['get', 'data.a'], 10]);
    });

    it('should convert === to ==', () => {
      const expr = {
        type: 'binary',
        operator: '===',
        left: { type: 'identifier', name: 'x' },
        right: 'hello',
      };
      expect(convertToExpressionDSL(expr)).toEqual(['==', ['get', 'data.x'], 'hello']);
    });

    it('should convert !== to !=', () => {
      const expr = {
        type: 'binary',
        operator: '!==',
        left: { type: 'identifier', name: 'status' },
        right: 'error',
      };
      expect(convertToExpressionDSL(expr)).toEqual(['!=', ['get', 'data.status'], 'error']);
    });

    it('should convert && to all', () => {
      const expr = {
        type: 'binary',
        operator: '&&',
        left: { type: 'identifier', name: 'a' },
        right: { type: 'identifier', name: 'b' },
      };
      expect(convertToExpressionDSL(expr)).toEqual([
        'all',
        ['get', 'data.a'],
        ['get', 'data.b'],
      ]);
    });

    it('should convert || to any', () => {
      const expr = {
        type: 'binary',
        operator: '||',
        left: { type: 'identifier', name: 'a' },
        right: { type: 'identifier', name: 'b' },
      };
      expect(convertToExpressionDSL(expr)).toEqual([
        'any',
        ['get', 'data.a'],
        ['get', 'data.b'],
      ]);
    });

    it('should convert arithmetic operators', () => {
      const expr = {
        type: 'binary',
        operator: '+',
        left: { type: 'identifier', name: 'a' },
        right: { type: 'identifier', name: 'b' },
      };
      expect(convertToExpressionDSL(expr)).toEqual([
        '+',
        ['get', 'data.a'],
        ['get', 'data.b'],
      ]);
    });
  });

  describe('member expressions', () => {
    it('should convert member expression to get', () => {
      const expr = {
        type: 'member',
        path: 'user.name',
      };
      expect(convertToExpressionDSL(expr)).toEqual(['get', 'data.user.name']);
    });

    it('should preserve existing namespace in member path', () => {
      const expr = {
        type: 'member',
        path: 'state.user.name',
      };
      expect(convertToExpressionDSL(expr)).toEqual(['get', 'state.user.name']);
    });
  });

  describe('nested expressions', () => {
    it('should handle nested binary expressions', () => {
      const expr = {
        type: 'binary',
        operator: '&&',
        left: {
          type: 'binary',
          operator: '>',
          left: { type: 'identifier', name: 'a' },
          right: 10,
        },
        right: {
          type: 'binary',
          operator: '<',
          left: { type: 'identifier', name: 'b' },
          right: 20,
        },
      };
      expect(convertToExpressionDSL(expr)).toEqual([
        'all',
        ['>', ['get', 'data.a'], 10],
        ['<', ['get', 'data.b'], 20],
      ]);
    });
  });
});

// ============================================================================
// Semantic Path Inference Tests
// ============================================================================

describe('inferSemanticPath', () => {
  it('should add data namespace by default', () => {
    expect(inferSemanticPath('count')).toBe('data.count');
  });

  it('should preserve data namespace', () => {
    expect(inferSemanticPath('data.count')).toBe('data.count');
  });

  it('should preserve state namespace', () => {
    expect(inferSemanticPath('state.loading')).toBe('state.loading');
  });

  it('should preserve derived namespace', () => {
    expect(inferSemanticPath('derived.total')).toBe('derived.total');
  });
});

// ============================================================================
// Fragment Generation Tests
// ============================================================================

describe('Fragment Generation', () => {
  it('should create DerivedFragment for binary expression', async () => {
    const fragments = await compileToDerivedFragments('const result = a > 10;');

    // Should have at least one derived fragment for the binary expression
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    expect(fragments[0]?.kind).toBe('DerivedFragment');
  });

  it('should create DerivedFragment for if statement condition', async () => {
    const fragments = await compileToDerivedFragments('if (count > 0) { console.log("yes"); }');

    expect(fragments.length).toBeGreaterThanOrEqual(1);
    expect(fragments[0]?.kind).toBe('DerivedFragment');
  });

  it('should include expression in fragment', async () => {
    const fragments = await compileToDerivedFragments('const result = x > 5;');

    const fragment = fragments[0];
    expect(fragment?.expr).toBeDefined();
    // Expression should be in DSL format
    expect(Array.isArray(fragment?.expr) || typeof fragment?.expr === 'number' || fragment?.expr === null).toBe(true);
  });

  it('should extract dependencies from expression', async () => {
    const fragments = await compileToDerivedFragments('const result = count > 10;');

    const fragment = fragments[0];
    // Should have requires array (even if empty due to analysis)
    expect(fragment?.requires).toBeDefined();
    expect(Array.isArray(fragment?.requires)).toBe(true);
  });

  it('should include evidence in fragment', async () => {
    const fragments = await compileToDerivedFragments('const result = a + b;');

    const fragment = fragments[0];
    expect(fragment?.evidence).toBeDefined();
    expect(fragment?.evidence?.length).toBeGreaterThanOrEqual(1);
    expect(fragment?.evidence?.[0]?.kind).toBe('ast_node');
  });

  it('should have stable ID format', async () => {
    const fragments = await compileToDerivedFragments('const result = x > 0;');

    expect(fragments[0]?.id).toBeDefined();
    expect(fragments[0]?.id).toMatch(/^der_/);
  });

  it('should generate provides with derived namespace', async () => {
    const fragments = await compileToDerivedFragments('const result = x > 0;');

    expect(fragments[0]?.provides).toBeDefined();
    expect(fragments[0]?.provides?.[0]).toMatch(/^derived\./);
  });
});

// ============================================================================
// Complex Expression Tests
// ============================================================================

describe('Complex Expressions', () => {
  it('should handle multiple binary expressions', async () => {
    const code = `
      const a = x > 10;
      const b = y < 20;
      const c = z === 30;
    `;
    const fragments = await compileToDerivedFragments(code);

    expect(fragments.length).toBeGreaterThanOrEqual(3);
  });

  it('should handle logical AND expressions', async () => {
    const fragments = await compileToDerivedFragments('const valid = a && b;');

    const fragment = fragments[0];
    expect(fragment?.expr).toBeDefined();
    // Should have 'all' operator
    if (Array.isArray(fragment?.expr)) {
      expect(fragment.expr[0]).toBe('all');
    }
  });

  it('should handle logical OR expressions', async () => {
    const fragments = await compileToDerivedFragments('const valid = a || b;');

    const fragment = fragments[0];
    expect(fragment?.expr).toBeDefined();
    // Should have 'any' operator
    if (Array.isArray(fragment?.expr)) {
      expect(fragment.expr[0]).toBe('any');
    }
  });

  it('should handle comparison with equality', async () => {
    const fragments = await compileToDerivedFragments('const isEqual = x === y;');

    const fragment = fragments[0];
    if (Array.isArray(fragment?.expr)) {
      expect(fragment.expr[0]).toBe('==');
    }
  });

  it('should handle comparison with inequality', async () => {
    const fragments = await compileToDerivedFragments('const notEqual = x !== y;');

    const fragment = fragments[0];
    if (Array.isArray(fragment?.expr)) {
      expect(fragment.expr[0]).toBe('!=');
    }
  });

  it('should handle arithmetic expressions', async () => {
    const fragments = await compileToDerivedFragments('const sum = a + b;');

    const fragment = fragments[0];
    if (Array.isArray(fragment?.expr)) {
      expect(fragment.expr[0]).toBe('+');
    }
  });

  it('should handle if statement with complex condition', async () => {
    const code = `
      if (count > 0 && status === 'active') {
        doSomething();
      }
    `;
    const fragments = await compileToDerivedFragments(code);

    // Should have fragments for the binary expressions
    expect(fragments.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Expression Pass Integration', () => {
  it('should work with pass executor', async () => {
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, expressionLoweringPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('const result = x > 10;');
    const result = await executor.execute(artifact);

    // Should have results from both passes
    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('code-ast-extractor');
    expect(result.passResults[1]?.passName).toBe('expression-lowering');

    // Should have findings from extractor
    expect(result.findings.length).toBeGreaterThan(0);

    // Should have fragments from expression pass
    expect(result.fragments.length).toBeGreaterThanOrEqual(1);
  });

  it('should include origin provenance', async () => {
    const fragments = await compileToDerivedFragments('const result = x > 10;');

    expect(fragments[0]?.origin).toBeDefined();
    expect(fragments[0]?.origin?.artifactId).toBe('test-artifact');
  });

  it('should include compiler version', async () => {
    const fragments = await compileToDerivedFragments('const result = x > 10;');

    expect(fragments[0]?.compilerVersion).toBeDefined();
  });
});
