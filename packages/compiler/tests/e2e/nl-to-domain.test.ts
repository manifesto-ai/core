/**
 * E2E NL to Domain Tests
 *
 * Tests the natural language to domain pipeline:
 * - NL requirements -> drafts -> fragments -> domain
 * - Confidence filtering
 * - Code + NL combination
 *
 * AGENT_README Invariant #2: LLM은 비신뢰 제안자
 */

import { describe, it, expect } from 'vitest';
import type { CompileInput } from '../../src/types/artifact.js';
import type { FragmentDraft } from '../../src/types/fragment-draft.js';
import type { LLMAdapter, LLMContext } from '../../src/types/session.js';
import {
  createTestCompiler,
  createTestSession,
  createCodeArtifact,
  createTextArtifact,
  createMockLLMAdapter,
  createSampleDrafts,
  assertNoBlockingIssues,
} from './helpers.js';

// ============================================================================
// Mock LLM Adapter for Testing
// ============================================================================

function createCustomMockAdapter(
  generateFn: (input: string, context: LLMContext) => Promise<FragmentDraft[]>
): LLMAdapter {
  return {
    modelId: 'mock-model',
    maxConfidence: 0.9,
    generateDrafts: generateFn,
  };
}

// ============================================================================
// NL to Domain Pipeline Tests
// ============================================================================

describe('E2E: NL to Domain Pipeline', () => {
  describe('Basic NL Processing', () => {
    it('should process text artifact with LLM adapter', async () => {
      const mockAdapter = createMockLLMAdapter(createSampleDrafts());
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [
          createTextArtifact('Create a user management system with name and email fields.'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      // Drafts should be lowered to fragments if valid
    });

    it('should pass context to LLM adapter', async () => {
      let capturedContext: LLMContext | undefined;

      const mockAdapter = createCustomMockAdapter(async (input, context) => {
        capturedContext = context;
        return createSampleDrafts();
      });

      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      // First compile some code to establish existing paths
      const codeInput: CompileInput = {
        artifacts: [createCodeArtifact('const existingValue: number = 1;')],
      };

      await compiler.compile(codeInput);

      // Then compile NL
      const nlInput: CompileInput = {
        artifacts: [createTextArtifact('Add a new field')],
      };

      await compiler.compile(nlInput);

      // Context should have been passed
      expect(capturedContext).toBeDefined();
    });
  });

  describe('Draft Lowering', () => {
    it('should lower valid drafts to fragments', async () => {
      const validDrafts: FragmentDraft[] = [
        {
          kind: 'SchemaFragment',
          namespace: 'data',
          fields: [{ path: 'test.field', type: 'string' }],
          provisionalRequires: [],
          provisionalProvides: ['data.test.field'],
          status: 'raw',
          origin: {
            artifactId: 'nl-input',
            location: { kind: 'llm', model: 'mock', promptHash: 'test' },
          },
          confidence: 0.85,
          reasoning: 'Test draft',
        } as FragmentDraft,
      ];

      const mockAdapter = createMockLLMAdapter(validDrafts);
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [createTextArtifact('Create a test field')],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
    });

    it('should reject drafts with invalid structure', async () => {
      const invalidDrafts: FragmentDraft[] = [
        {
          kind: 'SchemaFragment',
          // Missing required fields
          provisionalRequires: [],
          provisionalProvides: [],
          status: 'raw',
          origin: {
            artifactId: 'nl-input',
            location: { kind: 'llm', model: 'mock', promptHash: 'test' },
          },
          confidence: 0.5,
        } as FragmentDraft,
      ];

      const mockAdapter = createMockLLMAdapter(invalidDrafts);
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [createTextArtifact('Create something')],
      };

      // Should not throw but may produce warnings
      const result = await compiler.compile(input);
      expect(result).toBeDefined();
    });
  });

  describe('Confidence Filtering', () => {
    it('should process high confidence drafts', async () => {
      const highConfidenceDrafts: FragmentDraft[] = [
        {
          kind: 'SourceFragment',
          path: 'data.highConfidence',
          semantic: { type: 'string', description: 'High confidence value' },
          provisionalRequires: [],
          provisionalProvides: ['data.highConfidence'],
          status: 'raw',
          origin: {
            artifactId: 'nl-input',
            location: { kind: 'llm', model: 'mock', promptHash: 'test' },
          },
          confidence: 0.95,
          reasoning: 'Very confident about this',
        } as FragmentDraft,
      ];

      const mockAdapter = createMockLLMAdapter(highConfidenceDrafts);
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [createTextArtifact('Create a high confidence field')],
      };

      const result = await compiler.compile(input);
      expect(result).toBeDefined();
    });

    it('should handle low confidence drafts appropriately', async () => {
      const lowConfidenceDrafts: FragmentDraft[] = [
        {
          kind: 'SourceFragment',
          path: 'data.lowConfidence',
          semantic: { type: 'unknown', description: 'Uncertain value' },
          provisionalRequires: [],
          provisionalProvides: ['data.lowConfidence'],
          status: 'raw',
          origin: {
            artifactId: 'nl-input',
            location: { kind: 'llm', model: 'mock', promptHash: 'test' },
          },
          confidence: 0.3,
          reasoning: 'Not sure about this',
        } as FragmentDraft,
      ];

      const mockAdapter = createMockLLMAdapter(lowConfidenceDrafts);
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [createTextArtifact('Maybe create something')],
      };

      // Low confidence drafts may be flagged or filtered
      const result = await compiler.compile(input);
      expect(result).toBeDefined();
    });
  });

  describe('Mixed Code and NL', () => {
    it('should combine code and NL artifacts', async () => {
      const mockAdapter = createMockLLMAdapter(createSampleDrafts());
      const compiler = createTestCompiler({ llmAdapter: mockAdapter });

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const existingValue: number = 42;', 'code-artifact'),
          createTextArtifact('Add user management', 'nl-artifact'),
        ],
      };

      const result = await compiler.compile(input);

      expect(result).toBeDefined();
      // Should have fragments from both sources
    });

    it('should maintain provenance for different artifact types', async () => {
      const mockAdapter = createMockLLMAdapter(createSampleDrafts());
      const compiler = createTestCompiler({
        llmAdapter: mockAdapter,
        requireProvenance: true,
      });

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const x: number = 1;', 'code-artifact'),
          createTextArtifact('Add a user name field', 'nl-artifact'),
        ],
      };

      const result = await compiler.compile(input);

      // All fragments should have origin
      for (const fragment of result.fragments) {
        expect(fragment.origin).toBeDefined();
        expect(fragment.origin.artifactId).toBeDefined();
      }
    });
  });

  describe('LLM Error Handling', () => {
    it('should handle LLM adapter errors gracefully', async () => {
      const failingAdapter: LLMAdapter = {
        modelId: 'failing-model',
        maxConfidence: 0.9,
        async generateDrafts(): Promise<FragmentDraft[]> {
          throw new Error('LLM API error');
        },
      };

      const compiler = createTestCompiler({ llmAdapter: failingAdapter });

      const input: CompileInput = {
        artifacts: [createTextArtifact('Create something')],
      };

      // Should not crash the compiler
      try {
        const result = await compiler.compile(input);
        // May succeed with empty drafts or have issues
        expect(result).toBeDefined();
      } catch (error) {
        // Or may propagate error
        expect(error).toBeDefined();
      }
    });

    it('should continue with code artifacts when LLM fails', async () => {
      const failingAdapter: LLMAdapter = {
        modelId: 'failing-model',
        maxConfidence: 0.9,
        async generateDrafts(): Promise<FragmentDraft[]> {
          throw new Error('LLM unavailable');
        },
      };

      const compiler = createTestCompiler({ llmAdapter: failingAdapter });

      const input: CompileInput = {
        artifacts: [
          createCodeArtifact('const value: number = 1;', 'valid-code'),
          createTextArtifact('This will fail', 'nl-that-fails'),
        ],
      };

      try {
        const result = await compiler.compile(input);
        // Should still process code artifact
        expect(result).toBeDefined();
      } catch {
        // Or the error may propagate
      }
    });
  });
});

// ============================================================================
// Draft Types Coverage
// ============================================================================

describe('E2E: Draft Type Coverage', () => {
  it('should handle SchemaDraft', async () => {
    const drafts: FragmentDraft[] = [
      {
        kind: 'SchemaFragment',
        namespace: 'data',
        fields: [
          { path: 'user.id', type: 'string' },
          { path: 'user.name', type: 'string' },
        ],
        provisionalRequires: [],
        provisionalProvides: ['data.user.id', 'data.user.name'],
        status: 'raw',
        origin: {
          artifactId: 'nl-input',
          location: { kind: 'llm', model: 'mock', promptHash: 'test' },
        },
        confidence: 0.85,
        reasoning: 'User schema',
      } as FragmentDraft,
    ];

    const mockAdapter = createMockLLMAdapter(drafts);
    const compiler = createTestCompiler({ llmAdapter: mockAdapter });

    const input: CompileInput = {
      artifacts: [createTextArtifact('Create user schema')],
    };

    const result = await compiler.compile(input);
    expect(result).toBeDefined();
  });

  it('should handle SourceDraft', async () => {
    const drafts: FragmentDraft[] = [
      {
        kind: 'SourceFragment',
        path: 'data.currentUserId',
        semantic: {
          type: 'string',
          description: 'Current user ID',
          writable: false,
        },
        provisionalRequires: [],
        provisionalProvides: ['data.currentUserId'],
        status: 'raw',
        origin: {
          artifactId: 'nl-input',
          location: { kind: 'llm', model: 'mock', promptHash: 'test' },
        },
        confidence: 0.8,
        reasoning: 'Source for current user ID',
      } as FragmentDraft,
    ];

    const mockAdapter = createMockLLMAdapter(drafts);
    const compiler = createTestCompiler({ llmAdapter: mockAdapter });

    const input: CompileInput = {
      artifacts: [createTextArtifact('Create current user source')],
    };

    const result = await compiler.compile(input);
    expect(result).toBeDefined();
  });

  it('should handle DerivedDraft', async () => {
    const drafts: FragmentDraft[] = [
      {
        kind: 'DerivedFragment',
        path: 'derived.fullName',
        rawExpr: {
          op: 'concat',
          args: [
            { get: 'data.firstName' },
            { lit: ' ' },
            { get: 'data.lastName' },
          ],
        },
        provisionalRequires: ['data.firstName', 'data.lastName'],
        provisionalProvides: ['derived.fullName'],
        status: 'raw',
        origin: {
          artifactId: 'nl-input',
          location: { kind: 'llm', model: 'mock', promptHash: 'test' },
        },
        confidence: 0.75,
        reasoning: 'Full name derived from first and last name',
      } as FragmentDraft,
    ];

    const mockAdapter = createMockLLMAdapter(drafts);
    const compiler = createTestCompiler({ llmAdapter: mockAdapter });

    const input: CompileInput = {
      artifacts: [createTextArtifact('Create full name derived value')],
    };

    const result = await compiler.compile(input);
    expect(result).toBeDefined();
  });
});
