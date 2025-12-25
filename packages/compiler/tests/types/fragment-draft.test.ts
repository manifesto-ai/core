/**
 * FragmentDraft Types Tests
 *
 * Tests for the isFragmentDraft type guard in src/types/fragment-draft.ts
 */

import { describe, it, expect } from 'vitest';
import {
  isFragmentDraft,
  type FragmentDraft,
  type SchemaDraft,
  type SourceDraft,
  type ExpressionDraft,
  type DerivedDraft,
  type PolicyDraft,
  type EffectDraft,
  type ActionDraft,
  type StatementDraft,
  type DraftStatus,
} from '../../src/types/fragment-draft.js';
import { generatedOrigin, llmOrigin } from '../../src/types/provenance.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createBaseDraft(
  kind: string,
  status: DraftStatus = 'raw'
): Partial<FragmentDraft> {
  return {
    kind: kind as any,
    provisionalRequires: [],
    provisionalProvides: [],
    status,
    origin: {
      artifactId: 'test',
      location: llmOrigin('gpt-4'),
      createdAt: Date.now(),
    },
    confidence: 0.8,
  };
}

function createSchemaDraft(status: DraftStatus = 'raw'): SchemaDraft {
  return {
    ...createBaseDraft('SchemaFragment', status),
    kind: 'SchemaFragment',
    namespace: 'data',
    fields: [{ path: 'data.count', type: 'number' }],
  } as SchemaDraft;
}

function createSourceDraft(): SourceDraft {
  return {
    ...createBaseDraft('SourceFragment'),
    kind: 'SourceFragment',
    path: 'data.input',
    semantic: { type: 'string', description: 'User input' },
  } as SourceDraft;
}

function createExpressionDraft(): ExpressionDraft {
  return {
    ...createBaseDraft('ExpressionFragment'),
    kind: 'ExpressionFragment',
    rawExpr: ['>', ['get', 'data.count'], 0],
    name: 'isPositive',
  } as ExpressionDraft;
}

function createDerivedDraft(): DerivedDraft {
  return {
    ...createBaseDraft('DerivedFragment'),
    kind: 'DerivedFragment',
    path: 'derived.total',
    rawExpr: ['*', ['get', 'data.count'], 2],
  } as DerivedDraft;
}

function createPolicyDraft(): PolicyDraft {
  return {
    ...createBaseDraft('PolicyFragment'),
    kind: 'PolicyFragment',
    target: { kind: 'field', path: 'data.field' },
  } as PolicyDraft;
}

function createEffectDraft(): EffectDraft {
  return {
    ...createBaseDraft('EffectFragment'),
    kind: 'EffectFragment',
    rawEffect: ['sequence', []],
    risk: 'low',
  } as EffectDraft;
}

function createActionDraft(): ActionDraft {
  return {
    ...createBaseDraft('ActionFragment'),
    kind: 'ActionFragment',
    actionId: 'doSomething',
  } as ActionDraft;
}

function createStatementDraft(): StatementDraft {
  return {
    ...createBaseDraft('StatementFragment'),
    kind: 'StatementFragment',
    statementType: 'conditional',
  } as StatementDraft;
}

// ============================================================================
// isFragmentDraft
// ============================================================================

describe('isFragmentDraft', () => {
  describe('Valid drafts', () => {
    it('should return true for SchemaDraft', () => {
      expect(isFragmentDraft(createSchemaDraft())).toBe(true);
    });

    it('should return true for SourceDraft', () => {
      expect(isFragmentDraft(createSourceDraft())).toBe(true);
    });

    it('should return true for ExpressionDraft', () => {
      expect(isFragmentDraft(createExpressionDraft())).toBe(true);
    });

    it('should return true for DerivedDraft', () => {
      expect(isFragmentDraft(createDerivedDraft())).toBe(true);
    });

    it('should return true for PolicyDraft', () => {
      expect(isFragmentDraft(createPolicyDraft())).toBe(true);
    });

    it('should return true for EffectDraft', () => {
      expect(isFragmentDraft(createEffectDraft())).toBe(true);
    });

    it('should return true for ActionDraft', () => {
      expect(isFragmentDraft(createActionDraft())).toBe(true);
    });

    it('should return true for StatementDraft', () => {
      expect(isFragmentDraft(createStatementDraft())).toBe(true);
    });
  });

  describe('Status variants', () => {
    it('should return true for raw status', () => {
      const draft = createSchemaDraft('raw');
      expect(isFragmentDraft(draft)).toBe(true);
    });

    it('should return true for validated status', () => {
      const draft = createSchemaDraft('validated');
      expect(isFragmentDraft(draft)).toBe(true);
    });

    it('should return true for lowered status', () => {
      const draft = createSchemaDraft('lowered');
      expect(isFragmentDraft(draft)).toBe(true);
    });
  });

  describe('Invalid inputs', () => {
    it('should return false for null', () => {
      expect(isFragmentDraft(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(isFragmentDraft(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(isFragmentDraft('string')).toBe(false);
    });

    it('should return false for number', () => {
      expect(isFragmentDraft(42)).toBe(false);
    });

    it('should return false for empty object', () => {
      expect(isFragmentDraft({})).toBe(false);
    });

    it('should return false for array', () => {
      expect(isFragmentDraft([])).toBe(false);
    });
  });

  describe('Missing required fields', () => {
    it('should return false when status is missing', () => {
      const draft = createSchemaDraft();
      delete (draft as any).status;
      expect(isFragmentDraft(draft)).toBe(false);
    });

    it('should return false when origin is missing', () => {
      const draft = createSchemaDraft();
      delete (draft as any).origin;
      expect(isFragmentDraft(draft)).toBe(false);
    });

    it('should return false when confidence is missing', () => {
      const draft = createSchemaDraft();
      delete (draft as any).confidence;
      expect(isFragmentDraft(draft)).toBe(false);
    });

    it('should return false for invalid status value', () => {
      const draft = createSchemaDraft();
      (draft as any).status = 'invalid';
      expect(isFragmentDraft(draft)).toBe(false);
    });
  });

  describe('Fragment vs Draft distinction', () => {
    it('should return false for a regular Fragment (no draft status)', () => {
      // Fragment has id, requires, provides but no status/confidence
      const fragment = {
        id: 'frag_1',
        kind: 'SchemaFragment',
        requires: [],
        provides: ['data.x'],
        origin: {
          artifactId: 'test',
          location: generatedOrigin('test'),
          createdAt: Date.now(),
        },
        evidence: [],
        compilerVersion: '0.1.0',
      };

      expect(isFragmentDraft(fragment)).toBe(false);
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should work with confidence of 0', () => {
    const draft = createSchemaDraft();
    draft.confidence = 0;
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should work with confidence of 1', () => {
    const draft = createSchemaDraft();
    draft.confidence = 1;
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should handle draft with validation result', () => {
    const draft = createSchemaDraft('validated');
    draft.validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should handle draft with loweredFragmentId', () => {
    const draft = createSchemaDraft('lowered');
    draft.loweredFragmentId = 'frag_123';
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should handle draft with reasoning', () => {
    const draft = createExpressionDraft();
    draft.reasoning = 'This expression checks if count is positive';
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should handle objects with extra properties', () => {
    const draft = {
      ...createSchemaDraft(),
      extraProp: 'should not affect validation',
      anotherExtra: { nested: true },
    };
    expect(isFragmentDraft(draft)).toBe(true);
  });

  it('should handle draft with all optional fields populated', () => {
    const draft: SchemaDraft = {
      kind: 'SchemaFragment',
      provisionalRequires: ['dep1', 'dep2'],
      provisionalProvides: ['data.count', 'data.name'],
      status: 'validated',
      validation: {
        isValid: true,
        errors: [],
        warnings: [{ code: 'LOW_CONFIDENCE', message: 'Consider review' }],
      },
      loweredFragmentId: 'frag_abc',
      origin: {
        artifactId: 'artifact_1',
        location: llmOrigin('claude-3', 'prompt_hash'),
        createdAt: Date.now(),
      },
      confidence: 0.95,
      reasoning: 'Based on field naming patterns',
      namespace: 'data',
      fields: [
        { path: 'data.count', type: 'number', optional: true, defaultValue: 0 },
      ],
    };

    expect(isFragmentDraft(draft)).toBe(true);
  });
});
