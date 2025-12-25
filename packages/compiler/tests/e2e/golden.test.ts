/**
 * Golden/Snapshot Tests
 *
 * TRD 1.11 (A) Golden/Snapshot 테스트 - 최우선 요구사항
 *
 * 목적:
 * - compile() 결과의 결정론적 출력 보장
 * - fragments/issues/conflicts/domain 구조 스냅샷 고정
 * - sortFragments/sortResults 옵션별 순서 안정성 검증
 *
 * 주의:
 * - Fragment ID는 랜덤 요소 포함, 정규화 필요
 * - 타임스탬프는 정규화 필요
 * - 결과를 정렬해서 결정론적으로 비교
 */

import { describe, it, expect } from 'vitest';
import type { Fragment } from '../../src/types/fragment.js';
import type { Issue } from '../../src/types/issue.js';
import type { Conflict } from '../../src/types/conflict.js';
import type { CompileInput, CompileResult } from '../../src/types/artifact.js';
import {
  createTestCompiler,
  createCodeArtifact,
  SAMPLE_USER_SCHEMA,
  SAMPLE_STATE_CODE,
  SAMPLE_COMPLETE_APP,
} from './helpers.js';

// ============================================================================
// Normalization Helpers (for deterministic snapshots)
// ============================================================================

/**
 * Normalize fragment for snapshot comparison
 * - Remove random IDs and timestamps
 * - Keep structural information
 */
function normalizeFragment(fragment: Fragment): Record<string, unknown> {
  return {
    kind: fragment.kind,
    provides: [...fragment.provides].sort(),
    requires: [...fragment.requires].sort(),
    tags: fragment.tags ? [...fragment.tags].sort() : [],
    // Fragment-specific fields based on kind
    ...(fragment.kind === 'SchemaFragment' && {
      namespace: (fragment as { namespace?: string }).namespace,
      fields: ((fragment as { fields?: Array<{ path: string; type: string }> }).fields || [])
        .map((f) => ({ path: f.path, type: f.type }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    }),
    ...(fragment.kind === 'SourceFragment' && {
      path: (fragment as { path?: string }).path,
    }),
    ...(fragment.kind === 'DerivedFragment' && {
      path: (fragment as { path?: string }).path,
      deps: ((fragment as { deps?: string[] }).deps || []).sort(),
    }),
    ...(fragment.kind === 'ActionFragment' && {
      actionId: (fragment as { actionId?: string }).actionId,
    }),
    ...(fragment.kind === 'EffectFragment' && {
      effect: (fragment as { effect?: { _tag: string } }).effect?._tag,
      risk: (fragment as { risk?: string }).risk,
    }),
    ...(fragment.kind === 'PolicyFragment' && {
      policyType: (fragment as { policyType?: string }).policyType,
    }),
  };
}

/**
 * Normalize issue for snapshot comparison
 */
function normalizeIssue(issue: Issue): Record<string, unknown> {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    path: issue.path,
    // Exclude random IDs
  };
}

/**
 * Normalize conflict for snapshot comparison
 */
function normalizeConflict(conflict: Conflict): Record<string, unknown> {
  return {
    type: conflict.type,
    target: conflict.target,
    candidateCount: conflict.candidates.length,
    message: conflict.message,
  };
}

/**
 * Normalize compile result for snapshot comparison
 */
function normalizeCompileResult(result: CompileResult): Record<string, unknown> {
  // Sort fragments by kind, then by provides (first element)
  const sortedFragments = [...result.fragments].sort((a, b) => {
    const kindCompare = a.kind.localeCompare(b.kind);
    if (kindCompare !== 0) return kindCompare;
    const aProvides = a.provides[0] || '';
    const bProvides = b.provides[0] || '';
    return aProvides.localeCompare(bProvides);
  });

  // Sort issues by code, then by path
  const sortedIssues = [...result.issues].sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return (a.path || '').localeCompare(b.path || '');
  });

  // Sort conflicts by type, then by target
  const sortedConflicts = [...result.conflicts].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) return typeCompare;
    return a.target.localeCompare(b.target);
  });

  return {
    fragmentCount: result.fragments.length,
    fragments: sortedFragments.map(normalizeFragment),
    issueCount: result.issues.length,
    issues: sortedIssues.map(normalizeIssue),
    conflictCount: result.conflicts.length,
    conflicts: sortedConflicts.map(normalizeConflict),
    // Domain draft summary
    domainDraft: result.domainDraft
      ? {
          hasDataSchema: Object.keys(result.domainDraft.dataSchema || {}).length > 0,
          hasStateSchema: Object.keys(result.domainDraft.stateSchema || {}).length > 0,
          derivedCount: Object.keys(result.domainDraft.derived || {}).length,
          actionCount: Object.keys(result.domainDraft.actions || {}).length,
        }
      : null,
  };
}

// ============================================================================
// Golden Tests - Simple Code
// ============================================================================

describe('Golden: Simple Code Compilation', () => {
  it('should produce stable output for simple variable declaration', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact('const count: number = 42;', 'simple-var')],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });

  it('should produce stable output for multiple variables', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact(
          `const x: number = 1;
const y: number = 2;
const z: string = "hello";`,
          'multi-var'
        ),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });

  it('should produce stable output for boolean expression', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact(
          `const isActive: boolean = true;
const isValid = x > 0 && y < 100;`,
          'bool-expr'
        ),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - Interface Schema
// ============================================================================

describe('Golden: Interface Schema Compilation', () => {
  it('should produce stable output for User interface', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(SAMPLE_USER_SCHEMA, 'user-schema')],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });

  it('should produce stable output for nested interface', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact(
          `interface Address {
  street: string;
  city: string;
  country: string;
}

interface Person {
  name: string;
  address: Address;
}`,
          'nested-interface'
        ),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - State Management
// ============================================================================

describe('Golden: State Management Compilation', () => {
  it('should produce stable output for state code', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(SAMPLE_STATE_CODE, 'state-code')],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - Complete Application
// ============================================================================

describe('Golden: Complete Application Compilation', () => {
  it('should produce stable output for complete app', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(SAMPLE_COMPLETE_APP, 'complete-app')],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - Determinism Verification
// ============================================================================

describe('Golden: Determinism Verification', () => {
  it('should produce identical results across 3 compilations', async () => {
    const code = `
interface Product {
  id: string;
  name: string;
  price: number;
}

const products: Product[] = [];
const totalPrice = products.reduce((sum, p) => sum + p.price, 0);

function addProduct(product: Product) {
  products.push(product);
}
`;

    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      const compiler = createTestCompiler();
      const input: CompileInput = {
        artifacts: [createCodeArtifact(code, 'determinism-test')],
      };

      const result = await compiler.compile(input);
      const normalized = normalizeCompileResult(result);
      results.push(JSON.stringify(normalized, null, 2));
    }

    // All 3 results should be identical
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);
  });

  it('should produce identical results with different compiler instances', async () => {
    const code = 'const x: number = 42;';

    const compiler1 = createTestCompiler();
    const compiler2 = createTestCompiler();

    const input: CompileInput = {
      artifacts: [createCodeArtifact(code, 'instance-test')],
    };

    const result1 = await compiler1.compile(input);
    const result2 = await compiler2.compile(input);

    const normalized1 = normalizeCompileResult(result1);
    const normalized2 = normalizeCompileResult(result2);

    expect(normalized1).toEqual(normalized2);
  });
});

// ============================================================================
// Golden Tests - Sort Options
// ============================================================================

describe('Golden: Sort Options Stability', () => {
  it('should produce stable sorted fragments', async () => {
    const compiler = createTestCompiler({
      linker: {
        sortFragments: true,
        sortResults: true,
      },
    });

    const input: CompileInput = {
      artifacts: [
        createCodeArtifact(
          `const z: number = 3;
const a: number = 1;
const m: number = 2;`,
          'sort-test'
        ),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - Multi-Artifact
// ============================================================================

describe('Golden: Multi-Artifact Compilation', () => {
  it('should produce stable output for multiple artifacts', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact('const a: number = 1;', 'artifact-a'),
        createCodeArtifact('const b: number = 2;', 'artifact-b'),
        createCodeArtifact('const c: number = 3;', 'artifact-c'),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});

// ============================================================================
// Golden Tests - Edge Cases
// ============================================================================

describe('Golden: Edge Cases', () => {
  it('should produce stable output for empty input', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });

  it('should produce stable output for empty code', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact('', 'empty-code')],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });

  it('should produce stable output for comments only', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact(
          `// This is a comment
/* Multi-line
   comment */`,
          'comments-only'
        ),
      ],
    };

    const result = await compiler.compile(input);
    const normalized = normalizeCompileResult(result);

    expect(normalized).toMatchSnapshot();
  });
});
