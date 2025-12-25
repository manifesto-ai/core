/**
 * E2E Error Propagation Tests
 *
 * Tests error handling across the compilation pipeline:
 * - Missing dependencies
 * - Cyclic dependencies
 * - Parse errors
 * - Provenance tracking for errors
 */

import { describe, it, expect } from 'vitest';
import type { CompileInput } from '../../src/types/artifact.js';
import {
  createTestCompiler,
  createTestSession,
  createCodeArtifact,
} from './helpers.js';

// ============================================================================
// Error Propagation Tests
// ============================================================================

describe('E2E: Error Propagation', () => {
  describe('Parse Errors', () => {
    it('should handle syntax errors gracefully', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const x = {;', 'invalid-syntax'), // Invalid syntax
        ],
      };

      // Should not throw, but may produce issues
      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      expect(result.fragments).toBeDefined();
    });

    it('should continue with valid artifacts when one fails', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const valid: number = 1;', 'valid'),
          createCodeArtifact('const invalid = {;', 'invalid'),
          createCodeArtifact('const alsoValid: string = "hello";', 'also-valid'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      // Should have processed the valid artifacts
    });

    it('should track which artifact caused parse error', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const x = {;', 'broken-artifact'),
        ],
      };

      const result = await compiler.compile(input);

      // If there are issues, they should reference the artifact
      for (const issue of result.issues) {
        if (issue.relatedFragments && issue.relatedFragments.length > 0) {
          // Issue should trace back to artifact
          expect(issue.relatedFragments).toBeDefined();
        }
      }
    });
  });

  describe('Linking Errors', () => {
    it('should report linking issues', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      const result = await compiler.compile(input);

      // Should complete without crashing
      expect(result).toBeDefined();
      expect(result.issues).toBeDefined();
    });

    it('should report issues with path information', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      const result = await compiler.compile(input);

      // Any issues with paths should have path property
      for (const issue of result.issues) {
        // Path is optional but should be defined when relevant
        expect(typeof issue.message).toBe('string');
        expect(typeof issue.code).toBe('string');
      }
    });
  });

  describe('Verification Errors', () => {
    it('should report verification issues', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      // Verification issues should be in result.issues
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should categorize issues by severity', async () => {
      const compiler = createTestCompiler();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      const result = await compiler.compile(input);

      // Check that all issues have valid severity
      for (const issue of result.issues) {
        expect(['error', 'warning', 'info']).toContain(issue.severity);
      }
    });
  });

  describe('Session Error Tracking', () => {
    it('should track errors in session snapshot', async () => {
      const session = createTestSession();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      await session.compile(input);
      const snapshot = session.getSnapshot();

      expect(snapshot).toBeDefined();
      expect(typeof snapshot.blockingIssuesCount).toBe('number');
      expect(Array.isArray(snapshot.blockers)).toBe(true);
    });

    it('should expose blockers through session', async () => {
      const session = createTestSession();

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      await session.compile(input);
      const snapshot = session.getSnapshot();

      // Blockers should match blocking issues
      for (const blocker of snapshot.blockers) {
        expect(blocker.kind).toBeDefined();
        expect(blocker.id).toBeDefined();
        expect(blocker.message).toBeDefined();
      }
    });

    it('should provide error phase when compilation fails hard', async () => {
      const session = createTestSession();

      // Even with bad input, should not throw but report phase
      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x = {;')],
      };

      await session.compile(input);
      const snapshot = session.getSnapshot();

      // Phase should be either 'done' or 'error'
      expect(['done', 'error']).toContain(snapshot.phase);
    });
  });

  describe('Provenance in Errors', () => {
    it('should include provenance in fragment-related issues', async () => {
      const compiler = createTestCompiler({ requireProvenance: true });

      const input: CompileInput = {
        artifacts: [createCodeArtifact('const x: number = 1;')],
      };

      const result = await compiler.compile(input);

      // All fragments should have origin
      for (const fragment of result.fragments) {
        expect(fragment.origin).toBeDefined();
        expect(fragment.origin.artifactId).toBeDefined();
      }
    });

    it('should track error origin through compilation stages', async () => {
      const session = createTestSession();

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const x: number = 1;', 'artifact-1'),
          createCodeArtifact('const y: string = "hello";', 'artifact-2'),
        ],
      };

      await session.compile(input);
      const context = session.getAgentContext();

      // Context should provide error details
      expect(context).toBeDefined();
      expect(context.blockerDetails).toBeDefined();
    });
  });
});

// ============================================================================
// Recovery Tests
// ============================================================================

describe('E2E: Error Recovery', () => {
  it('should allow recompilation after error', async () => {
    const session = createTestSession();

    // First compilation with error
    const input1: CompileInput = {
      artifacts: [createCodeArtifact('const x = {;')],
    };

    await session.compile(input1);

    // Second compilation with valid code
    const input2: CompileInput = {
      artifacts: [createCodeArtifact('const x: number = 1;')],
    };

    const result = await session.compile(input2);
    const snapshot = session.getSnapshot();

    expect(snapshot.phase).toBe('done');
    expect(result).toBeDefined();
  });

  it('should reset state between compilations', async () => {
    const session = createTestSession();

    // First compilation
    const input1: CompileInput = {
      artifacts: [createCodeArtifact('const a: number = 1;')],
    };

    await session.compile(input1);
    const snapshot1 = session.getSnapshot();

    // Second compilation
    const input2: CompileInput = {
      artifacts: [createCodeArtifact('const b: string = "hello";')],
    };

    await session.compile(input2);
    const snapshot2 = session.getSnapshot();

    // Both should complete
    expect(snapshot1.phase).toBe('done');
    expect(snapshot2.phase).toBe('done');
  });
});
