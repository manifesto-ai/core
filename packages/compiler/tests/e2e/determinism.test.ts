/**
 * E2E Determinism Tests
 *
 * Tests that the compiler produces deterministic results:
 * - Linker determinism
 * - Verifier determinism
 * - Full pipeline determinism
 *
 * AGENT_README Invariant #1: Deterministic core
 */

import { describe, it, expect } from 'vitest';
import type { CompileInput } from '../../src/types/artifact.js';
import type { Fragment } from '../../src/types/fragment.js';
import {
  createTestCompiler,
  createCodeArtifact,
  SAMPLE_USER_SCHEMA,
  SAMPLE_COMPLETE_APP,
  getAllPaths,
} from './helpers.js';

// ============================================================================
// Determinism Verification
// ============================================================================

/**
 * Compare two fragment arrays for equality
 */
function fragmentsAreEqual(a: Fragment[], b: Fragment[]): boolean {
  if (a.length !== b.length) return false;

  // Compare paths
  const pathsA = getAllPaths(a).sort();
  const pathsB = getAllPaths(b).sort();

  if (pathsA.length !== pathsB.length) return false;
  for (let i = 0; i < pathsA.length; i++) {
    if (pathsA[i] !== pathsB[i]) return false;
  }

  // Compare fragment kinds
  const kindsA = a.map((f) => f.kind).sort();
  const kindsB = b.map((f) => f.kind).sort();

  if (kindsA.length !== kindsB.length) return false;
  for (let i = 0; i < kindsA.length; i++) {
    if (kindsA[i] !== kindsB[i]) return false;
  }

  return true;
}

// ============================================================================
// Linker Determinism Tests
// ============================================================================

describe('E2E: Linker Determinism', () => {
  it('should produce same link result for same fragments', async () => {
    const compiler = createTestCompiler();

    // Create test fragments by compiling
    const input: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const compiled = await compiler.compile(input);

    // Link the same fragments twice
    const result1 = compiler.link(compiled.fragments);
    const result2 = compiler.link(compiled.fragments);

    // Results should be identical
    expect(result1.conflicts.length).toBe(result2.conflicts.length);
    expect(result1.issues.length).toBe(result2.issues.length);
  });

  it('should produce consistent conflict detection', async () => {
    const compiler = createTestCompiler();

    // Compile two artifacts with same path to produce conflict
    const input: CompileInput = {
      artifacts: [
        createCodeArtifact('const value: number = 1;', 'artifact-1'),
        createCodeArtifact('const value: string = "hello";', 'artifact-2'),
      ],
    };

    const compiled = await compiler.compile(input);

    // Link multiple times
    const result1 = compiler.link(compiled.fragments);
    const result2 = compiler.link(compiled.fragments);
    const result3 = compiler.link(compiled.fragments);

    // Conflict count should be consistent
    expect(result1.conflicts.length).toBe(result2.conflicts.length);
    expect(result2.conflicts.length).toBe(result3.conflicts.length);
  });
});

// ============================================================================
// Verifier Determinism Tests
// ============================================================================

describe('E2E: Verifier Determinism', () => {
  it('should produce same verification result for same input', async () => {
    const compiler = createTestCompiler();

    const input: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const compiled = await compiler.compile(input);
    const linkResult = compiler.link(compiled.fragments);

    const verify1 = compiler.verify(linkResult);
    const verify2 = compiler.verify(linkResult);

    expect(verify1.valid).toBe(verify2.valid);
    expect(verify1.issues.length).toBe(verify2.issues.length);
  });

  it('should detect same issues consistently', async () => {
    const compiler = createTestCompiler();

    // Compile some code
    const input: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const compiled = await compiler.compile(input);
    const linkResult = compiler.link(compiled.fragments);

    const verify1 = compiler.verify(linkResult);
    const verify2 = compiler.verify(linkResult);
    const verify3 = compiler.verify(linkResult);

    // Issue codes should be consistent
    const codes1 = verify1.issues.map((i) => i.code).sort();
    const codes2 = verify2.issues.map((i) => i.code).sort();
    const codes3 = verify3.issues.map((i) => i.code).sort();

    expect(codes1).toEqual(codes2);
    expect(codes2).toEqual(codes3);
  });
});

// ============================================================================
// Full Pipeline Determinism Tests
// ============================================================================

describe('E2E: Full Pipeline Determinism', () => {
  it('should produce same result for same input code', async () => {
    const code = SAMPLE_USER_SCHEMA;

    const compiler1 = createTestCompiler();
    const compiler2 = createTestCompiler();

    const input: CompileInput = {
      artifacts: [createCodeArtifact(code)],
    };

    const result1 = await compiler1.compile(input);
    const result2 = await compiler2.compile(input);

    // Fragment count should be identical
    expect(result1.fragments.length).toBe(result2.fragments.length);

    // Issue count should be identical
    expect(result1.issues.length).toBe(result2.issues.length);

    // Conflict count should be identical
    expect(result1.conflicts.length).toBe(result2.conflicts.length);
  });

  it('should produce same paths for same input', async () => {
    const code = 'const userName: string = "John";';

    const input: CompileInput = {
      artifacts: [createCodeArtifact(code)],
    };

    const compiler1 = createTestCompiler();
    const compiler2 = createTestCompiler();

    const result1 = await compiler1.compile(input);
    const result2 = await compiler2.compile(input);

    const paths1 = getAllPaths(result1.fragments).sort();
    const paths2 = getAllPaths(result2.fragments).sort();

    expect(paths1).toEqual(paths2);
  });

  it('should produce same result regardless of compilation order', async () => {
    const codeA = 'const a: number = 1;';
    const codeB = 'const b: number = 2;';

    const compiler = createTestCompiler();

    // Compile A then B
    const inputAB: CompileInput = {
      artifacts: [
        createCodeArtifact(codeA, 'artifact-a'),
        createCodeArtifact(codeB, 'artifact-b'),
      ],
    };

    // Compile B then A (different order)
    const inputBA: CompileInput = {
      artifacts: [
        createCodeArtifact(codeB, 'artifact-b'),
        createCodeArtifact(codeA, 'artifact-a'),
      ],
    };

    const resultAB = await compiler.compile(inputAB);
    const resultBA = await compiler.compile(inputBA);

    // Results should be equivalent (same paths)
    const pathsAB = getAllPaths(resultAB.fragments).sort();
    const pathsBA = getAllPaths(resultBA.fragments).sort();

    expect(pathsAB).toEqual(pathsBA);
  });

  it('should produce deterministic results for complex input', async () => {
    const input: CompileInput = {
      artifacts: [createCodeArtifact(SAMPLE_COMPLETE_APP)],
    };

    const compiler1 = createTestCompiler();
    const compiler2 = createTestCompiler();
    const compiler3 = createTestCompiler();

    const result1 = await compiler1.compile(input);
    const result2 = await compiler2.compile(input);
    const result3 = await compiler3.compile(input);

    // All three should produce identical results
    expect(fragmentsAreEqual(result1.fragments, result2.fragments)).toBe(true);
    expect(fragmentsAreEqual(result2.fragments, result3.fragments)).toBe(true);
  });

  it('should produce stable fragment IDs', async () => {
    const code = 'const value: number = 42;';

    const input: CompileInput = {
      artifacts: [createCodeArtifact(code, 'stable-artifact')],
    };

    const compiler1 = createTestCompiler();
    const compiler2 = createTestCompiler();

    const result1 = await compiler1.compile(input);
    const result2 = await compiler2.compile(input);

    // Fragment IDs should be stable (same for same input)
    const ids1 = result1.fragments.map((f) => f.id).sort();
    const ids2 = result2.fragments.map((f) => f.id).sort();

    expect(ids1).toEqual(ids2);
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe('E2E: Compilation Idempotency', () => {
  it('should produce same result when compiling twice', async () => {
    const compiler = createTestCompiler();

    const input: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const result1 = await compiler.compile(input);
    const result2 = await compiler.compile(input);

    expect(result1.fragments.length).toBe(result2.fragments.length);
    expect(result1.issues.length).toBe(result2.issues.length);
  });

  it('should produce same result when linking twice', async () => {
    const compiler = createTestCompiler();

    const input: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const compiled = await compiler.compile(input);

    const result1 = compiler.link(compiled.fragments);
    const result2 = compiler.link(result1.fragments);

    // Linking already-linked fragments should produce same result
    expect(result1.fragments.length).toBe(result2.fragments.length);
  });
});
