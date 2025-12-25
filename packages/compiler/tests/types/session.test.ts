/**
 * Session Types Tests
 *
 * Tests for session helper functions and type guards in src/types/session.ts
 */

import { describe, it, expect } from 'vitest';
import {
  createInitialSnapshot,
  createLogEntry,
  generateLinkResultVersion,
  isNextStepApplyPatch,
  isNextStepResolveConflict,
  isNextStepFixIssue,
  isNextStepAddFragment,
  isNextStepRecompile,
  isNextStepReviewDraft,
  isNextStepConfirmDomain,
  type NextStep,
  type NextStepApplyPatch,
  type NextStepResolveConflict,
  type NextStepFixIssue,
  type NextStepAddFragment,
  type NextStepRecompile,
  type NextStepReviewDraft,
  type NextStepConfirmDomain,
} from '../../src/types/session.js';

// ============================================================================
// createInitialSnapshot
// ============================================================================

describe('createInitialSnapshot', () => {
  it('should create snapshot with initial values', () => {
    const snapshot = createInitialSnapshot(['artifact-1', 'artifact-2']);

    expect(snapshot.phase).toBe('idle');
    expect(snapshot.progress).toEqual({ stage: 0, total: 0, message: '' });
    expect(snapshot.artifacts).toEqual(['artifact-1', 'artifact-2']);
    expect(snapshot.fragmentsCount).toBe(0);
    expect(snapshot.conflictsCount).toBe(0);
    expect(snapshot.blockingIssuesCount).toBe(0);
    expect(snapshot.blockers).toEqual([]);
    expect(snapshot.nextSteps).toEqual([]);
    expect(typeof snapshot.timestamp).toBe('number');
  });

  it('should create snapshot with empty artifacts', () => {
    const snapshot = createInitialSnapshot([]);
    expect(snapshot.artifacts).toEqual([]);
  });

  it('should have current timestamp', () => {
    const before = Date.now();
    const snapshot = createInitialSnapshot([]);
    const after = Date.now();

    expect(snapshot.timestamp).toBeGreaterThanOrEqual(before);
    expect(snapshot.timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// createLogEntry
// ============================================================================

describe('createLogEntry', () => {
  it('should create log entry with required fields', () => {
    const entry = createLogEntry('info', 'Test message');

    expect(entry.level).toBe('info');
    expect(entry.message).toBe('Test message');
    expect(typeof entry.at).toBe('number');
    expect(entry.data).toBeUndefined();
  });

  it('should create log entry with data', () => {
    const data = { count: 5, items: ['a', 'b'] };
    const entry = createLogEntry('debug', 'Debug message', data);

    expect(entry.level).toBe('debug');
    expect(entry.message).toBe('Debug message');
    expect(entry.data).toEqual(data);
  });

  it('should handle all log levels', () => {
    const levels: Array<'debug' | 'info' | 'warn' | 'error'> = ['debug', 'info', 'warn', 'error'];

    for (const level of levels) {
      const entry = createLogEntry(level, `${level} message`);
      expect(entry.level).toBe(level);
    }
  });

  it('should have current timestamp', () => {
    const before = Date.now();
    const entry = createLogEntry('info', 'test');
    const after = Date.now();

    expect(entry.at).toBeGreaterThanOrEqual(before);
    expect(entry.at).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// generateLinkResultVersion
// ============================================================================

describe('generateLinkResultVersion', () => {
  it('should generate version with correct prefix', () => {
    const version = generateLinkResultVersion();
    expect(version).toMatch(/^link_\d+_[a-z0-9]+$/);
  });

  it('should generate unique versions', () => {
    const versions = new Set<string>();
    for (let i = 0; i < 100; i++) {
      versions.add(generateLinkResultVersion());
    }
    expect(versions.size).toBe(100);
  });

  it('should include timestamp', () => {
    const before = Date.now();
    const version = generateLinkResultVersion();
    const after = Date.now();

    const timestampPart = version.split('_')[1];
    const timestamp = parseInt(timestampPart, 10);

    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});

// ============================================================================
// NextStep Type Guards
// ============================================================================

describe('isNextStepApplyPatch', () => {
  it('should return true for applyPatch step', () => {
    const step: NextStepApplyPatch = {
      kind: 'applyPatch',
      patchHintId: 'hint_1',
      resolves: 'issue_1',
      rationale: 'Fix issue',
    };
    expect(isNextStepApplyPatch(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepResolveConflict = {
      kind: 'resolveConflict',
      conflictId: 'conflict_1',
      candidates: ['frag_1'],
      rationale: 'Resolve conflict',
    };
    expect(isNextStepApplyPatch(step)).toBe(false);
  });
});

describe('isNextStepResolveConflict', () => {
  it('should return true for resolveConflict step', () => {
    const step: NextStepResolveConflict = {
      kind: 'resolveConflict',
      conflictId: 'conflict_1',
      candidates: ['frag_1', 'frag_2'],
      rationale: 'Choose fragment',
    };
    expect(isNextStepResolveConflict(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepFixIssue = {
      kind: 'fixIssue',
      issueId: 'issue_1',
      fragmentId: 'frag_1',
      rationale: 'Fix',
    };
    expect(isNextStepResolveConflict(step)).toBe(false);
  });
});

describe('isNextStepFixIssue', () => {
  it('should return true for fixIssue step', () => {
    const step: NextStepFixIssue = {
      kind: 'fixIssue',
      issueId: 'issue_1',
      fragmentId: 'frag_1',
      rationale: 'Fix dependency',
    };
    expect(isNextStepFixIssue(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepApplyPatch = {
      kind: 'applyPatch',
      patchHintId: 'h1',
      resolves: 'i1',
      rationale: 'Apply',
    };
    expect(isNextStepFixIssue(step)).toBe(false);
  });
});

describe('isNextStepAddFragment', () => {
  it('should return true for addFragment step', () => {
    const step: NextStepAddFragment = {
      kind: 'addFragment',
      fragmentKind: 'SourceFragment',
      targetPath: 'data.newField',
      rationale: 'Add source',
    };
    expect(isNextStepAddFragment(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepRecompile = {
      kind: 'recompile',
      reason: 'Changes detected',
      rationale: 'Recompile needed',
    };
    expect(isNextStepAddFragment(step)).toBe(false);
  });
});

describe('isNextStepRecompile', () => {
  it('should return true for recompile step', () => {
    const step: NextStepRecompile = {
      kind: 'recompile',
      reason: 'Source changed',
      rationale: 'Need to recompile',
    };
    expect(isNextStepRecompile(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepConfirmDomain = {
      kind: 'confirmDomain',
      domainHash: 'abc123',
      warningCount: 0,
      rationale: 'Ready',
    };
    expect(isNextStepRecompile(step)).toBe(false);
  });
});

describe('isNextStepReviewDraft', () => {
  it('should return true for reviewDraft step', () => {
    const step: NextStepReviewDraft = {
      kind: 'reviewDraft',
      draftId: 'draft_1',
      fragmentKind: 'DerivedFragment',
      rationale: 'Review LLM output',
    };
    expect(isNextStepReviewDraft(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepApplyPatch = {
      kind: 'applyPatch',
      patchHintId: 'h1',
      resolves: 'i1',
      rationale: 'Apply',
    };
    expect(isNextStepReviewDraft(step)).toBe(false);
  });
});

describe('isNextStepConfirmDomain', () => {
  it('should return true for confirmDomain step', () => {
    const step: NextStepConfirmDomain = {
      kind: 'confirmDomain',
      domainHash: 'hash123',
      warningCount: 2,
      rationale: 'Ready to deploy',
    };
    expect(isNextStepConfirmDomain(step)).toBe(true);
  });

  it('should return false for other step types', () => {
    const step: NextStepRecompile = {
      kind: 'recompile',
      reason: 'Changes',
      rationale: 'Recompile',
    };
    expect(isNextStepConfirmDomain(step)).toBe(false);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should work with type narrowing in array filter', () => {
    const steps: NextStep[] = [
      { kind: 'applyPatch', patchHintId: 'h1', resolves: 'i1', rationale: 'Apply' },
      { kind: 'resolveConflict', conflictId: 'c1', candidates: ['f1'], rationale: 'Resolve' },
      { kind: 'fixIssue', issueId: 'i1', fragmentId: 'f1', rationale: 'Fix' },
      { kind: 'confirmDomain', domainHash: 'h', warningCount: 0, rationale: 'Confirm' },
    ];

    const patchSteps = steps.filter(isNextStepApplyPatch);
    const conflictSteps = steps.filter(isNextStepResolveConflict);
    const fixSteps = steps.filter(isNextStepFixIssue);
    const confirmSteps = steps.filter(isNextStepConfirmDomain);

    expect(patchSteps).toHaveLength(1);
    expect(conflictSteps).toHaveLength(1);
    expect(fixSteps).toHaveLength(1);
    expect(confirmSteps).toHaveLength(1);
  });

  it('should handle steps with optional fields', () => {
    const step: NextStepFixIssue = {
      kind: 'fixIssue',
      issueId: 'i1',
      fragmentId: 'f1',
      suggestion: 'Try adding the dependency',
      rationale: 'Fix',
    };

    expect(isNextStepFixIssue(step)).toBe(true);
    expect(step.suggestion).toBe('Try adding the dependency');
  });
});
