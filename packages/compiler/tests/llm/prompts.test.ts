/**
 * LLM Prompts Tests
 *
 * Tests for LLM prompt generation functions including:
 * - buildSystemPrompt
 * - buildUserPrompt
 * - buildMessages
 * - validateDraftStructure
 * - normalizeDraft
 */

import { describe, it, expect } from 'vitest';
import {
  SYSTEM_PROMPT_CORE,
  SYSTEM_PROMPT_SCHEMA,
  SYSTEM_PROMPT_DERIVED,
  SYSTEM_PROMPT_ACTION,
  buildSystemPrompt,
  buildUserPrompt,
  buildMessages,
  validateDraftStructure,
  normalizeDraft,
} from '../../src/llm/prompts.js';
import type { LLMContext } from '../../src/types/session.js';

// ============================================================================
// System Prompt Tests
// ============================================================================

describe('System Prompts', () => {
  it('should have core system prompt with key concepts', () => {
    expect(SYSTEM_PROMPT_CORE).toContain('Manifesto');
    expect(SYSTEM_PROMPT_CORE).toContain('FragmentDraft');
    expect(SYSTEM_PROMPT_CORE).toContain('semantic path');
    expect(SYSTEM_PROMPT_CORE).toContain('Expression DSL');
  });

  it('should have schema prompt with examples', () => {
    expect(SYSTEM_PROMPT_SCHEMA).toContain('SchemaDraft');
    expect(SYSTEM_PROMPT_SCHEMA).toContain('namespace');
    expect(SYSTEM_PROMPT_SCHEMA).toContain('data');
    expect(SYSTEM_PROMPT_SCHEMA).toContain('state');
  });

  it('should have derived prompt with expression examples', () => {
    expect(SYSTEM_PROMPT_DERIVED).toContain('DerivedDraft');
    expect(SYSTEM_PROMPT_DERIVED).toContain('rawExpr');
    expect(SYSTEM_PROMPT_DERIVED).toContain('"op"');
    expect(SYSTEM_PROMPT_DERIVED).toContain('"get"');
  });

  it('should have action prompt with effect examples', () => {
    expect(SYSTEM_PROMPT_ACTION).toContain('ActionDraft');
    expect(SYSTEM_PROMPT_ACTION).toContain('rawEffect');
    expect(SYSTEM_PROMPT_ACTION).toContain('apiCall');
    expect(SYSTEM_PROMPT_ACTION).toContain('setState');
  });
});

// ============================================================================
// buildSystemPrompt Tests
// ============================================================================

describe('buildSystemPrompt', () => {
  it('should include all sections by default', () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain('Manifesto');
    expect(prompt).toContain('SchemaDraft');
    expect(prompt).toContain('DerivedDraft');
    expect(prompt).toContain('ActionDraft');
  });

  it('should exclude sections based on hints', () => {
    const context: LLMContext = {
      hints: {
        includeSchema: false,
        includeDerived: true,
        includeActions: false,
      },
    };

    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('Manifesto'); // Core always included
    expect(prompt).not.toContain('Schema Generation Guidelines');
    expect(prompt).toContain('Derived Value Guidelines');
    expect(prompt).not.toContain('Action Generation Guidelines');
  });
});

// ============================================================================
// buildUserPrompt Tests
// ============================================================================

describe('buildUserPrompt', () => {
  it('should include requirements section', () => {
    const prompt = buildUserPrompt('Create a user management system');

    expect(prompt).toContain('# Requirements');
    expect(prompt).toContain('Create a user management system');
    expect(prompt).toContain('# Instructions');
  });

  it('should include existing paths when provided', () => {
    const context: LLMContext = {
      existingPaths: ['data.user.id', 'data.user.name', 'state.isLoading'],
    };

    const prompt = buildUserPrompt('Add email field', context);

    expect(prompt).toContain('# Existing Paths');
    expect(prompt).toContain('data.user.id');
    expect(prompt).toContain('data.user.name');
  });

  it('should truncate long path lists', () => {
    const context: LLMContext = {
      existingPaths: Array.from({ length: 100 }, (_, i) => `path.${i}`),
    };

    const prompt = buildUserPrompt('Add something', context);

    expect(prompt).toContain('# Existing Paths');
    expect(prompt).toContain('... and more');
  });

  it('should include domain description', () => {
    const context: LLMContext = {
      domainDescription: 'This is an e-commerce platform for selling products.',
    };

    const prompt = buildUserPrompt('Add shopping cart', context);

    expect(prompt).toContain('# Domain Context');
    expect(prompt).toContain('e-commerce platform');
  });

  it('should include existing fragment kinds', () => {
    const context: LLMContext = {
      existingFragmentKinds: ['SchemaFragment', 'SourceFragment'],
    };

    const prompt = buildUserPrompt('Add derived', context);

    expect(prompt).toContain('# Existing Fragment Kinds');
    expect(prompt).toContain('SchemaFragment');
    expect(prompt).toContain('SourceFragment');
  });
});

// ============================================================================
// buildMessages Tests
// ============================================================================

describe('buildMessages', () => {
  it('should return system and user messages', () => {
    const messages = buildMessages('Create something');

    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('should include context in user message', () => {
    const context: LLMContext = {
      existingPaths: ['data.test'],
    };

    const messages = buildMessages('Add field', context);

    expect(messages[1].content).toContain('data.test');
  });
});

// ============================================================================
// validateDraftStructure Tests
// ============================================================================

describe('validateDraftStructure', () => {
  it('should accept valid draft structure', () => {
    const draft = {
      kind: 'SchemaFragment',
      status: 'raw',
      confidence: 0.85,
      provisionalRequires: [],
      provisionalProvides: ['data.test'],
    };

    expect(validateDraftStructure(draft)).toBe(true);
  });

  it('should reject non-object', () => {
    expect(validateDraftStructure(null)).toBe(false);
    expect(validateDraftStructure(undefined)).toBe(false);
    expect(validateDraftStructure('string')).toBe(false);
    expect(validateDraftStructure(123)).toBe(false);
  });

  it('should reject missing kind', () => {
    const draft = {
      status: 'raw',
      confidence: 0.85,
    };

    expect(validateDraftStructure(draft)).toBe(false);
  });

  it('should reject invalid status', () => {
    const draft = {
      kind: 'SchemaFragment',
      status: 'invalid',
      confidence: 0.85,
    };

    expect(validateDraftStructure(draft)).toBe(false);
  });

  it('should reject missing confidence', () => {
    const draft = {
      kind: 'SchemaFragment',
      status: 'raw',
    };

    expect(validateDraftStructure(draft)).toBe(false);
  });

  it('should reject out-of-range confidence', () => {
    expect(
      validateDraftStructure({
        kind: 'SchemaFragment',
        status: 'raw',
        confidence: -0.1,
      })
    ).toBe(false);

    expect(
      validateDraftStructure({
        kind: 'SchemaFragment',
        status: 'raw',
        confidence: 1.5,
      })
    ).toBe(false);
  });

  it('should accept all valid status values', () => {
    for (const status of ['raw', 'validated', 'lowered']) {
      expect(
        validateDraftStructure({
          kind: 'SchemaFragment',
          status,
          confidence: 0.5,
        })
      ).toBe(true);
    }
  });
});

// ============================================================================
// normalizeDraft Tests
// ============================================================================

describe('normalizeDraft', () => {
  it('should add default fields to partial draft', () => {
    const partial = {
      kind: 'SchemaFragment' as const,
      confidence: 0.8,
    };

    const normalized = normalizeDraft(partial, 'test-model', 'abc123');

    expect(normalized.status).toBe('raw');
    expect(normalized.provisionalRequires).toEqual([]);
    expect(normalized.provisionalProvides).toEqual([]);
    expect(normalized.reasoning).toBeDefined();
    expect(normalized.origin.artifactId).toBe('nl-input');
    expect(normalized.origin.location.kind).toBe('llm');
  });

  it('should preserve existing fields', () => {
    const partial = {
      kind: 'DerivedFragment' as const,
      confidence: 0.9,
      reasoning: 'Custom reasoning',
      provisionalRequires: ['data.a'],
      provisionalProvides: ['derived.b'],
    };

    const normalized = normalizeDraft(partial, 'test-model', 'abc123');

    expect(normalized.reasoning).toBe('Custom reasoning');
    expect(normalized.provisionalRequires).toEqual(['data.a']);
    expect(normalized.provisionalProvides).toEqual(['derived.b']);
  });

  it('should include model and promptHash in origin', () => {
    const partial = {
      kind: 'SchemaFragment' as const,
      confidence: 0.7,
    };

    const normalized = normalizeDraft(partial, 'claude-3-opus', 'prompt123');

    const location = normalized.origin.location as Record<string, unknown>;
    expect(location.model).toBe('claude-3-opus');
    expect(location.promptHash).toBe('prompt123');
  });

  it('should default confidence to 0.5 if not provided', () => {
    const partial = {
      kind: 'SchemaFragment' as const,
    };

    const normalized = normalizeDraft(partial as any, 'model', 'hash');

    expect(normalized.confidence).toBe(0.5);
  });
});
