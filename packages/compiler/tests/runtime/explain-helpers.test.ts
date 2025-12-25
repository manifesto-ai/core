/**
 * Explain Helpers Tests
 *
 * Tests for runtime-aided verification helpers in src/runtime/explain-helpers.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  findFragmentsForPath,
  findFragmentsRequiringPath,
  getFragmentById,
  generatePathSummary,
  generateStepExplanation,
  estimateStepImpact,
  generateBlockerExplanation,
  generateBlockerResolutions,
  computeFragmentImpact,
  findAffectedConflicts,
  analyzeIssueImpact,
  buildIssueExplanation,
  buildConflictExplanation,
  computeFragmentSummary,
  estimateContextTokens,
} from '../../src/runtime/explain-helpers.js';
import type { Fragment, DerivedFragment } from '../../src/types/fragment.js';
import type { Issue } from '../../src/types/issue.js';
import type { Conflict } from '../../src/types/conflict.js';
import type {
  NextStep,
  Blocker,
  CompilerSessionSnapshot,
} from '../../src/types/session.js';
import { generatedOrigin } from '../../src/types/provenance.js';

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

function createFragment(
  id: string,
  kind: string,
  requires: SemanticPath[] = [],
  provides: SemanticPath[] = []
): Fragment {
  return {
    id,
    kind: kind as any,
    requires,
    provides,
    origin: createTestProvenance(),
    evidence: [],
    confidence: 1.0,
    compilerVersion: '0.1.0',
  } as Fragment;
}

function createIssue(
  id: string,
  code: string,
  path?: SemanticPath,
  relatedFragments?: string[]
): Issue {
  return {
    id,
    code: code as any,
    severity: 'error',
    message: `Test issue: ${code}`,
    path,
    relatedFragments,
  };
}

function createConflict(
  id: string,
  target: string,
  candidates: string[],
  type: 'duplicate_provides' | 'schema_mismatch' | 'semantic_mismatch' = 'duplicate_provides'
): Conflict {
  return {
    id,
    target,
    type,
    candidates,
    message: `Conflict on ${target}`,
  };
}

// ============================================================================
// Fragment Lookup Helpers
// ============================================================================

describe('findFragmentsForPath', () => {
  it('should find fragments that provide a path', () => {
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment', [], ['data.a' as SemanticPath]),
      createFragment('f2', 'SourceFragment', [], ['data.b' as SemanticPath]),
      createFragment('f3', 'SourceFragment', [], ['data.a' as SemanticPath]),
    ];

    const result = findFragmentsForPath(fragments, 'data.a' as SemanticPath);

    expect(result).toEqual(['f1', 'f3']);
  });

  it('should return empty array when no match', () => {
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment', [], ['data.x' as SemanticPath]),
    ];

    const result = findFragmentsForPath(fragments, 'data.y' as SemanticPath);

    expect(result).toEqual([]);
  });
});

describe('findFragmentsRequiringPath', () => {
  it('should find fragments that require a path', () => {
    const fragments: Fragment[] = [
      createFragment('f1', 'DerivedFragment', ['data.a' as SemanticPath], []),
      createFragment('f2', 'DerivedFragment', ['data.b' as SemanticPath], []),
      createFragment('f3', 'DerivedFragment', ['data.a' as SemanticPath, 'data.c' as SemanticPath], []),
    ];

    const result = findFragmentsRequiringPath(fragments, 'data.a' as SemanticPath);

    expect(result).toEqual(['f1', 'f3']);
  });
});

describe('getFragmentById', () => {
  it('should find fragment by ID', () => {
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment'),
      createFragment('f2', 'DerivedFragment'),
    ];

    const result = getFragmentById(fragments, 'f2');

    expect(result?.id).toBe('f2');
  });

  it('should return undefined for missing ID', () => {
    const fragments: Fragment[] = [createFragment('f1', 'SourceFragment')];

    const result = getFragmentById(fragments, 'missing');

    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Explanation Generation
// ============================================================================

describe('generatePathSummary', () => {
  it('should generate summary for source value', () => {
    const summary = generatePathSummary(
      'data.count' as SemanticPath,
      42,
      ['source_1'],
      false
    );

    expect(summary).toContain('data.count');
    expect(summary).toContain('42');
    expect(summary).toContain('source value');
  });

  it('should generate summary for derived value', () => {
    const summary = generatePathSummary(
      'derived.total' as SemanticPath,
      100,
      ['derived_1'],
      true
    );

    expect(summary).toContain('derived value');
  });

  it('should handle undefined value', () => {
    const summary = generatePathSummary(
      'data.x' as SemanticPath,
      undefined,
      [],
      false
    );

    expect(summary).toContain('undefined');
  });

  it('should truncate long object values', () => {
    const longObj = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10 };
    const summary = generatePathSummary(
      'data.obj' as SemanticPath,
      longObj,
      [],
      false
    );

    expect(summary).toContain('...');
  });

  it('should handle no fragments case', () => {
    const summary = generatePathSummary(
      'data.x' as SemanticPath,
      1,
      [],
      false
    );

    expect(summary).toContain('no fragments');
  });
});

describe('generateStepExplanation', () => {
  it('should explain applyPatch step', () => {
    const step: NextStep = {
      kind: 'applyPatch',
      patchHintId: 'h1',
      resolves: 'issue_1',
      rationale: 'Fix the issue',
    };

    const explanation = generateStepExplanation(step, [], [], []);

    expect(explanation).toContain('Apply patch');
    expect(explanation).toContain('issue_1');
  });

  it('should explain resolveConflict step', () => {
    const step: NextStep = {
      kind: 'resolveConflict',
      conflictId: 'c1',
      candidates: ['f1', 'f2'],
      rationale: 'Choose one',
    };
    const conflicts: Conflict[] = [createConflict('c1', 'data.x', ['f1', 'f2'])];

    const explanation = generateStepExplanation(step, [], [], conflicts);

    expect(explanation).toContain('Choose between');
    expect(explanation).toContain('2 fragments');
  });

  it('should explain fixIssue step', () => {
    const step: NextStep = {
      kind: 'fixIssue',
      issueId: 'i1',
      fragmentId: 'f1',
      rationale: 'Manual fix needed',
    };
    const issues: Issue[] = [createIssue('i1', 'MISSING_DEPENDENCY')];

    const explanation = generateStepExplanation(step, [], issues, []);

    expect(explanation).toContain('Fix');
    expect(explanation).toContain('MISSING_DEPENDENCY');
  });

  it('should explain addFragment step', () => {
    const step: NextStep = {
      kind: 'addFragment',
      requiredPath: 'data.missing',
      suggestedKind: 'SourceFragment',
      requestedBy: 'f1',
      rationale: 'Add source',
    };

    const explanation = generateStepExplanation(step, [], [], []);

    expect(explanation).toContain('Add SourceFragment');
    expect(explanation).toContain('data.missing');
  });

  it('should explain recompile step', () => {
    const step: NextStep = {
      kind: 'recompile',
      artifactId: 'art_1',
      affectedFragments: ['f1', 'f2'],
      reason: 'modified',
      rationale: 'Source changed',
    };

    const explanation = generateStepExplanation(step, [], [], []);

    expect(explanation).toContain('Recompile');
    expect(explanation).toContain('art_1');
  });

  it('should explain reviewDraft step', () => {
    const step: NextStep = {
      kind: 'reviewDraft',
      draftIndex: 0,
      confidence: 0.5,
      reason: 'lowConfidence',
      rationale: 'Needs review',
    };

    const explanation = generateStepExplanation(step, [], [], []);

    expect(explanation).toContain('Review draft');
    expect(explanation).toContain('0.5');
  });

  it('should explain confirmDomain step', () => {
    const step: NextStep = {
      kind: 'confirmDomain',
      domainHash: 'hash123',
      warningCount: 2,
      rationale: 'Ready',
    };

    const explanation = generateStepExplanation(step, [], [], []);

    expect(explanation).toContain('Confirm domain');
    expect(explanation).toContain('2 warnings');
  });
});

describe('estimateStepImpact', () => {
  it('should estimate impact for applyPatch', () => {
    const step: NextStep = {
      kind: 'applyPatch',
      patchHintId: 'h1',
      resolves: 'issue_1',
      rationale: 'Fix',
    };

    const impact = estimateStepImpact(step, []);

    expect(impact).toContain('Resolves: issue_1');
  });

  it('should estimate impact for resolveConflict', () => {
    const step: NextStep = {
      kind: 'resolveConflict',
      conflictId: 'c1',
      candidates: ['f1', 'f2', 'f3'],
      rationale: 'Choose',
    };

    const impact = estimateStepImpact(step, []);

    expect(impact.some((s) => s.includes('3 candidates'))).toBe(true);
  });

  it('should estimate impact for recompile', () => {
    const step: NextStep = {
      kind: 'recompile',
      artifactId: 'a1',
      affectedFragments: ['f1', 'f2'],
      reason: 'modified',
      rationale: 'Changed',
    };

    const impact = estimateStepImpact(step, []);

    expect(impact.some((s) => s.includes('2 fragments'))).toBe(true);
  });
});

// ============================================================================
// Blocker Explanation
// ============================================================================

describe('generateBlockerExplanation', () => {
  it('should explain issue blocker', () => {
    const blocker: Blocker = { kind: 'issue', id: 'i1', message: 'Blocked' };
    const issues: Issue[] = [createIssue('i1', 'CYCLIC_DEPENDENCY', 'data.x' as SemanticPath)];

    const explanation = generateBlockerExplanation(blocker, issues, []);

    expect(explanation).toContain('CYCLIC_DEPENDENCY');
    expect(explanation).toContain('data.x');
  });

  it('should explain conflict blocker', () => {
    const blocker: Blocker = { kind: 'conflict', id: 'c1', message: 'Blocked' };
    const conflicts: Conflict[] = [createConflict('c1', 'data.x', ['f1', 'f2'])];

    const explanation = generateBlockerExplanation(blocker, [], conflicts);

    expect(explanation).toContain('data.x');
    expect(explanation).toContain('2 candidates');
  });

  it('should fallback to message when not found', () => {
    const blocker: Blocker = { kind: 'issue', id: 'missing', message: 'Fallback message' };

    const explanation = generateBlockerExplanation(blocker, [], []);

    expect(explanation).toBe('Fallback message');
  });
});

describe('generateBlockerResolutions', () => {
  it('should suggest fix for issue with suggestedFix', () => {
    const blocker: Blocker = { kind: 'issue', id: 'i1', message: 'Blocked' };
    const issues: Issue[] = [{
      ...createIssue('i1', 'MISSING_DEPENDENCY'),
      suggestedFix: { description: 'Add source fragment', patch: {} as any },
    }];

    const resolutions = generateBlockerResolutions(blocker, issues, []);

    expect(resolutions.some((r) => r.includes('Apply suggested fix'))).toBe(true);
  });

  it('should suggest manual fix when no suggestedFix', () => {
    const blocker: Blocker = { kind: 'issue', id: 'i1', message: 'Blocked' };
    const issues: Issue[] = [createIssue('i1', 'INVALID_PATH')];

    const resolutions = generateBlockerResolutions(blocker, issues, []);

    expect(resolutions).toContain('Manual fix required');
  });

  it('should suggest candidates for conflict', () => {
    const blocker: Blocker = { kind: 'conflict', id: 'c1', message: 'Blocked' };
    const conflicts: Conflict[] = [createConflict('c1', 'data.x', ['f1', 'f2'])];

    const resolutions = generateBlockerResolutions(blocker, [], conflicts);

    expect(resolutions.some((r) => r.includes('f1'))).toBe(true);
    expect(resolutions.some((r) => r.includes('f2'))).toBe(true);
  });
});

// ============================================================================
// Impact Analysis
// ============================================================================

describe('computeFragmentImpact', () => {
  it('should compute direct and transitive impact', () => {
    const fragment = createFragment('f1', 'SourceFragment', [], ['data.a' as SemanticPath]);
    const allFragments: Fragment[] = [
      fragment,
      createFragment('f2', 'DerivedFragment', ['data.a' as SemanticPath], ['derived.b' as SemanticPath]),
      createFragment('f3', 'DerivedFragment', ['derived.b' as SemanticPath], ['derived.c' as SemanticPath]),
    ];

    const impact = computeFragmentImpact(fragment, allFragments);

    expect(impact.direct).toContain('data.a');
    expect(impact.transitive).toContain('derived.b');
  });
});

describe('findAffectedConflicts', () => {
  it('should find conflicts affected by provides', () => {
    const conflicts: Conflict[] = [
      createConflict('c1', 'data.a', ['f1', 'f2']),
      createConflict('c2', 'data.b', ['f3', 'f4']),
    ];

    const affected = findAffectedConflicts(conflicts, ['data.a']);

    expect(affected).toEqual(['c1']);
  });
});

describe('analyzeIssueImpact', () => {
  it('should identify issues that could be resolved', () => {
    const issues: Issue[] = [
      createIssue('i1', 'MISSING_DEPENDENCY', 'data.missing' as SemanticPath),
    ];
    const fragment = createFragment('f1', 'SourceFragment', [], ['data.missing' as SemanticPath]);

    const impact = analyzeIssueImpact(issues, fragment, ['data.missing' as SemanticPath]);

    expect(impact.some((i) => i.change === 'resolved')).toBe(true);
  });

  it('should identify issues related to fragment', () => {
    const issues: Issue[] = [
      createIssue('i1', 'INVALID_PATH', 'data.x' as SemanticPath, ['f1']),
    ];
    const fragment = createFragment('f1', 'SourceFragment');

    const impact = analyzeIssueImpact(issues, fragment, []);

    expect(impact.some((i) => i.issueId === 'i1')).toBe(true);
  });
});

// ============================================================================
// Issue & Conflict Explanation
// ============================================================================

describe('buildIssueExplanation', () => {
  it('should build explanation for MISSING_DEPENDENCY', () => {
    const issue = createIssue('i1', 'MISSING_DEPENDENCY', 'data.x' as SemanticPath, ['f1']);
    const fragments: Fragment[] = [
      createFragment('f1', 'DerivedFragment', ['data.x' as SemanticPath], ['derived.y' as SemanticPath]),
    ];

    const explanation = buildIssueExplanation(issue, fragments);

    expect(explanation.issue).toBe(issue);
    expect(explanation.reasoningChain.length).toBeGreaterThan(0);
    expect(explanation.summary).toContain('MISSING_DEPENDENCY');
  });

  it('should build explanation for CYCLIC_DEPENDENCY', () => {
    const issue = createIssue('i1', 'CYCLIC_DEPENDENCY');

    const explanation = buildIssueExplanation(issue, []);

    expect(explanation.reasoningChain.some((s) => s.step.includes('circular'))).toBe(true);
  });

  it('should build explanation for INVALID_PATH', () => {
    const issue = createIssue('i1', 'INVALID_PATH', 'bad..path' as SemanticPath);

    const explanation = buildIssueExplanation(issue, []);

    expect(explanation.reasoningChain.some((s) => s.step.includes('naming convention'))).toBe(true);
  });

  it('should include suggested fix when available', () => {
    const issue: Issue = {
      ...createIssue('i1', 'MISSING_DEPENDENCY'),
      suggestedFix: { description: 'Add source', patch: {} as any },
    };

    const explanation = buildIssueExplanation(issue, []);

    expect(explanation.suggestedFix).toBeDefined();
    expect(explanation.suggestedFix?.patch).toBeDefined();
  });
});

describe('buildConflictExplanation', () => {
  it('should build explanation with candidate details', () => {
    const conflict = createConflict('c1', 'data.x', ['f1', 'f2']);
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment', [], ['data.x' as SemanticPath]),
      createFragment('f2', 'SourceFragment', [], ['data.x' as SemanticPath]),
    ];

    const explanation = buildConflictExplanation(conflict, fragments);

    expect(explanation.candidates).toHaveLength(2);
    expect(explanation.resolutionOptions).toHaveLength(2);
    expect(explanation.summary).toContain('data.x');
  });

  it('should explain schema_mismatch conflict', () => {
    const conflict = createConflict('c1', 'data.x', ['f1', 'f2'], 'schema_mismatch');

    const explanation = buildConflictExplanation(conflict, []);

    expect(explanation.conflictReason).toContain('incompatible schemas');
  });

  it('should explain semantic_mismatch conflict', () => {
    const conflict = createConflict('c1', 'data.x', ['f1', 'f2'], 'semantic_mismatch');

    const explanation = buildConflictExplanation(conflict, []);

    expect(explanation.conflictReason).toContain('semantic meanings');
  });
});

// ============================================================================
// Agent Context
// ============================================================================

describe('computeFragmentSummary', () => {
  it('should compute counts by kind and provenance', () => {
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment', [], ['data.a' as SemanticPath]),
      createFragment('f2', 'SourceFragment', [], ['data.b' as SemanticPath]),
      createFragment('f3', 'DerivedFragment', [], ['derived.c' as SemanticPath]),
    ];

    const summary = computeFragmentSummary(fragments);

    expect(summary.byKind['SourceFragment']).toBe(2);
    expect(summary.byKind['DerivedFragment']).toBe(1);
    expect(summary.byProvenance['generated']).toBe(3);
    expect(summary.totalPaths).toBe(3);
  });

  it('should handle empty fragments', () => {
    const summary = computeFragmentSummary([]);

    expect(summary.totalPaths).toBe(0);
    expect(Object.keys(summary.byKind)).toHaveLength(0);
  });
});

describe('estimateContextTokens', () => {
  it('should estimate tokens for context', () => {
    const snapshot: CompilerSessionSnapshot = {
      phase: 'idle',
      progress: { stage: 0, total: 0, message: '' },
      artifacts: [],
      fragmentsCount: 0,
      conflictsCount: 0,
      blockingIssuesCount: 0,
      blockers: [],
      nextSteps: [],
      timestamp: Date.now(),
    };
    const fragments: Fragment[] = [
      createFragment('f1', 'SourceFragment'),
    ];

    const tokens = estimateContextTokens(snapshot, fragments);

    expect(tokens).toBeGreaterThan(0);
    expect(typeof tokens).toBe('number');
  });
});
