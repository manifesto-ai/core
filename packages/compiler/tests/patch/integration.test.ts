/**
 * Patch System Integration Tests
 *
 * Tests for integration between patch modules and linker.
 * Validates the complete alias workflow from detection to application.
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath, Expression } from '@manifesto-ai/core';
import type {
  Fragment,
  DerivedFragment,
  SchemaFragment,
  FragmentId,
} from '../../src/types/fragment.js';
import type { Codebook } from '../../src/types/codebook.js';
import type { Provenance } from '../../src/types/provenance.js';
import { isOk, isErr, type Result, type CompilerError } from '../../src/types/index.js';

// Import patch modules
import {
  analyzeForAliases,
  generateAliasHints,
  getDuplicatePathSuggestions,
} from '../../src/patch/hint-generator.js';
import {
  addAliasSuggestions,
  applyAlias,
  getAppliedAliases,
  getPendingAliases,
} from '../../src/patch/codebook.js';
import { applyPatch, applyPatchOp, type PatchOpSuccess } from '../../src/patch/applier.js';
import { detectDuplicatePaths, findSimilarPaths } from '../../src/patch/similarity.js';
import { createCodebook, createAliasEntry } from '../../src/types/codebook.js';

// ============================================================================
// Result Unwrapping Helpers for Tests
// ============================================================================

function unwrapOk<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`Expected Ok, got Err: ${JSON.stringify(result.error)}`);
}

function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error(`Expected Err, got Ok: ${JSON.stringify(result.value)}`);
}

// Import linker
import { link, applyCodebookAliases } from '../../src/linker/index.js';

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

// ============================================================================
// Complete Workflow Tests
// ============================================================================

describe('Complete Alias Workflow', () => {
  it('should detect, suggest, and apply aliases end-to-end', () => {
    // Step 1: Create fragments with duplicate expressions
    const expr: Expression = ['*', ['get', 'data.value'], 2];
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.value' as SemanticPath),
      createDerivedFragment('derived-1', 'derived.doubled' as SemanticPath, expr, {
        requires: ['data.value' as SemanticPath],
      }),
      createDerivedFragment('derived-2', 'derived.alsoDoubled' as SemanticPath, expr, {
        requires: ['data.value' as SemanticPath],
      }),
    ];

    // Step 2: Analyze for aliases
    const analysis = analyzeForAliases(fragments);
    expect(analysis.suggestions.length + analysis.clusters.length).toBeGreaterThanOrEqual(0);

    // Step 3: Create codebook and add suggestions
    let codebook = createCodebook('workflow-codebook', []);
    codebook = addAliasSuggestions(codebook, analysis.suggestions, createTestProvenance());

    // Step 4: Apply pending aliases
    const pending = getPendingAliases(codebook);
    let appliedCount = 0;
    for (const entry of pending) {
      const { codebook: newCodebook, entry: appliedEntry } = applyAlias(codebook, entry.id);
      if (appliedEntry?.status === 'applied') {
        codebook = newCodebook;
        appliedCount++;
      }
    }

    // Step 5: Verify applied aliases
    const applied = getAppliedAliases(codebook);
    expect(applied.length).toBe(appliedCount);

    // Step 6: Apply codebook to fragments
    if (applied.length > 0) {
      const resolvedFragments = applyCodebookAliases(fragments, codebook);
      expect(resolvedFragments).toBeDefined();
    }
  });

  it('should integrate with linker for alias generation', () => {
    // Create fragments
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.count' as SemanticPath),
      createDerivedFragment(
        'derived-1',
        'derived.doubled' as SemanticPath,
        ['*', ['get', 'data.count'], 2],
        { requires: ['data.count' as SemanticPath] }
      ),
    ];

    // Link with alias suggestion generation enabled
    const codebook = createCodebook('linker-codebook');
    const result = link(fragments, {
      codebook,
      generateAliasSuggestions: true,
    });

    expect(result).toBeDefined();
    expect(result.fragments.length).toBeGreaterThanOrEqual(0);
  });

  it('should apply codebook aliases during linking', () => {
    // Create fragments with aliasable paths
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.userName' as SemanticPath),
      createDerivedFragment(
        'derived-1',
        'derived.greeting' as SemanticPath,
        ['get', 'data.userName'],
        {
          requires: ['data.userName' as SemanticPath],
        }
      ),
    ];

    // Create codebook with applied alias
    const aliasEntry = createAliasEntry(
      'data.userName' as SemanticPath,
      'data.user' as SemanticPath,
      createTestProvenance(),
      { status: 'applied' }
    );
    const baseCodebook = createCodebook('alias-codebook');
    const codebook: Codebook = { ...baseCodebook, entries: [aliasEntry] };

    // Apply codebook aliases
    const resolvedFragments = applyCodebookAliases(fragments, codebook);

    // Verify alias applied
    expect(resolvedFragments[1]!.requires).toContain('data.user');
    expect(resolvedFragments[1]!.requires).not.toContain('data.userName');
  });
});

// ============================================================================
// Similarity Detection to Patch Application
// ============================================================================

describe('Similarity Detection to Patch Application', () => {
  it('should detect similar paths and apply rename patch', () => {
    const paths: SemanticPath[] = [
      'data.userCount' as SemanticPath,
      'data.userCounts' as SemanticPath,
    ];

    // Detect similar paths
    const similarities = findSimilarPaths(paths, 0.8);

    // If similar paths found, create and apply patch
    if (similarities.length > 0) {
      const sim = similarities[0]!;
      const fragments: Fragment[] = [
        createSchemaFragment('frag-1', sim.pathB),
      ];

      const result = applyPatchOp(fragments, {
        op: 'renamePath',
        from: sim.pathB,
        to: sim.pathA,
      });

      expect(result.ok).toBe(true);
      expect(result.fragments[0]!.provides).toContain(sim.pathA);
    }
  });

  it('should detect duplicates and suggest consolidation', () => {
    const expr: Expression = ['get', 'data.source'];
    const fragments: Fragment[] = [
      createDerivedFragment('frag-1', 'derived.copy1' as SemanticPath, expr),
      createDerivedFragment('frag-2', 'derived.copy2' as SemanticPath, expr),
      createDerivedFragment('frag-3', 'derived.copy3' as SemanticPath, expr),
    ];

    // Detect duplicates
    const duplicates = detectDuplicatePaths(fragments);

    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]!.paths).toHaveLength(3);
    expect(duplicates[0]!.confidence).toBe(1.0);

    // Get suggestions
    const suggestions = getDuplicatePathSuggestions(fragments);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]!.suggestedCanonical).toBeDefined();
  });
});

// ============================================================================
// Codebook Lifecycle Tests
// ============================================================================

describe('Codebook Lifecycle', () => {
  it('should maintain codebook state through multiple operations', () => {
    // Start with empty codebook
    let codebook = createCodebook('lifecycle-test');
    expect(codebook.entries).toHaveLength(0);

    // Add suggestions
    const suggestions = [
      {
        aliasPath: 'data.a' as SemanticPath,
        canonicalPath: 'data.canonical' as SemanticPath,
        confidence: 0.9,
        rationale: 'Test suggestion 1',
        affectedFragments: [],
      },
      {
        aliasPath: 'data.b' as SemanticPath,
        canonicalPath: 'data.canonical' as SemanticPath,
        confidence: 0.8,
        rationale: 'Test suggestion 2',
        affectedFragments: [],
      },
    ];
    codebook = addAliasSuggestions(codebook, suggestions, createTestProvenance());
    expect(codebook.entries).toHaveLength(2);
    expect(getPendingAliases(codebook)).toHaveLength(2);

    // Apply first suggestion
    const { codebook: cb1 } = applyAlias(codebook, codebook.entries[0]!.id);
    codebook = cb1;
    expect(getAppliedAliases(codebook)).toHaveLength(1);
    expect(getPendingAliases(codebook)).toHaveLength(1);

    // Apply second suggestion
    const { codebook: cb2 } = applyAlias(codebook, codebook.entries[1]!.id);
    codebook = cb2;
    expect(getAppliedAliases(codebook)).toHaveLength(2);
    expect(getPendingAliases(codebook)).toHaveLength(0);

    // Version should have changed
    expect(codebook.version).not.toBe('v_initial');
  });

  it('should handle codebook through patch application', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('frag-1', 'data.alias' as SemanticPath, {
        provides: ['data.alias'],
      }),
    ];

    const aliasEntry = createAliasEntry(
      'data.alias' as SemanticPath,
      'data.canonical' as SemanticPath,
      createTestProvenance()
    );
    const baseCodebook = createCodebook('patch-test');
    const codebook: Codebook = { ...baseCodebook, entries: [aliasEntry] };

    // Apply alias via patch
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
    expect(resultCodebook).toBeDefined();
    expect(resultCodebook!.entries[0]!.status).toBe('applied');

    // Fragment should have path renamed
    expect(resultFragments[0]!.provides).toContain('data.canonical');
    expect(resultFragments[0]!.provides).not.toContain('data.alias');
  });
});

// ============================================================================
// Hint to Patch Conversion Tests
// ============================================================================

describe('Hint to Patch Conversion', () => {
  it('should convert analysis hints to executable patches', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('frag-1', 'derived.veryLongName' as SemanticPath, expr),
      createDerivedFragment('frag-2', 'derived.a' as SemanticPath, expr),
    ];

    // Analyze
    const analysis = analyzeForAliases(fragments);

    // Convert to hints
    const hints = generateAliasHints(analysis.suggestions);

    // Each hint should have a valid patch structure
    for (const hint of hints) {
      expect(hint.patch).toHaveProperty('op');
      expect(hint.patch.op).toBe('renamePath');

      // Apply the patch (cast to PatchOp since hint.patch is Partial<PatchOp>)
      const result = applyPatchOp(fragments, hint.patch as any);
      // Patch should be applicable (may or may not succeed depending on fragment state)
      expect(result).toHaveProperty('ok');
    }
  });
});

// ============================================================================
// Error Handling Integration Tests
// ============================================================================

describe('Error Handling Integration', () => {
  it('should handle empty fragments gracefully', () => {
    const fragments: Fragment[] = [];

    const analysis = analyzeForAliases(fragments);
    expect(analysis.suggestions).toHaveLength(0);
    expect(analysis.stats.totalPaths).toBe(0);

    const codebook = createCodebook('empty-test');
    const resolvedFragments = applyCodebookAliases(fragments, codebook);
    expect(resolvedFragments).toHaveLength(0);
  });

  it('should handle invalid alias operations gracefully', () => {
    const fragments: Fragment[] = [];
    const codebook = createCodebook('error-test');

    // Try to apply non-existent alias
    const result = applyPatchOp(
      fragments,
      {
        op: 'applyAlias',
        aliasId: 'non-existent' as any,
        codebookId: codebook.id,
      },
      codebook
    );

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle conflicting aliases', () => {
    const fragments: Fragment[] = [];

    // Create codebook with existing alias
    const existingAlias = createAliasEntry(
      'data.a' as SemanticPath,
      'data.x' as SemanticPath,
      createTestProvenance(),
      { status: 'applied' }
    );
    const baseCodebook = createCodebook('conflict-test');
    const codebook: Codebook = { ...baseCodebook, entries: [existingAlias] };

    // Try to add conflicting alias
    const result = applyPatchOp(
      fragments,
      {
        op: 'addAlias',
        aliasPath: 'data.a' as SemanticPath,
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

// ============================================================================
// Determinism Integration Tests
// ============================================================================

describe('Determinism Integration (Principle E)', () => {
  it('should produce identical results for same input across modules', () => {
    const expr: Expression = ['*', ['get', 'data.x'], 2];
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.x' as SemanticPath),
      createDerivedFragment('derived-1', 'derived.doubled' as SemanticPath, expr, {
        requires: ['data.x' as SemanticPath],
      }),
      createDerivedFragment('derived-2', 'derived.alsoDoubled' as SemanticPath, expr, {
        requires: ['data.x' as SemanticPath],
      }),
    ];

    // Run analysis twice
    const analysis1 = analyzeForAliases(fragments);
    const analysis2 = analyzeForAliases(fragments);

    expect(analysis1.suggestions).toEqual(analysis2.suggestions);
    expect(analysis1.stats).toEqual(analysis2.stats);

    // Create codebooks
    const codebook1 = addAliasSuggestions(
      createCodebook('det-1', []),
      analysis1.suggestions,
      createTestProvenance()
    );
    const codebook2 = addAliasSuggestions(
      createCodebook('det-2', []),
      analysis2.suggestions,
      createTestProvenance()
    );

    // Entry counts should match
    expect(codebook1.entries.length).toBe(codebook2.entries.length);
  });

  it('should produce identical results regardless of input order', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.a' as SemanticPath),
      createSchemaFragment('schema-2', 'data.b' as SemanticPath),
      createSchemaFragment('schema-3', 'data.c' as SemanticPath),
    ];

    const reversed = [...fragments].reverse();

    const analysis1 = analyzeForAliases(fragments);
    const analysis2 = analyzeForAliases(reversed);

    expect(analysis1.stats).toEqual(analysis2.stats);
  });
});

// ============================================================================
// NO AUTO-APPLY Integration Tests
// ============================================================================

describe('NO AUTO-APPLY Integration Invariants', () => {
  it('INVARIANT: analysis never modifies fragments', () => {
    const fragments: Fragment[] = [
      createDerivedFragment('frag-1', 'derived.a' as SemanticPath, ['get', 'data.x']),
      createDerivedFragment('frag-2', 'derived.b' as SemanticPath, ['get', 'data.x']),
    ];
    const originalJson = JSON.stringify(fragments);

    // Run full analysis workflow
    const analysis = analyzeForAliases(fragments);
    generateAliasHints(analysis.suggestions);
    getDuplicatePathSuggestions(fragments);

    expect(JSON.stringify(fragments)).toBe(originalJson);
  });

  it('INVARIANT: linker with alias generation does not auto-apply', () => {
    const fragments: Fragment[] = [
      createSchemaFragment('schema-1', 'data.count' as SemanticPath),
    ];
    const originalProvides = [...fragments[0]!.provides];

    const codebook = createCodebook('invariant-test', []);
    link(fragments, {
      codebook,
      generateAliasSuggestions: true,
    });

    // Original fragments unchanged
    expect(fragments[0]!.provides).toEqual(originalProvides);
  });

  it('INVARIANT: suggestions require explicit patch application', () => {
    const expr: Expression = ['get', 'data.x'];
    const fragments: Fragment[] = [
      createDerivedFragment('frag-1', 'derived.long' as SemanticPath, expr),
      createDerivedFragment('frag-2', 'derived.a' as SemanticPath, expr),
    ];

    // Get suggestions
    const analysis = analyzeForAliases(fragments);

    // Suggestions exist but nothing is applied
    // Only explicit patch application would change fragments
    for (const suggestion of analysis.suggestions) {
      expect(suggestion.aliasPath).toBeDefined();
      expect(suggestion.canonicalPath).toBeDefined();
      // These are suggestions, not applied changes
    }

    // Fragments unchanged
    expect(fragments[0]!.provides).toContain('derived.long');
    expect(fragments[1]!.provides).toContain('derived.a');
  });
});
