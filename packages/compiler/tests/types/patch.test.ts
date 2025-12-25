/**
 * Patch Types Tests
 *
 * Tests for all patch operation creators and utilities in src/types/patch.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type { Fragment, SourceFragment } from '../../src/types/fragment.js';
import { generatedOrigin } from '../../src/types/provenance.js';
import {
  // ID and Patch creation
  createPatchId,
  createPatch,
  createPatchHint,
  // Standard patch ops
  replaceExprOp,
  addDepOp,
  removeFragmentOp,
  chooseConflictOp,
  renamePathOp,
  addFragmentOp,
  // Alias patch ops
  applyAliasOp,
  rejectAliasOp,
  addAliasOp,
  removeAliasOp,
} from '../../src/types/patch.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestFragment(): SourceFragment {
  return {
    id: 'test_frag_1',
    kind: 'SourceFragment',
    path: 'data.count' as SemanticPath,
    schema: { type: 'number' },
    defaultValue: 0,
    requires: [],
    provides: ['data.count'],
    origin: {
      artifactId: 'test',
      location: { kind: 'generated' },
      createdAt: Date.now(),
    },
    confidence: 1.0,
    evidence: [],
    compilerVersion: '0.1.0',
    tags: [],
  };
}

function createTestProvenance() {
  return {
    artifactId: 'test-artifact',
    location: { kind: 'generated' as const },
    createdAt: Date.now(),
  };
}

// ============================================================================
// Patch ID Creation
// ============================================================================

describe('createPatchId', () => {
  it('should create a patch ID with correct prefix', () => {
    const id = createPatchId();
    expect(id).toMatch(/^patch_\d+_[a-z0-9]+$/);
  });

  it('should create unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createPatchId());
    }
    expect(ids.size).toBe(100);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const id = createPatchId();
    const after = Date.now();

    const timestampPart = id.split('_')[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// createPatch
// ============================================================================

describe('createPatch', () => {
  it('should create patch with required fields', () => {
    const ops = [removeFragmentOp('frag_1')];
    const origin = createTestProvenance();

    const patch = createPatch(ops, origin);

    expect(patch.id).toMatch(/^patch_/);
    expect(patch.ops).toEqual(ops);
    expect(patch.origin).toEqual(origin);
    expect(patch.createdAt).toBeDefined();
    expect(typeof patch.createdAt).toBe('number');
  });

  it('should create patch with optional evidence', () => {
    const ops = [removeFragmentOp('frag_1')];
    const origin = createTestProvenance();
    const evidence = [
      { kind: 'code' as const, ref: 'line 10', confidence: 0.9 },
    ];

    const patch = createPatch(ops, origin, { evidence });

    expect(patch.evidence).toEqual(evidence);
  });

  it('should create patch with optional description', () => {
    const ops = [removeFragmentOp('frag_1')];
    const origin = createTestProvenance();

    const patch = createPatch(ops, origin, {
      description: 'Remove unused fragment',
    });

    expect(patch.description).toBe('Remove unused fragment');
  });

  it('should create patch with appliesTo constraints', () => {
    const ops = [removeFragmentOp('frag_1')];
    const origin = createTestProvenance();

    const patch = createPatch(ops, origin, {
      appliesTo: {
        fragmentVersion: '1.0.0',
        linkResultVersion: 'v2',
      },
    });

    expect(patch.appliesTo?.fragmentVersion).toBe('1.0.0');
    expect(patch.appliesTo?.linkResultVersion).toBe('v2');
  });

  it('should create patch with multiple operations', () => {
    const ops = [
      removeFragmentOp('frag_1'),
      removeFragmentOp('frag_2'),
      renamePathOp('data.old' as SemanticPath, 'data.new' as SemanticPath),
    ];
    const origin = createTestProvenance();

    const patch = createPatch(ops, origin);

    expect(patch.ops).toHaveLength(3);
  });

  it('should create patch with empty operations', () => {
    const origin = createTestProvenance();
    const patch = createPatch([], origin);

    expect(patch.ops).toEqual([]);
  });
});

// ============================================================================
// Standard Patch Operations
// ============================================================================

describe('replaceExprOp', () => {
  it('should create replaceExpr operation', () => {
    const expr: Expression = ['*', ['get', 'data.count'], 2];
    const op = replaceExprOp('frag_1', expr);

    expect(op.op).toBe('replaceExpr');
    expect(op).toHaveProperty('fragmentId', 'frag_1');
    expect(op).toHaveProperty('newExpr', expr);
  });

  it('should handle complex expressions', () => {
    const expr: Expression = [
      'if',
      ['>', ['get', 'data.value'], 100],
      ['literal', 'high'],
      ['literal', 'low'],
    ];
    const op = replaceExprOp('derived_1', expr);

    expect(op.op).toBe('replaceExpr');
    expect((op as any).newExpr).toEqual(expr);
  });

  it('should handle literal expressions', () => {
    const expr: Expression = ['literal', 42];
    const op = replaceExprOp('frag_1', expr);

    expect((op as any).newExpr).toEqual(['literal', 42]);
  });
});

describe('addDepOp', () => {
  it('should create addDep operation', () => {
    const op = addDepOp(
      'derived.total' as SemanticPath,
      'data.price' as SemanticPath
    );

    expect(op.op).toBe('addDep');
    expect(op).toHaveProperty('derivedPath', 'derived.total');
    expect(op).toHaveProperty('dep', 'data.price');
  });
});

describe('removeFragmentOp', () => {
  it('should create removeFragment operation', () => {
    const op = removeFragmentOp('frag_to_remove');

    expect(op.op).toBe('removeFragment');
    expect(op).toHaveProperty('fragmentId', 'frag_to_remove');
  });

  it('should handle various fragment ID formats', () => {
    const op1 = removeFragmentOp('schema_123');
    const op2 = removeFragmentOp('derived-abc-def');

    expect((op1 as any).fragmentId).toBe('schema_123');
    expect((op2 as any).fragmentId).toBe('derived-abc-def');
  });
});

describe('chooseConflictOp', () => {
  it('should create chooseConflict operation', () => {
    const op = chooseConflictOp('conflict_123', 'frag_winner');

    expect(op.op).toBe('chooseConflict');
    expect(op).toHaveProperty('conflictId', 'conflict_123');
    expect(op).toHaveProperty('chosenFragmentId', 'frag_winner');
  });
});

describe('renamePathOp', () => {
  it('should create renamePath operation', () => {
    const op = renamePathOp(
      'data.oldName' as SemanticPath,
      'data.newName' as SemanticPath
    );

    expect(op.op).toBe('renamePath');
    expect(op).toHaveProperty('from', 'data.oldName');
    expect(op).toHaveProperty('to', 'data.newName');
  });

  it('should handle nested paths', () => {
    const op = renamePathOp(
      'data.user.profile.name' as SemanticPath,
      'data.account.displayName' as SemanticPath
    );

    expect((op as any).from).toBe('data.user.profile.name');
    expect((op as any).to).toBe('data.account.displayName');
  });
});

describe('addFragmentOp', () => {
  it('should create addFragment operation', () => {
    const fragment = createTestFragment();
    const op = addFragmentOp(fragment);

    expect(op.op).toBe('addFragment');
    expect(op).toHaveProperty('fragment', fragment);
  });

  it('should preserve fragment structure', () => {
    const fragment = createTestFragment();
    const op = addFragmentOp(fragment);

    expect((op as any).fragment.id).toBe('test_frag_1');
    expect((op as any).fragment.kind).toBe('SourceFragment');
    expect((op as any).fragment.path).toBe('data.count');
  });
});

// ============================================================================
// createPatchHint
// ============================================================================

describe('createPatchHint', () => {
  it('should create hint with required fields', () => {
    const hint = createPatchHint('Add missing dependency', {
      op: 'addDep',
    });

    expect(hint.description).toBe('Add missing dependency');
    expect(hint.patch).toEqual({ op: 'addDep' });
  });

  it('should create hint with confidence', () => {
    const hint = createPatchHint(
      'Fix cycle',
      { op: 'removeFragment' },
      { confidence: 0.85 }
    );

    expect(hint.confidence).toBe(0.85);
  });

  it('should create hint with rationale', () => {
    const hint = createPatchHint(
      'Rename path',
      { op: 'renamePath' },
      { rationale: 'Path follows old naming convention' }
    );

    expect(hint.rationale).toBe('Path follows old naming convention');
  });

  it('should create hint with recommended flag', () => {
    const hint = createPatchHint(
      'Apply suggested fix',
      { op: 'replaceExpr' },
      { recommended: true }
    );

    expect(hint.recommended).toBe(true);
  });

  it('should create hint with all options', () => {
    const hint = createPatchHint(
      'Complete fix',
      { op: 'addDep' },
      {
        confidence: 0.95,
        rationale: 'Detected missing dependency from expression analysis',
        recommended: true,
      }
    );

    expect(hint.description).toBe('Complete fix');
    expect(hint.confidence).toBe(0.95);
    expect(hint.rationale).toBe('Detected missing dependency from expression analysis');
    expect(hint.recommended).toBe(true);
  });
});

// ============================================================================
// Alias Patch Operations
// ============================================================================

describe('applyAliasOp', () => {
  it('should create applyAlias operation', () => {
    const op = applyAliasOp('alias_123', 'codebook_456');

    expect(op.op).toBe('applyAlias');
    expect(op).toHaveProperty('aliasId', 'alias_123');
    expect(op).toHaveProperty('codebookId', 'codebook_456');
  });
});

describe('rejectAliasOp', () => {
  it('should create rejectAlias operation without reason', () => {
    const op = rejectAliasOp('alias_123', 'codebook_456');

    expect(op.op).toBe('rejectAlias');
    expect(op).toHaveProperty('aliasId', 'alias_123');
    expect(op).toHaveProperty('codebookId', 'codebook_456');
    expect((op as any).reason).toBeUndefined();
  });

  it('should create rejectAlias operation with reason', () => {
    const op = rejectAliasOp('alias_123', 'codebook_456', 'Alias is incorrect');

    expect(op.op).toBe('rejectAlias');
    expect((op as any).reason).toBe('Alias is incorrect');
  });
});

describe('addAliasOp', () => {
  it('should create addAlias operation without rationale', () => {
    const op = addAliasOp(
      'user.name' as SemanticPath,
      'data.profile.firstName' as SemanticPath,
      'codebook_1'
    );

    expect(op.op).toBe('addAlias');
    expect(op).toHaveProperty('aliasPath', 'user.name');
    expect(op).toHaveProperty('canonicalPath', 'data.profile.firstName');
    expect(op).toHaveProperty('codebookId', 'codebook_1');
    expect((op as any).rationale).toBeUndefined();
  });

  it('should create addAlias operation with rationale', () => {
    const op = addAliasOp(
      'email' as SemanticPath,
      'data.contact.emailAddress' as SemanticPath,
      'codebook_1',
      'Shorthand for common field'
    );

    expect((op as any).rationale).toBe('Shorthand for common field');
  });
});

describe('removeAliasOp', () => {
  it('should create removeAlias operation', () => {
    const op = removeAliasOp('alias_to_remove', 'codebook_123');

    expect(op.op).toBe('removeAlias');
    expect(op).toHaveProperty('aliasId', 'alias_to_remove');
    expect(op).toHaveProperty('codebookId', 'codebook_123');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  describe('Operation immutability', () => {
    it('should not share references between operations', () => {
      const fragment1 = createTestFragment();
      const fragment2 = createTestFragment();
      fragment2.id = 'different_id';

      const op1 = addFragmentOp(fragment1);
      const op2 = addFragmentOp(fragment2);

      expect((op1 as any).fragment.id).not.toBe((op2 as any).fragment.id);
    });
  });

  describe('Special characters in IDs', () => {
    it('should handle special characters in fragment IDs', () => {
      const op = removeFragmentOp('frag-with_special.chars:123');
      expect((op as any).fragmentId).toBe('frag-with_special.chars:123');
    });

    it('should handle unicode in descriptions', () => {
      const hint = createPatchHint('의존성 추가: 한글 설명', { op: 'addDep' });
      expect(hint.description).toBe('의존성 추가: 한글 설명');
    });
  });

  describe('Empty values', () => {
    it('should handle empty fragment ID', () => {
      const op = removeFragmentOp('');
      expect((op as any).fragmentId).toBe('');
    });

    it('should handle empty description in hint', () => {
      const hint = createPatchHint('', { op: 'replaceExpr' });
      expect(hint.description).toBe('');
    });
  });

  describe('Complex expressions', () => {
    it('should handle deeply nested expressions', () => {
      const expr: Expression = [
        'if',
        ['and',
          ['>', ['get', 'data.a'], 0],
          ['<', ['get', 'data.b'], 100],
        ],
        ['+', ['get', 'data.a'], ['get', 'data.b']],
        ['literal', 0],
      ];
      const op = replaceExprOp('frag_1', expr);

      expect((op as any).newExpr).toEqual(expr);
    });
  });

  describe('Patch creation timestamps', () => {
    it('should have consistent timestamps', () => {
      const before = Date.now();
      const patch = createPatch([], createTestProvenance());
      const after = Date.now();

      expect(patch.createdAt).toBeGreaterThanOrEqual(before);
      expect(patch.createdAt).toBeLessThanOrEqual(after);
    });
  });
});
