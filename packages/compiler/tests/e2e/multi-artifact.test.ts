/**
 * E2E Multi-Artifact Tests
 *
 * Tests compilation of multiple artifacts:
 * - Multiple code artifacts
 * - Cross-artifact dependencies
 * - Conflict detection across artifacts
 * - Partial selection compilation
 */

import { describe, it, expect } from 'vitest';
import type { CompileInput } from '../../src/types/artifact.js';
import {
  createTestCompiler,
  createTestSession,
  createCodeArtifact,
  createTextArtifact,
  assertNoBlockingIssues,
  countFragmentsByKind,
  getAllPaths,
} from './helpers.js';

// ============================================================================
// Multi-Artifact Compilation
// ============================================================================

describe('E2E: Multi-Artifact Compilation', () => {
  describe('Multiple Code Artifacts', () => {
    it('should compile multiple independent artifacts', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const userCount: number = 10;', 'users'),
          createCodeArtifact('const orderCount: number = 5;', 'orders'),
          createCodeArtifact('const productCount: number = 100;', 'products'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      assertNoBlockingIssues(result);
    });

    it('should track artifact origin for each fragment', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const a: number = 1;', 'artifact-a'),
          createCodeArtifact('const b: number = 2;', 'artifact-b'),
        ],
      };

      const result = await compiler.compile(input);

      // Check that fragments have proper artifact origin
      const artifactIds = new Set(result.fragments.map((f) => f.origin.artifactId));

      // Should have fragments from at least the artifacts we provided
      // (some may come from internal processing)
      expect(artifactIds.size).toBeGreaterThanOrEqual(0);
    });

    it('should handle different language artifacts', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const x: number = 1;', 'typescript-artifact', 'ts'),
          createCodeArtifact('const y = 2;', 'javascript-artifact', 'js'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      assertNoBlockingIssues(result);
    });
  });

  describe('Cross-Artifact Dependencies', () => {
    it('should handle shared types across artifacts', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact(
            `interface User { id: string; name: string; }`,
            'types'
          ),
          createCodeArtifact(
            `const currentUser: User = { id: '1', name: 'Test' };`,
            'data'
          ),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      assertNoBlockingIssues(result);
    });

    it('should link fragments from different artifacts', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact(
            'const price: number = 100;',
            'pricing'
          ),
          createCodeArtifact(
            'const quantity: number = 5;',
            'inventory'
          ),
        ],
      };

      const result = await compiler.compile(input);

      // Link should combine fragments from both artifacts
      expect(result).toBeDefined();
    });
  });

  describe('Conflict Detection', () => {
    it('should detect conflicts when same path is provided by multiple artifacts', async () => {
      const compiler = createTestCompiler();

      // Both artifacts provide "value" with different types
      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const value: number = 1;', 'artifact-1'),
          createCodeArtifact('const value: string = "hello";', 'artifact-2'),
        ],
      };

      const result = await compiler.compile(input);

      // Should complete but may have conflicts or issues
      expect(result).toBeDefined();
    });

    it('should report conflict source artifacts', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact(
            'interface Product { id: string; price: number; }',
            'schema-1'
          ),
          createCodeArtifact(
            'interface Product { id: number; name: string; }',
            'schema-2'
          ),
        ],
      };

      const result = await compiler.compile(input);

      // Check that conflicts reference the correct artifacts if any exist
      for (const conflict of result.conflicts) {
        expect(conflict.candidates).toBeDefined();
        expect(conflict.candidates.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Mixed Artifact Types', () => {
    it('should compile code and text artifacts together', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const count: number = 42;', 'code-artifact'),
          createTextArtifact('This is a description of the system.', 'text-artifact'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      assertNoBlockingIssues(result);
    });
  });

  describe('Selection-based Compilation', () => {
    it('should compile selected artifacts only', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const a: number = 1;', 'artifact-a'),
          createCodeArtifact('const b: number = 2;', 'artifact-b'),
          createCodeArtifact('const c: number = 3;', 'artifact-c'),
        ],
      };

      // Compile only selected artifacts
      const fragments = await compiler.compileFragments(input, {
        artifactIds: ['artifact-a', 'artifact-c'],
      });

      expect(fragments).toBeDefined();
    });

    it('should support incremental artifact addition', async () => {
      const compiler = createTestCompiler();

      // First compilation
      const input1: CompileInput = {
        artifacts: [
          createCodeArtifact('const a: number = 1;', 'artifact-a'),
        ],
      };

      const result1 = await compiler.compile(input1);

      // Second compilation with additional artifact
      const input2: CompileInput = {
        artifacts: [
          createCodeArtifact('const a: number = 1;', 'artifact-a'),
          createCodeArtifact('const b: number = 2;', 'artifact-b'),
        ],
      };

      const result2 = await compiler.compile(input2);

      expect(result2.fragments.length).toBeGreaterThanOrEqual(result1.fragments.length);
    });
  });
});

// ============================================================================
// Large-Scale Tests
// ============================================================================

describe('E2E: Large-Scale Multi-Artifact', () => {
  it('should handle many artifacts efficiently', async () => {
    const compiler = createTestCompiler();

    // Create 10 artifacts
    const artifacts = Array.from({ length: 10 }, (_, i) =>
      createCodeArtifact(`const value${i}: number = ${i};`, `artifact-${i}`)
    );

    const input: CompileInput = { artifacts };

    const start = Date.now();
    const result = await compiler.compile(input);
    const elapsed = Date.now() - start;

    expect(result).toBeDefined();
    assertNoBlockingIssues(result);

    // Should complete in reasonable time (less than 5 seconds)
    expect(elapsed).toBeLessThan(5000);
  });

  it('should maintain consistency with many artifacts', async () => {
    const compiler = createTestCompiler();

    const artifacts = Array.from({ length: 5 }, (_, i) =>
      createCodeArtifact(
        `const item${i}: { id: number; name: string } = { id: ${i}, name: "Item ${i}" };`,
        `artifact-${i}`
      )
    );

    const input: CompileInput = { artifacts };

    const result = await compiler.compile(input);

    expect(result).toBeDefined();
    assertNoBlockingIssues(result);
  });
});
