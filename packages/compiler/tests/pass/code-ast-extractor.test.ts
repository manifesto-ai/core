/**
 * Code AST Extractor Pass Tests
 *
 * SWC 기반 AST 추출 Pass의 정확성을 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import { codeAstExtractorPass } from '../../src/pass/code-ast-extractor.js';
import { createPassContext, type Finding } from '../../src/pass/base.js';
import type { CodeArtifact } from '../../src/types/artifact.js';

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

function extractFindings(content: string, language: 'js' | 'ts' = 'ts'): Finding[] {
  const artifact = createCodeArtifact(content, language);
  const ctx = createPassContext(artifact);
  return codeAstExtractorPass.analyze(ctx);
}

function findByKind(findings: Finding[], kind: string): Finding | undefined {
  return findings.find((f) => f.kind === kind);
}

function findAllByKind(findings: Finding[], kind: string): Finding[] {
  return findings.filter((f) => f.kind === kind);
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('CodeAstExtractorPass', () => {
  describe('supports', () => {
    it('should support code artifacts', () => {
      const artifact = createCodeArtifact('const x = 1;');
      expect(codeAstExtractorPass.supports(artifact)).toBe(true);
    });

    it('should not support text artifacts', () => {
      const artifact = { id: 'test', kind: 'text' as const, content: 'hello' };
      expect(codeAstExtractorPass.supports(artifact)).toBe(false);
    });

    it('should not support manifesto artifacts', () => {
      const artifact = { id: 'test', kind: 'manifesto' as const, content: {} };
      expect(codeAstExtractorPass.supports(artifact)).toBe(false);
    });
  });

  describe('compile', () => {
    it('should return empty array (extractor only)', () => {
      const artifact = createCodeArtifact('const x = 1;');
      const ctx = createPassContext(artifact);
      const findings = codeAstExtractorPass.analyze(ctx);
      expect(codeAstExtractorPass.compile(findings, ctx)).toEqual([]);
    });
  });
});

// ============================================================================
// Variable Declaration Tests
// ============================================================================

describe('Variable Declaration Extraction', () => {
  it('should extract const declaration', () => {
    const findings = extractFindings('const x = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'variable_declaration',
      name: 'x',
      varKind: 'const',
      initialValue: 10,
    });
  });

  it('should extract let declaration', () => {
    const findings = extractFindings('let y = "hello";');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'variable_declaration',
      name: 'y',
      varKind: 'let',
      initialValue: 'hello',
    });
  });

  it('should extract var declaration', () => {
    const findings = extractFindings('var z = true;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'variable_declaration',
      name: 'z',
      varKind: 'var',
      initialValue: true,
    });
  });

  it('should extract TypeScript type annotation', () => {
    const findings = extractFindings('const x: number = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'variable_declaration',
      name: 'x',
      varKind: 'const',
      typeAnnotation: 'number',
    });
  });

  it('should extract multiple declarations', () => {
    const findings = extractFindings('const a = 1; const b = 2; const c = 3;');
    const varFindings = findAllByKind(findings, 'variable_declaration');

    expect(varFindings).toHaveLength(3);
    expect(varFindings.map((f) => (f.data as { name: string }).name)).toEqual(['a', 'b', 'c']);
  });

  it('should include source code in finding', () => {
    const findings = extractFindings('const x = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { sourceCode: string }).sourceCode).toBe('const x = 10;');
  });

  it('should extract null initializer', () => {
    const findings = extractFindings('const x = null;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { initialValue: unknown }).initialValue).toBe(null);
  });
});

// ============================================================================
// Function Declaration Tests
// ============================================================================

describe('Function Declaration Extraction', () => {
  it('should extract simple function', () => {
    const findings = extractFindings('function greet() {}');
    const finding = findByKind(findings, 'function_declaration');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'function_declaration',
      name: 'greet',
      params: [],
      isAsync: false,
    });
  });

  it('should extract function with parameters', () => {
    const findings = extractFindings('function add(a, b) { return a + b; }');
    const finding = findByKind(findings, 'function_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { params: Array<{ name: string }> }).params).toEqual([
      { name: 'a', type: undefined },
      { name: 'b', type: undefined },
    ]);
  });

  it('should extract typed parameters', () => {
    const findings = extractFindings('function add(a: number, b: number): number { return a + b; }');
    const finding = findByKind(findings, 'function_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { params: Array<{ name: string; type?: string }> }).params).toEqual([
      { name: 'a', type: 'number' },
      { name: 'b', type: 'number' },
    ]);
    expect((finding!.data as { returnType?: string }).returnType).toBe('number');
  });

  it('should extract async function', () => {
    const findings = extractFindings('async function fetchData() {}');
    const finding = findByKind(findings, 'function_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { isAsync: boolean }).isAsync).toBe(true);
  });
});

// ============================================================================
// Function Call Tests
// ============================================================================

describe('Function Call Extraction', () => {
  it('should extract simple function call', () => {
    const findings = extractFindings('doSomething();');
    const finding = findByKind(findings, 'function_call');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'function_call',
      callee: 'doSomething',
      arguments: [],
    });
  });

  it('should extract function call with arguments', () => {
    const findings = extractFindings('add(1, 2);');
    const finding = findByKind(findings, 'function_call');

    expect(finding).toBeDefined();
    expect((finding!.data as { arguments: unknown[] }).arguments).toEqual([1, 2]);
  });

  it('should extract method call', () => {
    const findings = extractFindings('console.log("hello");');
    const finding = findByKind(findings, 'function_call');

    expect(finding).toBeDefined();
    expect((finding!.data as { callee: string }).callee).toBe('console.log');
  });

  it('should extract chained method call', () => {
    const findings = extractFindings('obj.foo.bar();');
    const finding = findByKind(findings, 'function_call');

    expect(finding).toBeDefined();
    expect((finding!.data as { callee: string }).callee).toBe('obj.foo.bar');
  });
});

// ============================================================================
// Assignment Tests
// ============================================================================

describe('Assignment Extraction', () => {
  it('should extract simple assignment', () => {
    const findings = extractFindings('x = 10;');
    const finding = findByKind(findings, 'assignment');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'assignment',
      target: 'x',
      operator: '=',
      value: 10,
    });
  });

  it('should extract compound assignment', () => {
    const findings = extractFindings('x += 5;');
    const finding = findByKind(findings, 'assignment');

    expect(finding).toBeDefined();
    expect(finding!.data).toMatchObject({
      kind: 'assignment',
      target: 'x',
      operator: '+=',
    });
  });

  it('should extract member assignment', () => {
    const findings = extractFindings('obj.value = 10;');
    const finding = findByKind(findings, 'assignment');

    expect(finding).toBeDefined();
    expect((finding!.data as { target: string }).target).toBe('obj.value');
  });
});

// ============================================================================
// If Statement Tests
// ============================================================================

describe('If Statement Extraction', () => {
  it('should extract simple if statement', () => {
    const findings = extractFindings('if (x > 10) {}');
    const finding = findByKind(findings, 'if_statement');

    expect(finding).toBeDefined();
    expect(finding!.kind).toBe('if_statement');
  });

  it('should extract if-else statement', () => {
    const findings = extractFindings('if (x) { a = 1; } else { a = 2; }');
    const finding = findByKind(findings, 'if_statement');

    expect(finding).toBeDefined();
    expect((finding!.data as { alternateFindings?: string[] }).alternateFindings).toEqual([]);
  });

  it('should extract condition as expression', () => {
    const findings = extractFindings('if (a > b) {}');
    const finding = findByKind(findings, 'if_statement');

    expect(finding).toBeDefined();
    expect((finding!.data as { condition: unknown }).condition).toMatchObject({
      type: 'binary',
      operator: '>',
    });
  });
});

// ============================================================================
// Binary Expression Tests
// ============================================================================

describe('Binary Expression Extraction', () => {
  it('should extract comparison expression', () => {
    const findings = extractFindings('const result = a > b;');
    const binFindings = findAllByKind(findings, 'binary_expression');

    expect(binFindings.length).toBeGreaterThan(0);
    const finding = binFindings[0];
    expect(finding!.data).toMatchObject({
      kind: 'binary_expression',
      operator: '>',
    });
  });

  it('should extract arithmetic expression', () => {
    const findings = extractFindings('const sum = a + b;');
    const binFindings = findAllByKind(findings, 'binary_expression');

    expect(binFindings.length).toBeGreaterThan(0);
    const finding = binFindings[0];
    expect((finding!.data as { operator: string }).operator).toBe('+');
  });

  it('should extract logical expression', () => {
    const findings = extractFindings('const valid = a && b;');
    const binFindings = findAllByKind(findings, 'binary_expression');

    expect(binFindings.length).toBeGreaterThan(0);
    const finding = binFindings[0];
    expect((finding!.data as { operator: string }).operator).toBe('&&');
  });

  it('should not double-count nested binary expressions', () => {
    // a > b && c < d should produce 1 top-level binary expression (&&)
    // not 3 (>, &&, <)
    const findings = extractFindings('const result = a > b && c < d;');
    const binFindings = findAllByKind(findings, 'binary_expression');

    // Only the top-level && should be extracted
    expect(binFindings).toHaveLength(1);
    expect((binFindings[0]!.data as { operator: string }).operator).toBe('&&');
  });
});

// ============================================================================
// Selection Filtering Tests
// ============================================================================

describe('Selection Filtering', () => {
  it('should filter by line selection', () => {
    const code = `const a = 1;
const b = 2;
const c = 3;`;
    const artifact = createCodeArtifact(code);
    const ctx = createPassContext(artifact, {
      selection: { startLine: 2, endLine: 2 },
    });
    const findings = codeAstExtractorPass.analyze(ctx);
    const varFindings = findAllByKind(findings, 'variable_declaration');

    expect(varFindings).toHaveLength(1);
    expect((varFindings[0]!.data as { name: string }).name).toBe('b');
  });

  it('should filter by offset selection', () => {
    const code = 'const a = 1; const b = 2;';
    const artifact = createCodeArtifact(code);
    // 'const b = 2;' starts at offset 13
    const ctx = createPassContext(artifact, {
      selection: { startOffset: 13, endOffset: 25 },
    });
    const findings = codeAstExtractorPass.analyze(ctx);
    const varFindings = findAllByKind(findings, 'variable_declaration');

    expect(varFindings).toHaveLength(1);
    expect((varFindings[0]!.data as { name: string }).name).toBe('b');
  });

  it('should return all findings when no selection', () => {
    const code = 'const a = 1; const b = 2;';
    const findings = extractFindings(code);
    const varFindings = findAllByKind(findings, 'variable_declaration');

    expect(varFindings).toHaveLength(2);
  });
});

// ============================================================================
// Provenance Tests
// ============================================================================

describe('Provenance', () => {
  it('should include artifact ID in provenance', () => {
    const findings = extractFindings('const x = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.provenance.artifactId).toBe('test-artifact');
  });

  it('should include location in provenance', () => {
    const findings = extractFindings('const x = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.provenance.location.kind).toBe('code');
  });

  it('should include AST node info', () => {
    const findings = extractFindings('const x = 10;');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect(finding!.astNode).toMatchObject({
      type: 'VariableDeclaration',
    });
    expect(finding!.astNode!.span).toBeDefined();
  });
});

// ============================================================================
// JavaScript Support Tests
// ============================================================================

describe('JavaScript Support', () => {
  it('should parse JavaScript code', () => {
    const findings = extractFindings('const x = 10;', 'js');
    const finding = findByKind(findings, 'variable_declaration');

    expect(finding).toBeDefined();
    expect((finding!.data as { name: string }).name).toBe('x');
  });

  it('should handle JSX in JavaScript', () => {
    // Just verify it doesn't crash - JSX extraction is not the focus
    const code = 'const el = <div>Hello</div>;';
    expect(() => extractFindings(code, 'js')).not.toThrow();
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe('Error Handling', () => {
  it('should handle syntax errors gracefully', () => {
    const code = 'const x = ;'; // Syntax error
    const findings = extractFindings(code);

    // Should return empty array, not throw
    expect(findings).toEqual([]);
  });

  it('should handle JSON artifacts (returns empty)', () => {
    const artifact: CodeArtifact = {
      id: 'test',
      kind: 'code',
      language: 'json',
      content: '{"key": "value"}',
    };
    const ctx = createPassContext(artifact);
    const findings = codeAstExtractorPass.analyze(ctx);

    expect(findings).toEqual([]);
  });
});

// ============================================================================
// Complex Code Tests
// ============================================================================

describe('Complex Code', () => {
  it('should extract from real-world code', () => {
    const code = `
const API_URL = "https://api.example.com";
let counter = 0;

async function fetchData(id: number): Promise<void> {
  const response = await fetch(API_URL);
  if (response.ok) {
    counter += 1;
  }
}
`;
    const findings = extractFindings(code);

    // Should have variable declarations
    const vars = findAllByKind(findings, 'variable_declaration');
    expect(vars.length).toBeGreaterThanOrEqual(2);

    // Should have function declaration
    const funcs = findAllByKind(findings, 'function_declaration');
    expect(funcs).toHaveLength(1);
    expect((funcs[0]!.data as { name: string }).name).toBe('fetchData');
    expect((funcs[0]!.data as { isAsync: boolean }).isAsync).toBe(true);

    // Should have function calls
    const calls = findAllByKind(findings, 'function_call');
    expect(calls.length).toBeGreaterThanOrEqual(1);

    // Should have if statement
    const ifs = findAllByKind(findings, 'if_statement');
    expect(ifs).toHaveLength(1);

    // Should have assignments (counter += 1)
    const assigns = findAllByKind(findings, 'assignment');
    expect(assigns).toHaveLength(1);
    expect((assigns[0]!.data as { operator: string }).operator).toBe('+=');
  });
});
