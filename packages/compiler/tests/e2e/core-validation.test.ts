/**
 * E2E Tests: Core Validation Integration
 *
 * Tests the full pipeline with Core validateDomain integration:
 * - compile → link → verify (with Core validation)
 * - Session observability with Core validation results
 * - Determinism (Principle E) with Core validation
 */

import { describe, it, expect } from 'vitest';
import { link } from '../../src/linker/index.js';
import { verify } from '../../src/verifier/index.js';
import type { CompileInput } from '../../src/types/artifact.js';
import {
  createTestCompiler,
  createTestSession,
  createCodeArtifact,
} from './helpers.js';

// ============================================================================
// E2E: Full Pipeline with Core Validation
// ============================================================================

describe('E2E: Core Validation in Pipeline', () => {
  describe('Valid Domain', () => {
    it('should pass Core validation for simple TypeScript code', async () => {
      const compiler = createTestCompiler();
      const input: CompileInput = {
        artifacts: [createCodeArtifact(`
          interface Counter {
            count: number;
          }

          const initialCount: number = 0;
        `)],
      };

      // Compile
      const compileResult = await compiler.compile(input);
      expect(compileResult).toBeDefined();

      // Link with domain building
      const linkResult = link(compileResult.fragments, { buildDomain: true });

      // Verify with Core validation
      const verifyResult = verify(linkResult, { useCoreValidation: true });

      // Should pass (or have only warnings)
      expect(verifyResult.errorCount).toBe(0);
    });

    it('should pass Core validation for domain with multiple fields', async () => {
      const compiler = createTestCompiler();
      const input: CompileInput = {
        artifacts: [createCodeArtifact(`
          interface Form {
            firstName: string;
            lastName: string;
            email: string;
          }
        `)],
      };

      const compileResult = await compiler.compile(input);
      expect(compileResult).toBeDefined();

      const linkResult = link(compileResult.fragments, { buildDomain: true });
      const verifyResult = verify(linkResult, { useCoreValidation: true });

      // Check for no errors
      expect(verifyResult.errorCount).toBe(0);
    });
  });

  describe('Session Integration', () => {
    it('should track phases during compilation', async () => {
      const session = createTestSession();
      const phases: string[] = [];

      // Subscribe to phase changes
      session.onPhaseChange((phase) => {
        phases.push(phase);
      });

      const input: CompileInput = {
        artifacts: [createCodeArtifact(`const x: number = 1;`)],
      };

      // Run compilation
      await session.compile(input);

      // Verify phases were tracked
      expect(phases.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// E2E: Determinism with Core Validation
// ============================================================================

describe('E2E: Determinism (Principle E)', () => {
  it('should produce identical results across multiple runs', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(`
        interface TestData {
          a: number;
          b: string;
        }
      `)],
    };

    // Run the pipeline multiple times
    const results: Array<{
      fragmentCount: number;
      issueCount: number;
      errorCount: number;
      warningCount: number;
      issueCodes: string[];
    }> = [];

    for (let i = 0; i < 3; i++) {
      const compileResult = await compiler.compile(input);
      const linkResult = link(compileResult.fragments, { buildDomain: true });
      const verifyResult = verify(linkResult, { useCoreValidation: true });

      results.push({
        fragmentCount: compileResult.fragments.length,
        issueCount: verifyResult.issues.length,
        errorCount: verifyResult.errorCount,
        warningCount: verifyResult.warningCount,
        issueCodes: verifyResult.issues.map(i => i.code).sort(),
      });
    }

    // All runs should produce identical results
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
  });

  it('should produce deterministic issue ordering', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(`
        // Simple TypeScript code
        const x: number = 1;
        const y: string = "test";
      `)],
    };

    const results: string[][] = [];

    for (let i = 0; i < 3; i++) {
      const compileResult = await compiler.compile(input);
      const linkResult = link(compileResult.fragments, { buildDomain: true });
      const verifyResult = verify(linkResult, { useCoreValidation: true });

      // Get issue codes in order
      results.push(verifyResult.issues.map(issue => `${issue.code}:${issue.path || ''}`));
    }

    // If we got results, they should all be identical
    if (results.length >= 2) {
      expect(results[0]).toEqual(results[1]);
    }
    if (results.length >= 3) {
      expect(results[1]).toEqual(results[2]);
    }
  });
});

// ============================================================================
// E2E: Core Validation Toggle
// ============================================================================

describe('E2E: Core Validation Toggle', () => {
  it('should skip Core validation when useCoreValidation=false', async () => {
    const compiler = createTestCompiler();
    const input: CompileInput = {
      artifacts: [createCodeArtifact(`
        interface TestData {
          count: number;
        }
      `)],
    };

    const compileResult = await compiler.compile(input);
    expect(compileResult).toBeDefined();

    const linkResult = link(compileResult.fragments, { buildDomain: true });

    // Without Core validation
    const result1 = verify(linkResult, { useCoreValidation: false });

    // With Core validation
    const result2 = verify(linkResult, { useCoreValidation: true });

    // Both should have no errors for a simple domain
    expect(result1.errorCount).toBe(0);
    expect(result2.errorCount).toBe(0);
  });
});
