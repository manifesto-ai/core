/**
 * Schema Pass Tests
 *
 * Schema Pass가 variable_declaration Finding을 올바르게
 * SchemaFragment로 변환하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  schemaPass,
  codeAstExtractorPass,
  determineSchemaFieldType,
  createPassRegistry,
  createPassExecutor,
} from '../../src/pass/index.js';
import { createPassContext, type Finding } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';
import type { SchemaFragment } from '../../src/types/fragment.js';

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

async function compileToSchemaFragments(content: string): Promise<SchemaFragment[]> {
  const registry = createPassRegistry();
  registry.registerAll([codeAstExtractorPass, schemaPass]);

  const executor = createPassExecutor(registry);
  const artifact = createCodeArtifact(content);
  const result = await executor.execute(artifact);

  return result.fragments.filter(
    (f): f is SchemaFragment => f.kind === 'SchemaFragment'
  );
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('SchemaPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('const x = 1;');
      expect(schemaPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(schemaPass.supports(artifact)).toBe(false);
    });
  });

  describe('analyze', () => {
    it('should filter variable_declaration findings', () => {
      const artifact = createCodeArtifact('const x = 1;');
      const mockFindings: Finding[] = [
        {
          id: 'f1',
          kind: 'variable_declaration',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'variable_declaration', name: 'x', varKind: 'const', sourceCode: 'const x = 1;' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
        {
          id: 'f2',
          kind: 'function_call',
          passName: 'test',
          artifactId: artifact.id,
          data: { kind: 'function_call', callee: 'foo', arguments: [], sourceCode: 'foo()' },
          provenance: { artifactId: artifact.id, location: { kind: 'generated', note: 'test' } },
        },
      ];

      const ctx = createPassContext(artifact, { previousFindings: mockFindings });
      const filtered = schemaPass.analyze(ctx);

      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.kind).toBe('variable_declaration');
    });
  });
});

// ============================================================================
// Schema Generation Tests
// ============================================================================

describe('Schema Generation', () => {
  it('should create SchemaFragment for const declaration', async () => {
    const fragments = await compileToSchemaFragments('const count = 10;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.kind).toBe('SchemaFragment');
    expect(fragments[0]?.namespace).toBe('data');
    expect(fragments[0]?.provides).toContain('data.count');
  });

  it('should infer number type from literal', async () => {
    const fragments = await compileToSchemaFragments('const count = 42;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.fields[0]?.type).toBe('number');
  });

  it('should infer string type from literal', async () => {
    const fragments = await compileToSchemaFragments('const name = "hello";');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.fields[0]?.type).toBe('string');
  });

  it('should infer boolean type from literal', async () => {
    const fragments = await compileToSchemaFragments('const active = true;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.fields[0]?.type).toBe('boolean');
  });

  it('should use TypeScript type annotation', async () => {
    const fragments = await compileToSchemaFragments('const count: number = 10;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.fields[0]?.type).toBe('number');
  });

  it('should handle null literal', async () => {
    const fragments = await compileToSchemaFragments('const empty = null;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.fields[0]?.type).toBe('null');
  });

  it('should create multiple fragments for multiple declarations', async () => {
    const fragments = await compileToSchemaFragments(`
      const a = 1;
      const b = "hello";
      const c = true;
    `);

    expect(fragments).toHaveLength(3);
    expect(fragments.map((f) => f.provides[0])).toEqual(['data.a', 'data.b', 'data.c']);
  });
});

// ============================================================================
// Namespace Detection Tests
// ============================================================================

describe('Namespace Detection', () => {
  it('should use data namespace by default', async () => {
    const fragments = await compileToSchemaFragments('const count = 10;');

    expect(fragments[0]?.namespace).toBe('data');
    expect(fragments[0]?.provides[0]).toBe('data.count');
  });

  it('should detect state namespace from useState pattern', async () => {
    const fragments = await compileToSchemaFragments(
      'const count = useState(0);'
    );

    expect(fragments[0]?.namespace).toBe('state');
    expect(fragments[0]?.provides[0]).toBe('state.count');
  });

  it('should detect state namespace from name prefix', async () => {
    const fragments = await compileToSchemaFragments('const stateCount = 10;');

    expect(fragments[0]?.namespace).toBe('state');
    expect(fragments[0]?.provides[0]).toBe('state.stateCount');
  });

  it('should skip derived prefix variables (handled by Expression Pass)', async () => {
    const fragments = await compileToSchemaFragments('const derivedTotal = 100;');

    // derived* variables should not create SchemaFragments
    expect(fragments).toHaveLength(0);
  });

  it('should skip computed prefix variables (handled by Expression Pass)', async () => {
    const fragments = await compileToSchemaFragments('const computedSum = 50;');

    // computed* variables should not create SchemaFragments
    expect(fragments).toHaveLength(0);
  });
});

// ============================================================================
// Type Mapping Tests
// ============================================================================

describe('Type Mapping', () => {
  describe('determineSchemaFieldType', () => {
    it('should map number type annotation', () => {
      expect(determineSchemaFieldType('number', undefined)).toBe('number');
    });

    it('should map string type annotation', () => {
      expect(determineSchemaFieldType('string', undefined)).toBe('string');
    });

    it('should map boolean type annotation', () => {
      expect(determineSchemaFieldType('boolean', undefined)).toBe('boolean');
    });

    it('should map object type annotation', () => {
      expect(determineSchemaFieldType('object', undefined)).toBe('object');
    });

    it('should map array type annotation', () => {
      expect(determineSchemaFieldType('Array<number>', undefined)).toBe('array');
      expect(determineSchemaFieldType('number[]', undefined)).toBe('array');
    });

    it('should infer type from value when no annotation', () => {
      expect(determineSchemaFieldType(undefined, 42)).toBe('number');
      expect(determineSchemaFieldType(undefined, 'hello')).toBe('string');
      expect(determineSchemaFieldType(undefined, true)).toBe('boolean');
      expect(determineSchemaFieldType(undefined, null)).toBe('null');
      expect(determineSchemaFieldType(undefined, [1, 2, 3])).toBe('array');
      expect(determineSchemaFieldType(undefined, { a: 1 })).toBe('object');
    });

    it('should prefer type annotation over value', () => {
      expect(determineSchemaFieldType('string', 42)).toBe('string');
    });

    it('should handle union types', () => {
      expect(determineSchemaFieldType('string | null', undefined)).toBe('string');
    });

    it('should return unknown for unknown types', () => {
      expect(determineSchemaFieldType(undefined, undefined)).toBe('unknown');
      expect(determineSchemaFieldType('SomeCustomType', undefined)).toBe('unknown');
    });
  });
});

// ============================================================================
// Fragment Structure Tests
// ============================================================================

describe('Fragment Structure', () => {
  it('should include origin provenance', async () => {
    const fragments = await compileToSchemaFragments('const x = 10;');

    expect(fragments[0]?.origin).toBeDefined();
    expect(fragments[0]?.origin.artifactId).toBe('test-artifact');
  });

  it('should include evidence', async () => {
    const fragments = await compileToSchemaFragments('const x = 10;');

    expect(fragments[0]?.evidence).toHaveLength(1);
    expect(fragments[0]?.evidence[0]?.kind).toBe('ast_node');
    expect(fragments[0]?.evidence[0]?.excerpt).toContain('const x');
  });

  it('should include default value', async () => {
    const fragments = await compileToSchemaFragments('const count = 42;');

    expect(fragments[0]?.fields[0]?.defaultValue).toBe(42);
  });

  it('should include compiler version', async () => {
    const fragments = await compileToSchemaFragments('const x = 10;');

    expect(fragments[0]?.compilerVersion).toBeDefined();
  });

  it('should have stable ID', async () => {
    const fragments = await compileToSchemaFragments('const x = 10;');

    expect(fragments[0]?.id).toBeDefined();
    expect(fragments[0]?.id).toMatch(/^sch_/);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Schema Pass Integration', () => {
  it('should work with let declarations', async () => {
    const fragments = await compileToSchemaFragments('let count = 0;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.provides[0]).toBe('data.count');
  });

  it('should work with var declarations', async () => {
    const fragments = await compileToSchemaFragments('var count = 0;');

    expect(fragments).toHaveLength(1);
    expect(fragments[0]?.provides[0]).toBe('data.count');
  });

  it('should handle complex code', async () => {
    const code = `
      const API_URL = "https://api.example.com";
      let counter = 0;
      const stateLoading = false;
      const derivedTotal = 100;
    `;
    const fragments = await compileToSchemaFragments(code);

    // derivedTotal should be skipped (handled by Expression Pass)
    expect(fragments).toHaveLength(3);

    // Check namespaces
    const apiFragment = fragments.find((f) => f.provides[0] === 'data.API_URL');
    const counterFragment = fragments.find((f) => f.provides[0] === 'data.counter');
    const loadingFragment = fragments.find((f) => f.provides[0] === 'state.stateLoading');

    expect(apiFragment).toBeDefined();
    expect(counterFragment).toBeDefined();
    expect(loadingFragment).toBeDefined();

    // Check types
    expect(apiFragment?.fields[0]?.type).toBe('string');
    expect(counterFragment?.fields[0]?.type).toBe('number');
    expect(loadingFragment?.fields[0]?.type).toBe('boolean');
  });

  it('should pass results through executor correctly', async () => {
    const registry = createPassRegistry();
    registry.registerAll([codeAstExtractorPass, schemaPass]);

    const executor = createPassExecutor(registry);
    const artifact = createCodeArtifact('const x = 10;');
    const result = await executor.execute(artifact);

    // Should have results from both passes
    expect(result.passResults).toHaveLength(2);
    expect(result.passResults[0]?.passName).toBe('code-ast-extractor');
    expect(result.passResults[1]?.passName).toBe('schema-pass');

    // Should have findings from extractor
    expect(result.findings.length).toBeGreaterThan(0);

    // Should have fragments from schema pass
    expect(result.fragments).toHaveLength(1);
  });
});
