/**
 * Issue Mapper Tests
 *
 * Tests for converting internal errors to Issue objects
 * and classifying severity.
 */

import { describe, it, expect } from 'vitest';
import {
  classifySeverity,
  createIssueFromCode,
  mapValidationError,
  mapValidationErrors,
  mapCoreValidationIssue,
  mapCoreValidationIssues,
  createMissingDependencyIssue,
  createCyclicDependencyIssue,
  createInvalidPathIssue,
  createDuplicateProvidesIssue,
  createInvalidPreconditionPathIssue,
  createActionVerbRequiredIssue,
  createMissingProvenanceIssue,
  createEffectRiskTooHighIssue,
  createUnknownSchemaTypeIssue,
  createInvalidExpressionIssue,
  createInvalidEffectIssue,
  hasBlockingIssues,
  getBlockingIssues,
  sortIssues,
  groupIssuesByCode,
  getIssueSummary,
  type ValidationError,
  type CoreValidationIssue,
} from '../../src/verifier/issue-mapper.js';
import type { Issue } from '../../src/types/issue.js';

// ============================================================================
// classifySeverity Tests
// ============================================================================

describe('classifySeverity', () => {
  it('should classify error codes as error', () => {
    expect(classifySeverity('MISSING_DEPENDENCY')).toBe('error');
    expect(classifySeverity('CYCLIC_DEPENDENCY')).toBe('error');
    expect(classifySeverity('INVALID_PATH')).toBe('error');
    expect(classifySeverity('SCHEMA_MISMATCH')).toBe('error');
    expect(classifySeverity('DUPLICATE_PROVIDES')).toBe('error');
    expect(classifySeverity('UNKNOWN_ERROR')).toBe('error');
  });

  it('should classify warning codes as warning', () => {
    expect(classifySeverity('UNUSED_PATH')).toBe('warning');
    expect(classifySeverity('ACTION_VERB_REQUIRED')).toBe('warning');
    expect(classifySeverity('EFFECT_RISK_TOO_HIGH')).toBe('warning');
    expect(classifySeverity('MISSING_DEFAULT_VALUE')).toBe('warning');
  });

  it('should classify info codes as info', () => {
    expect(classifySeverity('ACTION_NOT_FOUND')).toBe('info');
  });
});

// ============================================================================
// createIssueFromCode Tests
// ============================================================================

describe('createIssueFromCode', () => {
  it('should create issue with auto-classified severity', () => {
    const issue = createIssueFromCode('MISSING_DEPENDENCY', 'Test message');

    expect(issue.code).toBe('MISSING_DEPENDENCY');
    expect(issue.message).toBe('Test message');
    expect(issue.severity).toBe('error');
    expect(issue.id).toMatch(/^issue_/);
  });

  it('should create issue with path', () => {
    const issue = createIssueFromCode('INVALID_PATH', 'Bad path', {
      path: 'data.test' as any,
    });

    expect(issue.path).toBe('data.test');
  });

  it('should create issue with related fragments', () => {
    const issue = createIssueFromCode('DUPLICATE_PROVIDES', 'Duplicate', {
      relatedFragments: ['frag-1', 'frag-2'],
    });

    expect(issue.relatedFragments).toEqual(['frag-1', 'frag-2']);
  });

  it('should create issue with context', () => {
    const issue = createIssueFromCode('SCHEMA_MISMATCH', 'Type error', {
      context: { expected: 'string', actual: 'number' },
    });

    expect(issue.context).toEqual({ expected: 'string', actual: 'number' });
  });

  it('should allow severity override', () => {
    const issue = createIssueFromCode('MISSING_DEPENDENCY', 'Test', {
      severity: 'warning',
    });

    expect(issue.severity).toBe('warning');
  });
});

// ============================================================================
// mapValidationError Tests
// ============================================================================

describe('mapValidationError', () => {
  it('should map missing_dependency error', () => {
    const error: ValidationError = {
      type: 'missing_dependency',
      message: 'Path not found',
      path: 'data.x',
    };

    const issue = mapValidationError(error);

    expect(issue.code).toBe('MISSING_DEPENDENCY');
    expect(issue.message).toBe('Path not found');
    expect(issue.path).toBe('data.x');
  });

  it('should map cyclic_dependency error', () => {
    const error: ValidationError = {
      type: 'cyclic_dependency',
      message: 'Cycle detected',
      context: { cycle: ['a', 'b', 'a'] },
    };

    const issue = mapValidationError(error);

    expect(issue.code).toBe('CYCLIC_DEPENDENCY');
    expect(issue.context).toEqual({ cycle: ['a', 'b', 'a'] });
  });

  it('should map unknown error types to UNKNOWN_ERROR', () => {
    const error: ValidationError = {
      type: 'some_unknown_type',
      message: 'Unknown',
    };

    const issue = mapValidationError(error);

    expect(issue.code).toBe('UNKNOWN_ERROR');
  });

  it('should include fragment IDs', () => {
    const error: ValidationError = {
      type: 'invalid_path',
      message: 'Bad path',
      fragmentIds: ['frag-1'],
    };

    const issue = mapValidationError(error);

    expect(issue.relatedFragments).toEqual(['frag-1']);
  });
});

describe('mapValidationErrors', () => {
  it('should map multiple errors', () => {
    const errors: ValidationError[] = [
      { type: 'missing_dependency', message: 'Error 1' },
      { type: 'invalid_path', message: 'Error 2' },
    ];

    const issues = mapValidationErrors(errors);

    expect(issues).toHaveLength(2);
    expect(issues[0].code).toBe('MISSING_DEPENDENCY');
    expect(issues[1].code).toBe('INVALID_PATH');
  });
});

// ============================================================================
// mapCoreValidationIssue Tests
// ============================================================================

describe('mapCoreValidationIssue', () => {
  it('should map core issue with known code', () => {
    const coreIssue: CoreValidationIssue = {
      code: 'CYCLIC_DEPENDENCY',
      message: 'Cycle found',
      severity: 'error',
      path: 'derived.x',
    };

    const issue = mapCoreValidationIssue(coreIssue);

    expect(issue.code).toBe('CYCLIC_DEPENDENCY');
    expect(issue.message).toBe('Cycle found');
    expect(issue.severity).toBe('error');
    expect(issue.path).toBe('derived.x');
  });

  it('should map core issue with alternative code', () => {
    const coreIssue: CoreValidationIssue = {
      code: 'MISSING_DEP',
      message: 'Missing dependency',
      severity: 'error',
    };

    const issue = mapCoreValidationIssue(coreIssue);

    expect(issue.code).toBe('MISSING_DEPENDENCY');
  });

  it('should preserve severity from core', () => {
    const coreIssue: CoreValidationIssue = {
      code: 'MISSING_DEPENDENCY',
      message: 'Test',
      severity: 'warning',
    };

    const issue = mapCoreValidationIssue(coreIssue);

    expect(issue.severity).toBe('warning');
  });

  it('should include data as context', () => {
    const coreIssue: CoreValidationIssue = {
      code: 'SCHEMA_ERROR',
      message: 'Schema error',
      severity: 'error',
      data: { field: 'name' },
    };

    const issue = mapCoreValidationIssue(coreIssue);

    expect(issue.context).toEqual({ field: 'name' });
  });
});

describe('mapCoreValidationIssues', () => {
  it('should map multiple core issues', () => {
    const coreIssues: CoreValidationIssue[] = [
      { code: 'INVALID_PATH', message: 'Issue 1', severity: 'error' },
      { code: 'CYCLIC', message: 'Issue 2', severity: 'warning' },
    ];

    const issues = mapCoreValidationIssues(coreIssues);

    expect(issues).toHaveLength(2);
  });
});

// ============================================================================
// Specialized Issue Creator Tests
// ============================================================================

describe('createMissingDependencyIssue', () => {
  it('should create missing dependency issue', () => {
    const issue = createMissingDependencyIssue('data.x' as any, 'data.y' as any, 'frag-1');

    expect(issue.code).toBe('MISSING_DEPENDENCY');
    expect(issue.severity).toBe('error');
    expect(issue.message).toContain('data.x');
    expect(issue.message).toContain('data.y');
    expect(issue.path).toBe('data.x');
    expect(issue.relatedFragments).toEqual(['frag-1']);
    expect(issue.context).toEqual({ missingDep: 'data.y' });
  });
});

describe('createCyclicDependencyIssue', () => {
  it('should create cyclic dependency issue', () => {
    const cycle = ['data.a', 'data.b', 'data.a'] as any[];
    const issue = createCyclicDependencyIssue(cycle, ['frag-1', 'frag-2']);

    expect(issue.code).toBe('CYCLIC_DEPENDENCY');
    expect(issue.message).toContain('data.a -> data.b -> data.a');
    expect(issue.path).toBe('data.a');
    expect(issue.context).toEqual({ cycle });
  });
});

describe('createInvalidPathIssue', () => {
  it('should create invalid path issue', () => {
    const issue = createInvalidPathIssue('bad-path', 'missing namespace', 'frag-1');

    expect(issue.code).toBe('INVALID_PATH');
    expect(issue.message).toContain('bad-path');
    expect(issue.message).toContain('missing namespace');
  });
});

describe('createDuplicateProvidesIssue', () => {
  it('should create duplicate provides issue', () => {
    const issue = createDuplicateProvidesIssue('data.x', ['frag-1', 'frag-2']);

    expect(issue.code).toBe('DUPLICATE_PROVIDES');
    expect(issue.message).toContain('data.x');
    expect(issue.message).toContain('frag-1');
    expect(issue.message).toContain('frag-2');
    expect(issue.relatedFragments).toEqual(['frag-1', 'frag-2']);
    expect(issue.context).toEqual({ duplicateCount: 2 });
  });
});

describe('createInvalidPreconditionPathIssue', () => {
  it('should create invalid precondition path issue', () => {
    const issue = createInvalidPreconditionPathIssue('submit', 'derived.canSubmit' as any, 'frag-1');

    expect(issue.code).toBe('INVALID_PRECONDITION_PATH');
    expect(issue.message).toContain('submit');
    expect(issue.message).toContain('derived.canSubmit');
    expect(issue.context).toEqual({ actionId: 'submit' });
  });
});

describe('createActionVerbRequiredIssue', () => {
  it('should create action verb required issue', () => {
    const issue = createActionVerbRequiredIssue('doSomething', 'frag-1');

    expect(issue.code).toBe('ACTION_VERB_REQUIRED');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('doSomething');
  });
});

describe('createMissingProvenanceIssue', () => {
  it('should create missing provenance issue', () => {
    const issue = createMissingProvenanceIssue('frag-1');

    expect(issue.code).toBe('MISSING_PROVENANCE');
    expect(issue.message).toContain('frag-1');
    expect(issue.relatedFragments).toEqual(['frag-1']);
  });
});

describe('createEffectRiskTooHighIssue', () => {
  it('should create effect risk too high issue', () => {
    const issue = createEffectRiskTooHighIssue('frag-1', 'critical', 'high');

    expect(issue.code).toBe('EFFECT_RISK_TOO_HIGH');
    expect(issue.severity).toBe('warning');
    expect(issue.message).toContain('critical');
    expect(issue.message).toContain('high');
    expect(issue.context).toEqual({ risk: 'critical', maxAllowed: 'high' });
  });
});

describe('createUnknownSchemaTypeIssue', () => {
  it('should create unknown schema type issue', () => {
    const issue = createUnknownSchemaTypeIssue('data.x' as any, 'CustomType', 'frag-1');

    expect(issue.code).toBe('SCHEMA_MISMATCH');
    expect(issue.severity).toBe('warning'); // Override to warning
    expect(issue.message).toContain('CustomType');
    expect(issue.message).toContain('data.x');
    expect(issue.context).toEqual({ fieldType: 'CustomType' });
  });
});

describe('createInvalidExpressionIssue', () => {
  it('should create invalid expression issue', () => {
    const issue = createInvalidExpressionIssue('derived.x' as any, 'invalid operator', 'frag-1');

    expect(issue.code).toBe('INVALID_EXPRESSION');
    expect(issue.message).toContain('derived.x');
    expect(issue.message).toContain('invalid operator');
  });
});

describe('createInvalidEffectIssue', () => {
  it('should create invalid effect issue', () => {
    const issue = createInvalidEffectIssue('submit', 'missing target', 'frag-1');

    expect(issue.code).toBe('INVALID_EFFECT');
    expect(issue.message).toContain('submit');
    expect(issue.message).toContain('missing target');
    expect(issue.context).toEqual({ actionId: 'submit' });
  });
});

// ============================================================================
// Issue Utility Tests
// ============================================================================

describe('hasBlockingIssues', () => {
  it('should return true when errors exist', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '2', code: 'UNUSED_PATH', severity: 'warning', message: '' },
    ];

    expect(hasBlockingIssues(issues)).toBe(true);
  });

  it('should return false when no errors', () => {
    const issues: Issue[] = [
      { id: '1', code: 'UNUSED_PATH', severity: 'warning', message: '' },
      { id: '2', code: 'ACTION_NOT_FOUND', severity: 'info', message: '' },
    ];

    expect(hasBlockingIssues(issues)).toBe(false);
  });

  it('should return false for empty array', () => {
    expect(hasBlockingIssues([])).toBe(false);
  });
});

describe('getBlockingIssues', () => {
  it('should filter to only errors', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '2', code: 'UNUSED_PATH', severity: 'warning', message: '' },
      { id: '3', code: 'CYCLIC_DEPENDENCY', severity: 'error', message: '' },
    ];

    const blocking = getBlockingIssues(issues);

    expect(blocking).toHaveLength(2);
    expect(blocking.every((i) => i.severity === 'error')).toBe(true);
  });
});

describe('sortIssues', () => {
  it('should sort by severity (errors first)', () => {
    const issues: Issue[] = [
      { id: '1', code: 'UNUSED_PATH', severity: 'warning', message: '' },
      { id: '2', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '3', code: 'ACTION_NOT_FOUND', severity: 'info', message: '' },
    ];

    const sorted = sortIssues(issues);

    expect(sorted[0].severity).toBe('error');
    expect(sorted[1].severity).toBe('warning');
    expect(sorted[2].severity).toBe('info');
  });

  it('should sort by code within same severity', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '2', code: 'CYCLIC_DEPENDENCY', severity: 'error', message: '' },
    ];

    const sorted = sortIssues(issues);

    expect(sorted[0].code).toBe('CYCLIC_DEPENDENCY');
    expect(sorted[1].code).toBe('MISSING_DEPENDENCY');
  });

  it('should sort by path within same code', () => {
    const issues: Issue[] = [
      { id: '1', code: 'INVALID_PATH', severity: 'error', message: '', path: 'data.z' as any },
      { id: '2', code: 'INVALID_PATH', severity: 'error', message: '', path: 'data.a' as any },
    ];

    const sorted = sortIssues(issues);

    expect(sorted[0].path).toBe('data.a');
    expect(sorted[1].path).toBe('data.z');
  });

  it('should not mutate original array', () => {
    const issues: Issue[] = [
      { id: '1', code: 'UNUSED_PATH', severity: 'warning', message: '' },
      { id: '2', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
    ];

    sortIssues(issues);

    expect(issues[0].severity).toBe('warning'); // Original unchanged
  });
});

describe('groupIssuesByCode', () => {
  it('should group issues by code', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '2', code: 'INVALID_PATH', severity: 'error', message: '' },
      { id: '3', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
    ];

    const groups = groupIssuesByCode(issues);

    expect(groups.get('MISSING_DEPENDENCY')).toHaveLength(2);
    expect(groups.get('INVALID_PATH')).toHaveLength(1);
  });

  it('should handle empty array', () => {
    const groups = groupIssuesByCode([]);
    expect(groups.size).toBe(0);
  });
});

describe('getIssueSummary', () => {
  it('should count issues by severity', () => {
    const issues: Issue[] = [
      { id: '1', code: 'MISSING_DEPENDENCY', severity: 'error', message: '' },
      { id: '2', code: 'CYCLIC_DEPENDENCY', severity: 'error', message: '' },
      { id: '3', code: 'UNUSED_PATH', severity: 'warning', message: '' },
      { id: '4', code: 'ACTION_NOT_FOUND', severity: 'info', message: '' },
    ];

    const summary = getIssueSummary(issues);

    expect(summary.total).toBe(4);
    expect(summary.errors).toBe(2);
    expect(summary.warnings).toBe(1);
    expect(summary.infos).toBe(1);
  });

  it('should handle empty array', () => {
    const summary = getIssueSummary([]);

    expect(summary.total).toBe(0);
    expect(summary.errors).toBe(0);
    expect(summary.warnings).toBe(0);
    expect(summary.infos).toBe(0);
  });

  it('should count suggestions as info', () => {
    const issues: Issue[] = [
      { id: '1', code: 'UNUSED_PATH', severity: 'suggestion', message: '' },
    ];

    const summary = getIssueSummary(issues);

    expect(summary.infos).toBe(1);
  });
});
