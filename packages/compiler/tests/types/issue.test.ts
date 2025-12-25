/**
 * Issue Types Tests
 *
 * Tests for all issue factory functions and utilities in src/types/issue.ts
 */

import { describe, it, expect } from 'vitest';
import type { SemanticPath } from '@manifesto-ai/core';
import {
  createIssueId,
  missingDependencyIssue,
  cyclicDependencyIssue,
  invalidPathIssue,
  invalidPreconditionPathIssue,
  actionVerbRequiredIssue,
  missingProvenanceIssue,
  effectRiskTooHighIssue,
  isBlockingIssue,
  filterIssuesBySeverity,
  getErrorIssues,
  getWarningIssues,
  type Issue,
} from '../../src/types/issue.js';

// ============================================================================
// createIssueId
// ============================================================================

describe('createIssueId', () => {
  it('should create an issue ID with correct prefix', () => {
    const id = createIssueId();
    expect(id).toMatch(/^issue_\d+_[a-z0-9]+$/);
  });

  it('should create unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(createIssueId());
    }
    expect(ids.size).toBe(100);
  });
});

// ============================================================================
// Issue Factory Functions
// ============================================================================

describe('missingDependencyIssue', () => {
  it('should create issue with required fields', () => {
    const issue = missingDependencyIssue(
      'derived.total' as SemanticPath,
      'data.price' as SemanticPath
    );

    expect(issue.id).toMatch(/^issue_/);
    expect(issue.code).toBe('MISSING_DEPENDENCY');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('derived.total');
    expect(issue.message).toContain('derived.total');
    expect(issue.message).toContain('data.price');
    expect(issue.context?.missingDep).toBe('data.price');
  });

  it('should include related fragments when provided', () => {
    const issue = missingDependencyIssue(
      'derived.x' as SemanticPath,
      'data.y' as SemanticPath,
      ['frag_1', 'frag_2']
    );

    expect(issue.relatedFragments).toEqual(['frag_1', 'frag_2']);
  });

  it('should include suggested fix when provided', () => {
    const suggestedFix = { description: 'Add missing path' };
    const issue = missingDependencyIssue(
      'derived.x' as SemanticPath,
      'data.y' as SemanticPath,
      undefined,
      suggestedFix
    );

    expect(issue.suggestedFix).toEqual(suggestedFix);
  });
});

describe('cyclicDependencyIssue', () => {
  it('should create issue with cycle information', () => {
    const cycle = [
      'derived.a' as SemanticPath,
      'derived.b' as SemanticPath,
      'derived.a' as SemanticPath,
    ];
    const issue = cyclicDependencyIssue(cycle);

    expect(issue.code).toBe('CYCLIC_DEPENDENCY');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('derived.a');
    expect(issue.message).toContain('derived.a -> derived.b -> derived.a');
    expect(issue.context?.cycle).toEqual(cycle);
  });

  it('should include related fragments', () => {
    const issue = cyclicDependencyIssue(
      ['a' as SemanticPath, 'b' as SemanticPath],
      ['frag_1']
    );

    expect(issue.relatedFragments).toEqual(['frag_1']);
  });
});

describe('invalidPathIssue', () => {
  it('should create issue with path and reason', () => {
    const issue = invalidPathIssue(
      'invalid..path' as SemanticPath,
      'contains consecutive dots'
    );

    expect(issue.code).toBe('INVALID_PATH');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('invalid..path');
    expect(issue.message).toContain('invalid..path');
    expect(issue.message).toContain('contains consecutive dots');
  });

  it('should include related fragments', () => {
    const issue = invalidPathIssue(
      'bad.path' as SemanticPath,
      'reason',
      ['frag_1']
    );

    expect(issue.relatedFragments).toEqual(['frag_1']);
  });
});

describe('invalidPreconditionPathIssue', () => {
  it('should create issue with action context', () => {
    const issue = invalidPreconditionPathIssue(
      'checkout',
      'state.invalidPath' as SemanticPath
    );

    expect(issue.code).toBe('INVALID_PRECONDITION_PATH');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('state.invalidPath');
    expect(issue.message).toContain('checkout');
    expect(issue.message).toContain('state.invalidPath');
    expect(issue.context?.actionId).toBe('checkout');
  });

  it('should include related fragments', () => {
    const issue = invalidPreconditionPathIssue(
      'action1',
      'path' as SemanticPath,
      ['frag_1']
    );

    expect(issue.relatedFragments).toEqual(['frag_1']);
  });
});

describe('actionVerbRequiredIssue', () => {
  it('should create warning issue', () => {
    const issue = actionVerbRequiredIssue('doSomething');

    expect(issue.code).toBe('ACTION_VERB_REQUIRED');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('doSomething');
    expect(issue.context?.actionId).toBe('doSomething');
  });

  it('should include related fragments', () => {
    const issue = actionVerbRequiredIssue('action1', ['frag_1']);
    expect(issue.relatedFragments).toEqual(['frag_1']);
  });
});

describe('missingProvenanceIssue', () => {
  it('should create error issue', () => {
    const issue = missingProvenanceIssue('frag_123');

    expect(issue.code).toBe('MISSING_PROVENANCE');
    expect(issue.severity).toBe('error');
    expect(issue.message).toContain('frag_123');
    expect(issue.relatedFragments).toEqual(['frag_123']);
  });
});

describe('effectRiskTooHighIssue', () => {
  it('should create warning issue with risk levels', () => {
    const issue = effectRiskTooHighIssue('effect_1', 'critical', 'high');

    expect(issue.code).toBe('EFFECT_RISK_TOO_HIGH');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('critical');
    expect(issue.message).toContain('high');
    expect(issue.relatedFragments).toEqual(['effect_1']);
    expect(issue.context?.risk).toBe('critical');
    expect(issue.context?.maxAllowed).toBe('high');
  });
});

// ============================================================================
// Issue Utilities
// ============================================================================

describe('isBlockingIssue', () => {
  it('should return true for error severity', () => {
    const issue: Issue = {
      id: 'issue_1',
      code: 'MISSING_DEPENDENCY',
      severity: 'error',
      message: 'test',
    };
    expect(isBlockingIssue(issue)).toBe(true);
  });

  it('should return false for warning severity', () => {
    const issue: Issue = {
      id: 'issue_1',
      code: 'ACTION_VERB_REQUIRED',
      severity: 'warning',
      message: 'test',
    };
    expect(isBlockingIssue(issue)).toBe(false);
  });

  it('should return false for info severity', () => {
    const issue: Issue = {
      id: 'issue_1',
      code: 'UNUSED_PATH',
      severity: 'info',
      message: 'test',
    };
    expect(isBlockingIssue(issue)).toBe(false);
  });

  it('should return false for suggestion severity', () => {
    const issue: Issue = {
      id: 'issue_1',
      code: 'UNUSED_PATH',
      severity: 'suggestion',
      message: 'test',
    };
    expect(isBlockingIssue(issue)).toBe(false);
  });
});

describe('filterIssuesBySeverity', () => {
  const issues: Issue[] = [
    { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: 'e1' },
    { id: '2', code: 'CYCLIC_DEPENDENCY', severity: 'error', message: 'e2' },
    { id: '3', code: 'ACTION_VERB_REQUIRED', severity: 'warning', message: 'w1' },
    { id: '4', code: 'UNUSED_PATH', severity: 'info', message: 'i1' },
  ];

  it('should filter error issues', () => {
    const result = filterIssuesBySeverity(issues, 'error');
    expect(result).toHaveLength(2);
    expect(result.every(i => i.severity === 'error')).toBe(true);
  });

  it('should filter warning issues', () => {
    const result = filterIssuesBySeverity(issues, 'warning');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('warning');
  });

  it('should filter info issues', () => {
    const result = filterIssuesBySeverity(issues, 'info');
    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe('info');
  });

  it('should return empty array for no matches', () => {
    const result = filterIssuesBySeverity(issues, 'suggestion');
    expect(result).toEqual([]);
  });

  it('should handle empty array', () => {
    const result = filterIssuesBySeverity([], 'error');
    expect(result).toEqual([]);
  });
});

describe('getErrorIssues', () => {
  it('should return only error issues', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: 'e1' },
      { id: '2', code: 'ACTION_VERB_REQUIRED', severity: 'warning', message: 'w1' },
      { id: '3', code: 'CYCLIC_DEPENDENCY', severity: 'error', message: 'e2' },
    ];

    const result = getErrorIssues(issues);

    expect(result).toHaveLength(2);
    expect(result.every(i => i.severity === 'error')).toBe(true);
  });

  it('should handle empty array', () => {
    expect(getErrorIssues([])).toEqual([]);
  });
});

describe('getWarningIssues', () => {
  it('should return only warning issues', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: 'e1' },
      { id: '2', code: 'ACTION_VERB_REQUIRED', severity: 'warning', message: 'w1' },
      { id: '3', code: 'EFFECT_RISK_TOO_HIGH', severity: 'warning', message: 'w2' },
    ];

    const result = getWarningIssues(issues);

    expect(result).toHaveLength(2);
    expect(result.every(i => i.severity === 'warning')).toBe(true);
  });

  it('should handle empty array', () => {
    expect(getWarningIssues([])).toEqual([]);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle unicode in paths', () => {
    const issue = invalidPathIssue(
      '데이터.사용자' as SemanticPath,
      '유효하지 않은 경로'
    );
    expect(issue.path).toBe('데이터.사용자');
    expect(issue.message).toContain('유효하지 않은 경로');
  });

  it('should handle empty cycle array', () => {
    const issue = cyclicDependencyIssue([]);
    expect(issue.context?.cycle).toEqual([]);
    expect(issue.path).toBeUndefined();
  });
});
