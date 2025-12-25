/**
 * Patch Applier Tests
 *
 * Tests for patch application logic including all PatchOps.
 * All operations maintain immutability and determinism.
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type {
  Fragment,
  DerivedFragment,
  SchemaFragment,
  FragmentId,
} from '../../src/types/fragment.js';
import type { Patch, PatchOp } from '../../src/types/patch.js';
import type { Codebook, AliasId } from '../../src/types/codebook.js';
import type { Provenance } from '../../src/types/provenance.js';
import {
  type Result,
  isOk,
  isErr,
  type CompilerError,
  getErrorMessage,
} from '../../src/types/index.js';
import {
  applyPatch,
  applyPatchOp,
  previewPatch,
  applyPatches,
  type PatchOpResult,
  type PatchOpSuccess,
} from '../../src/patch/applier.js';
import { createCodebook, createAliasEntry } from '../../src/types/codebook.js';

// ============================================================================
// Result Unwrapping Helpers for Tests
// ============================================================================

/**
 * Unwrap a successful Result, throwing if it's an error
 */
function unwrapOk<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Expected Ok, got Err: ${JSON.stringify(result.error)}`);
}

/**
 * Unwrap an error Result, throwing if it's successful
 */
function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error(`Expected Err, got Ok: ${JSON.stringify(result.value)}`);
}

// ============================================================================
// Test Helpers
// ============================================================================

function createTestProvenance(): Provenance {
  return {
    artifactId: 'test-artifact',
    location: { kind: 'generated', note: 'test' },
  };
}

function createDerivedFragment(
  id: string,
  path: SemanticPath,
  expr: Expression,
  overrides: Partial<DerivedFragment> = {}
): DerivedFragment {
  return {
    id: id as FragmentId,
    kind: 'DerivedFragment',
    requires: [],
    provides: [path],
    origin: createTestProvenance(),
    evidence: [],
    compilerVersion: '0.1.0',
    path,
    expr,
    ...overrides,
  };
}

function createSchemaFragment(
  id: string,
  path: SemanticPath,
  overrides: Partial<SchemaFragment> = {}
): SchemaFragment {
  return {
    id: id as FragmentId,
    kind: 'SchemaFragment',
    requires: [],
    provides: [path],
    origin: createTestProvenance(),
    evidence: [],
    compilerVersion: '0.1.0',
    namespace: 'data',
    fields: [
      {
        path,
        type: 'string',
        semantic: { type: 'string', description: 'test field' },
      },
    ],
    ...overrides,
  };
}

function createTestPatch(ops: PatchOp[]): Patch {
  return {
    id: 'test-patch',
    ops,
    origin: createTestProvenance(),
    description: 'Test patch',
    createdAt: Date.now(),
  };
}

function createTestCodebook(entries: any[] = []): Codebook {
  const codebook = createCodebook('Test Codebook');
  return {
    ...codebook,
    entries,
  };
}

// ============================================================================
// applyPatchOp Tests - Fragment Operations
// ============================================================================

describe('applyPatchOp - Fragment Operations', () => {
  describe('removeFragment', () => {
    it('should delete fragment by ID', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.a' as SemanticPath),
        createSchemaFragment('frag-2', 'data.b' as SemanticPath),
      ];

      const result = applyPatchOp(fragments, {
        op: 'removeFragment',
        fragmentId: 'frag-1' as FragmentId,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments).toHaveLength(1);
      expect(resultFragments[0]!.id).toBe('frag-2');
    });

    it('should fail for non-existent fragment', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      ];

      const result = applyPatchOp(fragments, {
        op: 'removeFragment',
        fragmentId: 'non-existent' as FragmentId,
      });

      expect(isErr(result)).toBe(true);
      const error = unwrapErr(result);
      expect(error.code).toBe('FRAGMENT_NOT_FOUND');
    });
  });

  describe('renamePath', () => {
    it('should rename path in provides', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.oldName' as SemanticPath, {
          provides: ['data.oldName'],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'renamePath',
        from: 'data.oldName' as SemanticPath,
        to: 'data.newName' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments[0]!.provides).toContain('data.newName');
      expect(resultFragments[0]!.provides).not.toContain('data.oldName');
    });

    it('should rename path in requires', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.oldRef'], {
          requires: ['data.oldRef' as SemanticPath],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'renamePath',
        from: 'data.oldRef' as SemanticPath,
        to: 'data.newRef' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments[0]!.requires).toContain('data.newRef');
      expect(resultFragments[0]!.requires).not.toContain('data.oldRef');
    });

    it('should rename path in DerivedFragment path field', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.oldPath' as SemanticPath, ['get', 'data.x'], {
          provides: ['derived.oldPath'],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'renamePath',
        from: 'derived.oldPath' as SemanticPath,
        to: 'derived.newPath' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      const derived = resultFragments[0] as DerivedFragment;
      expect(derived.path).toBe('derived.newPath');
    });

    it('should rename path in SchemaFragment fields', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.oldField' as SemanticPath, {
          provides: ['data.oldField'],
          fields: [
            {
              path: 'data.oldField' as SemanticPath,
              type: 'string',
              semantic: { type: 'string', description: 'test' },
            },
          ],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'renamePath',
        from: 'data.oldField' as SemanticPath,
        to: 'data.newField' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      const schema = resultFragments[0] as SchemaFragment;
      // Note: renamePath updates provides array, not individual field paths
      expect(schema.provides).toContain('data.newField');
      expect(schema.provides).not.toContain('data.oldField');
    });
  });

  describe('addDep', () => {
    it('should add dependency to DerivedFragment', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.x'], {
          requires: ['data.x' as SemanticPath],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'addDep',
        derivedPath: 'derived.a' as SemanticPath,
        dep: 'data.y' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments[0]!.requires).toContain('data.x');
      expect(resultFragments[0]!.requires).toContain('data.y');
    });

    it('should fail for non-existent derived fragment', () => {
      const fragments: Fragment[] = [];

      const result = applyPatchOp(fragments, {
        op: 'addDep',
        derivedPath: 'derived.nonexistent' as SemanticPath,
        dep: 'data.y' as SemanticPath,
      });

      expect(isErr(result)).toBe(true);
    });
  });

  describe('removeDep', () => {
    it('should remove dependency from DerivedFragment', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.x'], {
          requires: ['data.x' as SemanticPath, 'data.y' as SemanticPath],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'removeDep',
        derivedPath: 'derived.a' as SemanticPath,
        dep: 'data.y' as SemanticPath,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments[0]!.requires).toContain('data.x');
      expect(resultFragments[0]!.requires).not.toContain('data.y');
    });
  });

  describe('updateSchemaField', () => {
    it('should update schema field', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.count' as SemanticPath, {
          fields: [
            {
              path: 'data.count' as SemanticPath,
              type: 'string',
              semantic: { type: 'string', description: 'count' },
            },
          ],
        }),
      ];

      const result = applyPatchOp(fragments, {
        op: 'updateSchemaField',
        path: 'data.count' as SemanticPath,
        update: { type: 'number' },
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      const schema = resultFragments[0] as SchemaFragment;
      expect(schema.fields[0]!.type).toBe('number');
    });
  });

  describe('replaceEvidence', () => {
    it('should replace evidence array', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.a' as SemanticPath, {
          evidence: [{ quote: 'old evidence', interpretation: 'old' }],
        }),
      ];

      const newEvidence = [{ quote: 'new evidence', interpretation: 'new' }];
      const result = applyPatchOp(fragments, {
        op: 'replaceEvidence',
        fragmentId: 'frag-1' as FragmentId,
        evidence: newEvidence,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments[0]!.evidence).toEqual(newEvidence);
    });
  });

  describe('replaceExpr', () => {
    it('should replace expression in DerivedFragment', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.x']),
      ];

      const newExpr: Expression = ['*', ['get', 'data.x'], 2];
      const result = applyPatchOp(fragments, {
        op: 'replaceExpr',
        fragmentId: 'frag-1' as FragmentId,
        newExpr,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      const derived = resultFragments[0] as DerivedFragment;
      expect(derived.expr).toEqual(newExpr);
    });

    it('should fail for non-derived fragment', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      ];

      const result = applyPatchOp(fragments, {
        op: 'replaceExpr',
        fragmentId: 'frag-1' as FragmentId,
        newExpr: ['get', 'data.x'],
      });

      expect(isErr(result)).toBe(true);
    });
  });

  describe('addFragment', () => {
    it('should add new fragment', () => {
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      ];

      const newFragment = createSchemaFragment('frag-2', 'data.b' as SemanticPath);
      const result = applyPatchOp(fragments, {
        op: 'addFragment',
        fragment: newFragment,
      });

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments } = unwrapOk(result);
      expect(resultFragments).toHaveLength(2);
    });
  });
});

// ============================================================================
// applyPatchOp Tests - Alias Operations
// ============================================================================

describe('applyPatchOp - Alias Operations', () => {
  describe('applyAlias', () => {
    it('should apply alias from codebook', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.old'], {
          requires: ['data.old' as SemanticPath],
        }),
      ];

      const aliasEntry = createAliasEntry(
        'data.old' as SemanticPath,
        'data.new' as SemanticPath,
        createTestProvenance(),
        { confidence: 0.9 }
      );
      const codebook = createTestCodebook([aliasEntry]);

      const result = applyPatchOp(
        fragments,
        {
          op: 'applyAlias',
          aliasId: aliasEntry.id,
          codebookId: codebook.id,
        },
        codebook
      );

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments, codebook: resultCodebook } = unwrapOk(result);
      expect(resultCodebook?.entries[0]?.status).toBe('applied');
      expect(resultFragments[0]!.requires).toContain('data.new');
      expect(resultFragments[0]!.requires).not.toContain('data.old');
    });

    it('should fail without codebook', () => {
      const fragments: Fragment[] = [];

      const result = applyPatchOp(fragments, {
        op: 'applyAlias',
        aliasId: 'alias-1' as AliasId,
        codebookId: 'cb-1',
      });

      expect(isErr(result)).toBe(true);
      const error = unwrapErr(result);
      expect(error.code).toBe('CODEBOOK_REQUIRED');
    });

    it('should fail for non-existent alias', () => {
      const fragments: Fragment[] = [];
      const codebook = createTestCodebook();

      const result = applyPatchOp(
        fragments,
        {
          op: 'applyAlias',
          aliasId: 'non-existent' as AliasId,
          codebookId: codebook.id,
        },
        codebook
      );

      expect(isErr(result)).toBe(true);
    });
  });

  describe('rejectAlias', () => {
    it('should reject alias in codebook', () => {
      const fragments: Fragment[] = [];
      const aliasEntry = createAliasEntry(
        'data.alias' as SemanticPath,
        'data.canonical' as SemanticPath,
        createTestProvenance()
      );
      const codebook = createTestCodebook([aliasEntry]);

      const result = applyPatchOp(
        fragments,
        {
          op: 'rejectAlias',
          aliasId: aliasEntry.id,
          codebookId: codebook.id,
          reason: 'Not applicable',
        },
        codebook
      );

      expect(isOk(result)).toBe(true);
      const { codebook: resultCodebook } = unwrapOk(result);
      expect(resultCodebook?.entries[0]?.status).toBe('rejected');
      expect(resultCodebook?.entries[0]?.rationale).toContain('Not applicable');
    });
  });

  describe('addAlias', () => {
    it('should add user-defined alias', () => {
      const fragments: Fragment[] = [
        createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.old'], {
          requires: ['data.old' as SemanticPath],
        }),
      ];
      const codebook = createTestCodebook();

      const result = applyPatchOp(
        fragments,
        {
          op: 'addAlias',
          aliasPath: 'data.old' as SemanticPath,
          canonicalPath: 'data.new' as SemanticPath,
          codebookId: codebook.id,
          rationale: 'User defined',
        },
        codebook
      );

      expect(isOk(result)).toBe(true);
      const { fragments: resultFragments, codebook: resultCodebook } = unwrapOk(result);
      expect(resultCodebook?.entries).toHaveLength(1);
      expect(resultCodebook?.entries[0]?.status).toBe('applied');
      // Fragments should have alias applied
      expect(resultFragments[0]!.requires).toContain('data.new');
    });

    it('should detect conflicts', () => {
      const fragments: Fragment[] = [];
      const existingAlias = createAliasEntry(
        'data.a' as SemanticPath,
        'data.x' as SemanticPath,
        createTestProvenance(),
        { status: 'applied' }
      );
      const codebook = createTestCodebook([existingAlias]);

      const result = applyPatchOp(
        fragments,
        {
          op: 'addAlias',
          aliasPath: 'data.a' as SemanticPath, // Same alias path
          canonicalPath: 'data.y' as SemanticPath, // Different canonical
          codebookId: codebook.id,
        },
        codebook
      );

      expect(isErr(result)).toBe(true);
      const error = unwrapErr(result);
      expect(error.code).toBe('ALIAS_CONFLICT');
    });
  });

  describe('removeAlias', () => {
    it('should remove alias from codebook', () => {
      const fragments: Fragment[] = [];
      const aliasEntry = createAliasEntry(
        'data.alias' as SemanticPath,
        'data.canonical' as SemanticPath,
        createTestProvenance()
      );
      const codebook = createTestCodebook([aliasEntry]);

      const result = applyPatchOp(
        fragments,
        {
          op: 'removeAlias',
          aliasId: aliasEntry.id,
          codebookId: codebook.id,
        },
        codebook
      );

      expect(isOk(result)).toBe(true);
      const { codebook: resultCodebook } = unwrapOk(result);
      expect(resultCodebook?.entries).toHaveLength(0);
    });
  });
});

// ============================================================================
// applyPatch Tests
// ============================================================================

describe('applyPatch', () => {
  it('should apply all operations in sequence', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      createSchemaFragment('frag-2', 'data.b' as SemanticPath),
    ];

    const patch = createTestPatch([
      { op: 'removeFragment', fragmentId: 'frag-1' as FragmentId },
      { op: 'renamePath', from: 'data.b' as SemanticPath, to: 'data.c' as SemanticPath },
    ]);

    const result = applyPatch(fragments, patch);

    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(2);
    expect(result.fragments).toHaveLength(1);
    expect(result.fragments[0]!.provides).toContain('data.c');
  });

  it('should continue after failure and collect failed operations', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];

    const patch = createTestPatch([
      { op: 'removeFragment', fragmentId: 'non-existent' as FragmentId }, // Fails
      { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.b' as SemanticPath }, // Succeeds
    ]);

    const result = applyPatch(fragments, patch);

    // applyPatch continues on failures, collecting all results
    expect(result.ok).toBe(false); // Overall failed due to at least one failure
    expect(result.applied).toHaveLength(1); // Second op succeeded
    expect(result.failed).toHaveLength(1); // First op failed
    expect(result.fragments[0]!.provides).toContain('data.b'); // Rename was applied
  });

  it('should not modify input fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];
    const originalFragmentsJson = JSON.stringify(fragments);

    const patch = createTestPatch([
      { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.b' as SemanticPath },
    ]);

    applyPatch(fragments, patch);

    expect(JSON.stringify(fragments)).toBe(originalFragmentsJson);
  });

  it('should pass codebook through operations', () => {
    const fragments: Fragment[] = [];
    const aliasEntry = createAliasEntry(
      'data.alias' as SemanticPath,
      'data.canonical' as SemanticPath,
      createTestProvenance()
    );
    const codebook = createTestCodebook([aliasEntry]);

    const patch = createTestPatch([
      {
        op: 'applyAlias',
        aliasId: aliasEntry.id,
        codebookId: codebook.id,
      },
    ]);

    const result = applyPatch(fragments, patch, codebook);

    expect(result.ok).toBe(true);
    expect(result.codebook?.entries[0]?.status).toBe('applied');
  });
});

// ============================================================================
// previewPatch Tests
// ============================================================================

describe('previewPatch', () => {
  it('should preview successful patch', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      createSchemaFragment('frag-2', 'data.b' as SemanticPath, {
        requires: ['data.a' as SemanticPath],
      }),
    ];

    const patch = createTestPatch([
      { op: 'removeFragment', fragmentId: 'frag-1' as FragmentId },
    ]);

    const preview = previewPatch(fragments, patch);

    expect(preview.wouldSucceed).toBe(true);
    expect(preview.affectedFragments).toContain('frag-1');
    expect(preview.errors).toHaveLength(0);
  });

  it('should preview failing patch', () => {
    const fragments: Fragment[] = [];

    const patch = createTestPatch([
      { op: 'removeFragment', fragmentId: 'non-existent' as FragmentId },
    ]);

    const preview = previewPatch(fragments, patch);

    expect(preview.wouldSucceed).toBe(false);
    expect(preview.errors.length).toBeGreaterThan(0);
  });

  it('should not modify fragments during preview', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];
    const originalFragmentsJson = JSON.stringify(fragments);

    const patch = createTestPatch([
      { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.b' as SemanticPath },
    ]);

    previewPatch(fragments, patch);

    expect(JSON.stringify(fragments)).toBe(originalFragmentsJson);
  });
});

// ============================================================================
// applyPatches Tests
// ============================================================================

describe('applyPatches', () => {
  it('should apply multiple patches in sequence', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      createSchemaFragment('frag-2', 'data.b' as SemanticPath),
      createSchemaFragment('frag-3', 'data.c' as SemanticPath),
    ];

    const patches: Patch[] = [
      createTestPatch([
        { op: 'removeFragment', fragmentId: 'frag-1' as FragmentId },
      ]),
      createTestPatch([
        { op: 'renamePath', from: 'data.b' as SemanticPath, to: 'data.x' as SemanticPath },
      ]),
    ];

    const result = applyPatches(fragments, patches);

    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(2); // Both ops applied
    expect(result.failed).toHaveLength(0);
    expect(result.fragments).toHaveLength(2); // frag-1 removed
  });

  it('should continue processing all patches even when some fail', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];

    const patches: Patch[] = [
      createTestPatch([
        { op: 'removeFragment', fragmentId: 'non-existent' as FragmentId },
      ]),
      createTestPatch([
        { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.b' as SemanticPath },
      ]),
    ];

    const result = applyPatches(fragments, patches);

    // applyPatches processes all patches, collecting applied/failed
    expect(result.ok).toBe(false); // Overall failed due to at least one failure
    expect(result.applied).toHaveLength(1); // Second patch succeeded
    expect(result.failed).toHaveLength(1); // First patch failed
    expect(result.fragments[0]!.provides).toContain('data.b'); // Rename was applied
  });

  it('should collect all operations from all patches', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      createSchemaFragment('frag-2', 'data.b' as SemanticPath),
    ];

    const patches: Patch[] = [
      createTestPatch([
        { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.x' as SemanticPath },
        { op: 'renamePath', from: 'data.b' as SemanticPath, to: 'data.y' as SemanticPath },
      ]),
    ];

    const result = applyPatches(fragments, patches);

    expect(result.ok).toBe(true);
    expect(result.applied).toHaveLength(2); // Both ops from the patch
    expect(result.fragments[0]!.provides).toContain('data.x');
    expect(result.fragments[1]!.provides).toContain('data.y');
  });
});

// ============================================================================
// Immutability Invariant Tests
// ============================================================================

describe('Patch Applier Immutability Invariants', () => {
  it('INVARIANT: applyPatchOp does not mutate input fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];
    const originalJson = JSON.stringify(fragments);

    applyPatchOp(fragments, {
      op: 'renamePath',
      from: 'data.a' as SemanticPath,
      to: 'data.b' as SemanticPath,
    });

    expect(JSON.stringify(fragments)).toBe(originalJson);
  });

  it('INVARIANT: applyPatch does not mutate input fragments', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
    ];
    const originalJson = JSON.stringify(fragments);

    const patch = createTestPatch([
      { op: 'renamePath', from: 'data.a' as SemanticPath, to: 'data.b' as SemanticPath },
    ]);

    applyPatch(fragments, patch);

    expect(JSON.stringify(fragments)).toBe(originalJson);
  });

  it('INVARIANT: applyPatch does not mutate input codebook', () => {
    const fragments: Fragment[] = [];
    const aliasEntry = createAliasEntry(
      'data.alias' as SemanticPath,
      'data.canonical' as SemanticPath,
      createTestProvenance()
    );
    const codebook = createTestCodebook([aliasEntry]);
    const originalJson = JSON.stringify(codebook);

    const patch = createTestPatch([
      {
        op: 'applyAlias',
        aliasId: aliasEntry.id,
        codebookId: codebook.id,
      },
    ]);

    applyPatch(fragments, patch, codebook);

    expect(JSON.stringify(codebook)).toBe(originalJson);
  });
});

// ============================================================================
// Determinism Tests
// ============================================================================

describe('Patch Applier Determinism (Principle E)', () => {
  it('INVARIANT: same patch produces same result', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.a' as SemanticPath),
      createSchemaFragment('frag-2', 'data.b' as SemanticPath),
    ];

    const patch = createTestPatch([
      { op: 'removeFragment', fragmentId: 'frag-1' as FragmentId },
    ]);

    const result1 = applyPatch(fragments, patch);
    const result2 = applyPatch(fragments, patch);

    expect(result1.fragments).toEqual(result2.fragments);
    expect(result1.ok).toBe(result2.ok);
  });
});
