/**
 * Patch Preview Tests
 *
 * Tests for dry-run patch analysis in src/patch/preview.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import { previewPatch, type PatchPreviewResult } from '../../src/patch/preview.js';
import type { Fragment, DerivedFragment } from '../../src/types/fragment.js';
import type { Patch, PatchOp } from '../../src/types/patch.js';
import type { Codebook } from '../../src/types/codebook.js';
import { generatedOrigin } from '../../src/types/provenance.js';
import { createCodebook, createAliasEntry } from '../../src/types/codebook.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestProvenance() {
  return {
    artifactId: 'test-artifact',
    location: generatedOrigin('test'),
    createdAt: Date.now(),
  };
}

function createDerivedFragment(
  id: string,
  path: SemanticPath,
  requires: SemanticPath[] = [],
  provides: SemanticPath[] = []
): DerivedFragment {
  return {
    id,
    kind: 'DerivedFragment',
    path,
    deps: requires,
    expr: ['literal', 0] as Expression,
    requires,
    provides: provides.length > 0 ? provides : [path],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
  } as DerivedFragment;
}

function createSchemaFragment(id: string, provides: SemanticPath[] = []): Fragment {
  return {
    id,
    kind: 'SchemaFragment',
    requires: [],
    provides,
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [],
  } as any;
}

function createSourceFragment(
  id: string,
  path: SemanticPath,
  provides: SemanticPath[] = []
): Fragment {
  return {
    id,
    kind: 'SourceFragment',
    path,
    requires: [],
    provides: provides.length > 0 ? provides : [path],
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
  } as any;
}

function createPatch(ops: PatchOp[]): Patch {
  return {
    id: `patch_${Date.now()}`,
    ops,
    origin: createTestProvenance(),
    createdAt: Date.now(),
  };
}

// ============================================================================
// previewPatch - replaceExpr
// ============================================================================

describe('previewPatch - replaceExpr', () => {
  it('should succeed for valid DerivedFragment', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived_1', 'derived.total' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'derived_1', newExpr: ['literal', 42] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('derived_1');
    expect(result.affectedPaths).toContain('derived.total');
    expect(result.errors).toHaveLength(0);
  });

  it('should fail for non-existent fragment', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'missing', newExpr: ['literal', 0] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors).toContain('Fragment not found: missing');
  });

  it('should fail for non-DerivedFragment', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('schema_1', ['data.x' as SemanticPath]),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'schema_1', newExpr: ['literal', 0] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Cannot replace expression on');
  });
});

// ============================================================================
// previewPatch - addDep / removeDep
// ============================================================================

describe('previewPatch - addDep/removeDep', () => {
  it('should succeed for valid DerivedFragment path', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('derived_1', 'derived.total' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'addDep', derivedPath: 'derived.total' as SemanticPath, dep: 'data.price' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('derived_1');
    expect(result.affectedPaths).toContain('derived.total');
  });

  it('should fail for non-existent DerivedFragment', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'addDep', derivedPath: 'derived.missing' as SemanticPath, dep: 'data.x' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('DerivedFragment not found');
  });

  it('should work with removeDep operation', () => {
    const fragments: Fragment[] = [
      createDerivedFragment(
        'derived_1',
        'derived.total' as SemanticPath,
        ['data.price' as SemanticPath]
      ),
    ];

    const patch = createPatch([
      { op: 'removeDep', derivedPath: 'derived.total' as SemanticPath, dep: 'data.price' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('derived_1');
  });
});

// ============================================================================
// previewPatch - renamePath
// ============================================================================

describe('previewPatch - renamePath', () => {
  it('should find all affected fragments', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'data.oldName' as SemanticPath, ['data.oldName' as SemanticPath]),
      createDerivedFragment(
        'derived_1',
        'derived.total' as SemanticPath,
        ['data.oldName' as SemanticPath]
      ),
    ];

    const patch = createPatch([
      { op: 'renamePath', from: 'data.oldName' as SemanticPath, to: 'data.newName' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('source_1');
    expect(result.affectedFragments).toContain('derived_1');
    expect(result.affectedPaths).toContain('data.oldName');
    expect(result.affectedPaths).toContain('data.newName');
  });

  it('should fail when renaming path to itself', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'renamePath', from: 'data.same' as SemanticPath, to: 'data.same' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Cannot rename path to itself');
  });
});

// ============================================================================
// previewPatch - removeFragment
// ============================================================================

describe('previewPatch - removeFragment', () => {
  it('should succeed and warn about dependents', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'data.price' as SemanticPath, ['data.price' as SemanticPath]),
      createDerivedFragment(
        'derived_1',
        'derived.total' as SemanticPath,
        ['data.price' as SemanticPath]
      ),
    ];

    const patch = createPatch([
      { op: 'removeFragment', fragmentId: 'source_1' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('source_1');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('dependents');
  });

  it('should fail for non-existent fragment', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'removeFragment', fragmentId: 'missing' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Fragment not found');
  });

  it('should succeed without warning when no dependents', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'data.unused' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'removeFragment', fragmentId: 'source_1' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });
});

// ============================================================================
// previewPatch - chooseConflict
// ============================================================================

describe('previewPatch - chooseConflict', () => {
  it('should find all conflicting fragments', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'data.value' as SemanticPath, ['data.value' as SemanticPath]),
      createSourceFragment('source_2', 'data.value' as SemanticPath, ['data.value' as SemanticPath]),
    ];

    const patch = createPatch([
      { op: 'chooseConflict', conflictId: 'conflict_1', chosenFragmentId: 'source_1' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('source_1');
    expect(result.affectedFragments).toContain('source_2');
  });

  it('should fail for non-existent chosen fragment', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'chooseConflict', conflictId: 'c1', chosenFragmentId: 'missing' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Chosen fragment not found');
  });
});

// ============================================================================
// previewPatch - addFragment
// ============================================================================

describe('previewPatch - addFragment', () => {
  it('should succeed for new fragment', () => {
    const fragments: Fragment[] = [];
    const newFragment = createSourceFragment('new_source', 'data.new' as SemanticPath);

    const patch = createPatch([
      { op: 'addFragment', fragment: newFragment },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('new_source');
  });

  it('should fail when fragment ID already exists', () => {
    const existingFragment = createSourceFragment('existing', 'data.x' as SemanticPath);
    const fragments: Fragment[] = [existingFragment];

    const patch = createPatch([
      { op: 'addFragment', fragment: existingFragment },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('already exists');
  });
});

// ============================================================================
// previewPatch - Alias Operations
// ============================================================================

describe('previewPatch - Alias Operations', () => {
  it('should fail applyAlias without codebook', () => {
    const fragments: Fragment[] = [];

    const patch = createPatch([
      { op: 'applyAlias', aliasId: 'alias_1', codebookId: 'cb_1' },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Codebook required');
  });

  it('should fail with codebook ID mismatch', () => {
    const fragments: Fragment[] = [];
    const codebook = createCodebook('Test Codebook');

    const patch = createPatch([
      { op: 'applyAlias', aliasId: 'alias_1', codebookId: 'wrong_id' },
    ]);

    const result = previewPatch(fragments, patch, codebook);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors[0]).toContain('Codebook ID mismatch');
  });

  it('should succeed with addAlias and valid codebook', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'user.name' as SemanticPath, ['user.name' as SemanticPath]),
    ];
    const codebook = createCodebook('Test');

    const patch = createPatch([
      {
        op: 'addAlias',
        aliasPath: 'user.name' as SemanticPath,
        canonicalPath: 'data.profile.firstName' as SemanticPath,
        codebookId: codebook.id,
      },
    ]);

    const result = previewPatch(fragments, patch, codebook);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedPaths).toContain('user.name');
    expect(result.affectedPaths).toContain('data.profile.firstName');
    expect(result.affectedFragments).toContain('source_1');
  });

  it('should handle applyAlias with existing alias entry', () => {
    const fragments: Fragment[] = [
      createSourceFragment('source_1', 'short.path' as SemanticPath, ['short.path' as SemanticPath]),
    ];
    const codebook = createCodebook('Test');
    const aliasEntry = createAliasEntry(
      'short.path' as SemanticPath,
      'very.long.canonical.path' as SemanticPath,
      createTestProvenance(),
      { status: 'suggested' }
    );
    codebook.entries.push(aliasEntry);

    const patch = createPatch([
      { op: 'applyAlias', aliasId: aliasEntry.id, codebookId: codebook.id },
    ]);

    const result = previewPatch(fragments, patch, codebook);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedPaths).toContain('short.path');
    expect(result.affectedPaths).toContain('very.long.canonical.path');
  });

  it('should handle rejectAlias operation', () => {
    const fragments: Fragment[] = [];
    const codebook = createCodebook('Test');

    const patch = createPatch([
      { op: 'rejectAlias', aliasId: 'alias_1', codebookId: codebook.id },
    ]);

    const result = previewPatch(fragments, patch, codebook);

    expect(result.wouldSucceed).toBe(true);
  });

  it('should handle removeAlias operation', () => {
    const fragments: Fragment[] = [];
    const codebook = createCodebook('Test');

    const patch = createPatch([
      { op: 'removeAlias', aliasId: 'alias_1', codebookId: codebook.id },
    ]);

    const result = previewPatch(fragments, patch, codebook);

    expect(result.wouldSucceed).toBe(true);
  });
});

// ============================================================================
// previewPatch - Multiple Operations
// ============================================================================

describe('previewPatch - Multiple Operations', () => {
  it('should aggregate results from multiple operations', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('d1', 'derived.a' as SemanticPath),
      createDerivedFragment('d2', 'derived.b' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'd1', newExpr: ['literal', 1] },
      { op: 'replaceExpr', fragmentId: 'd2', newExpr: ['literal', 2] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toContain('d1');
    expect(result.affectedFragments).toContain('d2');
    expect(result.affectedPaths).toContain('derived.a');
    expect(result.affectedPaths).toContain('derived.b');
  });

  it('should fail if any operation fails', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('d1', 'derived.a' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'd1', newExpr: ['literal', 1] },
      { op: 'replaceExpr', fragmentId: 'missing', newExpr: ['literal', 2] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // But should still record the successful operation's effects
    expect(result.affectedFragments).toContain('d1');
  });

  it('should deduplicate affected fragments and paths', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('d1', 'derived.a' as SemanticPath, ['data.shared' as SemanticPath]),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'd1', newExpr: ['literal', 1] },
      { op: 'addDep', derivedPath: 'derived.a' as SemanticPath, dep: 'data.new' as SemanticPath },
    ]);

    const result = previewPatch(fragments, patch);

    // d1 should only appear once even though both ops affect it
    const d1Count = result.affectedFragments.filter((id) => id === 'd1').length;
    expect(d1Count).toBe(1);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty patch', () => {
    const fragments: Fragment[] = [createSchemaFragment('s1')];
    const patch = createPatch([]);

    const result = previewPatch(fragments, patch);

    expect(result.wouldSucceed).toBe(true);
    expect(result.affectedFragments).toHaveLength(0);
    expect(result.affectedPaths).toHaveLength(0);
  });

  it('should handle empty fragments list', () => {
    const patch = createPatch([
      { op: 'addFragment', fragment: createSchemaFragment('new') },
    ]);

    const result = previewPatch([], patch);

    expect(result.wouldSucceed).toBe(true);
  });

  it('should sort affected fragments and paths', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('z_frag', 'z.path' as SemanticPath),
      createDerivedFragment('a_frag', 'a.path' as SemanticPath),
    ];

    const patch = createPatch([
      { op: 'replaceExpr', fragmentId: 'z_frag', newExpr: ['literal', 1] },
      { op: 'replaceExpr', fragmentId: 'a_frag', newExpr: ['literal', 2] },
    ]);

    const result = previewPatch(fragments, patch);

    expect(result.affectedFragments[0]).toBe('a_frag');
    expect(result.affectedFragments[1]).toBe('z_frag');
    expect(result.affectedPaths[0]).toBe('a.path');
    expect(result.affectedPaths[1]).toBe('z.path');
  });
});
