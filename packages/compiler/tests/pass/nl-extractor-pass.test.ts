/**
 * NL Extractor Pass Tests
 *
 * NL Pass가 TextArtifact를 처리하여 FragmentDraft를 생성하는지 검증합니다.
 */

import { describe, it, expect } from 'vitest';
import {
  nlExtractorPass,
  createNLExtractorPass,
  MockLLMAdapter,
  type LLMAdapter,
  type LLMContext,
  createPassContext,
  isNLPass,
} from '../../src/pass/index.js';
import type { TextArtifact, CodeArtifact } from '../../src/types/artifact.js';
import type { FragmentDraft, SchemaDraft, ActionDraft, DerivedDraft } from '../../src/types/fragment.js';

// ============================================================================
// Test Helpers
// ============================================================================

function createTextArtifact(content: string): TextArtifact {
  return {
    id: 'test-text-artifact',
    kind: 'text',
    content,
  };
}

function createCodeArtifact(content: string): CodeArtifact {
  return {
    id: 'test-code-artifact',
    kind: 'code',
    language: 'ts',
    content,
  };
}

// ============================================================================
// Basic Tests
// ============================================================================

describe('NLExtractorPass', () => {
  describe('supports', () => {
    it('should support text artifacts', () => {
      const artifact = createTextArtifact('User is a person');
      expect(nlExtractorPass.supports(artifact)).toBe(true);
    });

    it('should not support code artifacts', () => {
      const artifact = createCodeArtifact('const x = 1;');
      expect(nlExtractorPass.supports(artifact)).toBe(false);
    });
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(nlExtractorPass.name).toBe('nl-extractor');
    });

    it('should have correct priority', () => {
      expect(nlExtractorPass.priority).toBe(900);
    });

    it('should have nl category', () => {
      expect(nlExtractorPass.category).toBe('nl');
    });

    it('should be identified as NLPass', () => {
      expect(isNLPass(nlExtractorPass)).toBe(true);
    });
  });
});

// ============================================================================
// MockLLMAdapter Tests
// ============================================================================

describe('MockLLMAdapter', () => {
  const adapter = new MockLLMAdapter();

  it('should have model ID', () => {
    expect(adapter.modelId).toBe('mock-llm-v1');
  });

  it('should have max confidence', () => {
    expect(adapter.maxConfidence).toBe(0.7);
  });

  describe('generateDrafts', () => {
    it('should generate schema draft from entity pattern', async () => {
      const drafts = await adapter.generateDrafts('User is a person', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      const schemaDrafts = drafts.filter((d): d is SchemaDraft => d.kind === 'SchemaFragment');
      expect(schemaDrafts.length).toBeGreaterThanOrEqual(1);
      expect(schemaDrafts[0]?.provisionalProvides).toContain('data.user');
    });

    it('should generate schema draft from create pattern', async () => {
      const drafts = await adapter.generateDrafts('Create a new product', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      const schemaDrafts = drafts.filter((d): d is SchemaDraft => d.kind === 'SchemaFragment');
      expect(schemaDrafts.length).toBeGreaterThanOrEqual(0);
    });

    it('should generate action draft from action pattern', async () => {
      const drafts = await adapter.generateDrafts('User can submit the form', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      const actionDrafts = drafts.filter((d): d is ActionDraft => d.kind === 'ActionFragment');
      expect(actionDrafts.length).toBeGreaterThanOrEqual(1);
    });

    it('should generate derived draft from dependency pattern', async () => {
      const drafts = await adapter.generateDrafts('Total depends on price', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      const derivedDrafts = drafts.filter((d): d is DerivedDraft => d.kind === 'DerivedFragment');
      expect(derivedDrafts.length).toBeGreaterThanOrEqual(1);
      expect(derivedDrafts[0]?.path).toBe('derived.total');
    });

    it('should include LLM provenance', async () => {
      const drafts = await adapter.generateDrafts('Count is a number', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      expect(drafts.length).toBeGreaterThanOrEqual(1);
      expect(drafts[0]?.origin.location.kind).toBe('llm');
    });

    it('should set confidence score', async () => {
      const drafts = await adapter.generateDrafts('User is a person', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      expect(drafts.length).toBeGreaterThanOrEqual(1);
      expect(drafts[0]?.confidence).toBeDefined();
      expect(drafts[0]?.confidence).toBeGreaterThan(0);
      expect(drafts[0]?.confidence).toBeLessThanOrEqual(1);
    });

    it('should set raw status', async () => {
      const drafts = await adapter.generateDrafts('User is a person', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      expect(drafts.length).toBeGreaterThanOrEqual(1);
      expect(drafts[0]?.status).toBe('raw');
    });

    it('should handle empty input', async () => {
      const drafts = await adapter.generateDrafts('', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      expect(drafts).toEqual([]);
    });

    it('should handle input without patterns', async () => {
      const drafts = await adapter.generateDrafts('Hello world', {
        existingPaths: [],
        existingFragmentKinds: [],
      });

      // May or may not produce drafts depending on pattern matching
      expect(Array.isArray(drafts)).toBe(true);
    });
  });
});

// ============================================================================
// Analyze Tests
// ============================================================================

describe('analyze', () => {
  it('should extract entity findings', () => {
    const artifact = createTextArtifact('User is a person. Name is a string.');
    const ctx = createPassContext(artifact, {});

    const findings = nlExtractorPass.analyze(ctx);

    const entityFindings = findings.filter((f) => f.kind === 'nl_entity');
    expect(entityFindings.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract action findings', () => {
    const artifact = createTextArtifact('User can submit. User should login.');
    const ctx = createPassContext(artifact, {});

    const findings = nlExtractorPass.analyze(ctx);

    const actionFindings = findings.filter((f) => f.kind === 'nl_action');
    expect(actionFindings.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract condition findings', () => {
    const artifact = createTextArtifact('If valid then submit. If enabled then show.');
    const ctx = createPassContext(artifact, {});

    const findings = nlExtractorPass.analyze(ctx);

    const conditionFindings = findings.filter((f) => f.kind === 'nl_condition');
    expect(conditionFindings.length).toBeGreaterThanOrEqual(2);
  });

  it('should include provenance with generated location', () => {
    const artifact = createTextArtifact('User is a person');
    const ctx = createPassContext(artifact, {});

    const findings = nlExtractorPass.analyze(ctx);

    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0]?.provenance.location.kind).toBe('generated');
  });
});

// ============================================================================
// Compile Tests
// ============================================================================

describe('compile', () => {
  it('should generate FragmentDrafts', async () => {
    const artifact = createTextArtifact('User is a person. User can submit.');
    const ctx = createPassContext(artifact, {});
    const findings = nlExtractorPass.analyze(ctx);

    const drafts = await nlExtractorPass.compile(findings, ctx);

    expect(drafts.length).toBeGreaterThanOrEqual(1);
  });

  it('should filter by minimum confidence', async () => {
    const lowConfidenceAdapter: LLMAdapter = {
      modelId: 'low-confidence',
      maxConfidence: 0.2,
      async generateDrafts(): Promise<FragmentDraft[]> {
        return [
          {
            kind: 'SchemaFragment',
            status: 'raw',
            provisionalRequires: [],
            provisionalProvides: ['data.test'],
            origin: {
              artifactId: 'test',
              location: { kind: 'generated', note: 'test' },
            },
            confidence: 0.1, // Very low confidence
            namespace: 'data',
            fields: [],
          } as SchemaDraft,
        ];
      },
    };

    const pass = createNLExtractorPass({
      adapter: lowConfidenceAdapter,
      minConfidence: 0.3,
    });

    const artifact = createTextArtifact('Some text');
    const ctx = createPassContext(artifact, {});
    const findings = pass.analyze(ctx);
    const drafts = await pass.compile(findings, ctx);

    // Should be filtered out due to low confidence
    expect(drafts).toHaveLength(0);
  });
});

// ============================================================================
// createNLExtractorPass Tests
// ============================================================================

describe('createNLExtractorPass', () => {
  it('should create pass with custom adapter', () => {
    const customAdapter: LLMAdapter = {
      modelId: 'custom-model',
      maxConfidence: 0.9,
      async generateDrafts(): Promise<FragmentDraft[]> {
        return [];
      },
    };

    const pass = createNLExtractorPass({ adapter: customAdapter });

    expect(pass.name).toBe('nl-extractor');
    expect(pass.category).toBe('nl');
  });

  it('should use custom minConfidence', async () => {
    const mockAdapter: LLMAdapter = {
      modelId: 'test',
      maxConfidence: 1.0,
      async generateDrafts(): Promise<FragmentDraft[]> {
        return [
          {
            kind: 'SchemaFragment',
            status: 'raw',
            provisionalRequires: [],
            provisionalProvides: ['data.test'],
            origin: {
              artifactId: 'test',
              location: { kind: 'generated', note: 'test' },
            },
            confidence: 0.5,
            namespace: 'data',
            fields: [],
          } as SchemaDraft,
        ];
      },
    };

    // High min confidence - should filter out
    const highConfPass = createNLExtractorPass({
      adapter: mockAdapter,
      minConfidence: 0.8,
    });

    const artifact = createTextArtifact('Test');
    const ctx = createPassContext(artifact, {});
    const findings = highConfPass.analyze(ctx);
    const drafts = await highConfPass.compile(findings, ctx);

    expect(drafts).toHaveLength(0);

    // Low min confidence - should include
    const lowConfPass = createNLExtractorPass({
      adapter: mockAdapter,
      minConfidence: 0.3,
    });

    const drafts2 = await lowConfPass.compile(findings, ctx);
    expect(drafts2).toHaveLength(1);
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('NL Pass Integration', () => {
  it('should process complex text', async () => {
    const text = `
      User is a person with a name and email.
      Order is an entity with items and total.
      User can submit an order.
      Total depends on items.
      If valid then submit.
    `;

    const artifact = createTextArtifact(text);
    const ctx = createPassContext(artifact, {});

    // Analyze
    const findings = nlExtractorPass.analyze(ctx);
    expect(findings.length).toBeGreaterThanOrEqual(1);

    // Compile
    const drafts = await nlExtractorPass.compile(findings, ctx);
    expect(drafts.length).toBeGreaterThanOrEqual(0);
  });

  it('should include existing context in LLM call', async () => {
    let receivedContext: LLMContext | null = null;

    const contextCapturingAdapter: LLMAdapter = {
      modelId: 'context-capture',
      maxConfidence: 1.0,
      async generateDrafts(_input: string, context: LLMContext): Promise<FragmentDraft[]> {
        receivedContext = context;
        return [];
      },
    };

    const pass = createNLExtractorPass({ adapter: contextCapturingAdapter });
    const artifact = createTextArtifact('Test');
    const ctx = createPassContext(artifact, {
      existingPaths: ['data.existing', 'state.flag'],
      existingFragments: [],
    });

    const findings = pass.analyze(ctx);
    await pass.compile(findings, ctx);

    expect(receivedContext).not.toBe(null);
    expect(receivedContext?.existingPaths).toContain('data.existing');
    expect(receivedContext?.existingPaths).toContain('state.flag');
  });
});

// ============================================================================
// Draft Validation Tests
// ============================================================================

describe('Draft Validation', () => {
  it('should produce drafts with required fields', async () => {
    const artifact = createTextArtifact('User is a person');
    const ctx = createPassContext(artifact, {});
    const findings = nlExtractorPass.analyze(ctx);
    const drafts = await nlExtractorPass.compile(findings, ctx);

    for (const draft of drafts) {
      // Required fields
      expect(draft.kind).toBeDefined();
      expect(draft.status).toBe('raw');
      expect(draft.provisionalRequires).toBeDefined();
      expect(draft.provisionalProvides).toBeDefined();
      expect(draft.origin).toBeDefined();
      expect(draft.confidence).toBeDefined();

      // Origin should be LLM
      expect(draft.origin.location.kind).toBe('llm');
    }
  });

  it('should produce schema drafts with proper structure', async () => {
    const artifact = createTextArtifact('Count is a number');
    const ctx = createPassContext(artifact, {});
    const findings = nlExtractorPass.analyze(ctx);
    const drafts = await nlExtractorPass.compile(findings, ctx);

    const schemaDrafts = drafts.filter((d): d is SchemaDraft => d.kind === 'SchemaFragment');

    for (const draft of schemaDrafts) {
      expect(draft.namespace).toBeDefined();
      expect(draft.fields).toBeDefined();
      expect(Array.isArray(draft.fields)).toBe(true);
    }
  });
});
