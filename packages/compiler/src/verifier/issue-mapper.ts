/**
 * Issue Mapper - Convert internal errors to Issue objects
 *
 * This module provides functions to:
 * 1. Map validation errors to Issue objects
 * 2. Map core validation issues to compiler Issues
 * 3. Create Issues from codes
 * 4. Classify severity based on issue code
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { FragmentId } from '../types/fragment.js';
import type { PatchHint } from '../types/patch.js';
import {
  type Issue,
  type IssueCode,
  type IssueSeverity,
  createIssueId,
} from '../types/issue.js';

// Internal utilities (TRD 1.5)
import {
  sortIssues as internalSortIssues,
  getBlockingIssues as internalGetBlockingIssues,
  hasBlockingIssues as internalHasBlockingIssues,
} from '../internal/index.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Internal validation error (from various sources)
 */
export interface ValidationError {
  /** Error type/code */
  type: string;

  /** Error message */
  message: string;

  /** Related path (if any) */
  path?: string;

  /** Related fragment IDs */
  fragmentIds?: string[];

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Core validation issue (from @manifesto-ai/core validateDomain)
 */
export interface CoreValidationIssue {
  /** Issue code from core */
  code: string;

  /** Issue message */
  message: string;

  /** Severity (core uses error/warning, but allow suggestion as info) */
  severity: 'error' | 'warning' | 'info' | 'suggestion';

  /** Related path */
  path?: string;

  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Options for creating an issue
 */
export interface IssueOptions {
  /** Related semantic path */
  path?: SemanticPath;

  /** Related fragment IDs */
  relatedFragments?: FragmentId[];

  /** Suggested fix */
  suggestedFix?: PatchHint;

  /** Additional context */
  context?: Record<string, unknown>;

  /** Override severity */
  severity?: IssueSeverity;
}

// ============================================================================
// Severity Classification
// ============================================================================

/**
 * Error codes that block domain generation
 */
const ERROR_CODES: Set<IssueCode> = new Set([
  'DOMAIN_ID_REQUIRED',
  'DOMAIN_NAME_REQUIRED',
  'MISSING_DEPENDENCY',
  'CYCLIC_DEPENDENCY',
  'INVALID_PATH',
  'PATH_NOT_FOUND',
  'DUPLICATE_PATH',
  'SCHEMA_MISMATCH',
  'INVALID_SCHEMA',
  'INVALID_PRECONDITION_PATH',
  'INVALID_EFFECT',
  'INVALID_EXPRESSION',
  'EXPRESSION_TYPE_MISMATCH',
  'DUPLICATE_PROVIDES',
  'UNRESOLVED_REFERENCE',
  'LINK_ERROR',
  'MISSING_PROVENANCE',
  'INVALID_PROVENANCE',
  'UNKNOWN_ERROR',
]);

/**
 * Warning codes that don't block but should be addressed
 */
const WARNING_CODES: Set<IssueCode> = new Set([
  'UNUSED_PATH',
  'ACTION_VERB_REQUIRED',
  'EFFECT_RISK_TOO_HIGH',
  'MISSING_DEFAULT_VALUE',
]);

/**
 * Info codes for non-critical issues
 */
const INFO_CODES: Set<IssueCode> = new Set([
  'ACTION_NOT_FOUND',
]);

/**
 * Classify severity based on issue code
 *
 * @param code - Issue code to classify
 * @returns Severity level
 */
export function classifySeverity(code: IssueCode): IssueSeverity {
  if (ERROR_CODES.has(code)) {
    return 'error';
  }
  if (WARNING_CODES.has(code)) {
    return 'warning';
  }
  if (INFO_CODES.has(code)) {
    return 'info';
  }
  // Default to error for unknown codes
  return 'error';
}

// ============================================================================
// Issue Creation
// ============================================================================

/**
 * Create an Issue from code and message
 *
 * @param code - Issue code
 * @param message - Human-readable message
 * @param options - Additional options
 * @returns Issue object
 */
export function createIssueFromCode(
  code: IssueCode,
  message: string,
  options: IssueOptions = {}
): Issue {
  return {
    id: createIssueId(),
    code,
    severity: options.severity ?? classifySeverity(code),
    message,
    path: options.path,
    relatedFragments: options.relatedFragments,
    suggestedFix: options.suggestedFix,
    context: options.context,
  };
}

// ============================================================================
// Error Mapping
// ============================================================================

/**
 * Map error type to IssueCode
 */
const ERROR_TYPE_TO_CODE: Record<string, IssueCode> = {
  // Dependency errors
  missing_dependency: 'MISSING_DEPENDENCY',
  cyclic_dependency: 'CYCLIC_DEPENDENCY',
  unresolved_reference: 'UNRESOLVED_REFERENCE',

  // Path errors
  invalid_path: 'INVALID_PATH',
  path_not_found: 'PATH_NOT_FOUND',
  duplicate_path: 'DUPLICATE_PATH',

  // Schema errors
  schema_mismatch: 'SCHEMA_MISMATCH',
  invalid_schema: 'INVALID_SCHEMA',
  type_mismatch: 'SCHEMA_MISMATCH',

  // Action errors
  invalid_precondition: 'INVALID_PRECONDITION_PATH',
  action_verb_required: 'ACTION_VERB_REQUIRED',
  action_not_found: 'ACTION_NOT_FOUND',

  // Effect errors
  invalid_effect: 'INVALID_EFFECT',
  effect_risk: 'EFFECT_RISK_TOO_HIGH',

  // Expression errors
  invalid_expression: 'INVALID_EXPRESSION',
  expression_type_mismatch: 'EXPRESSION_TYPE_MISMATCH',

  // Linker errors
  duplicate_provides: 'DUPLICATE_PROVIDES',
  link_error: 'LINK_ERROR',

  // Provenance errors
  missing_provenance: 'MISSING_PROVENANCE',
  invalid_provenance: 'INVALID_PROVENANCE',
};

/**
 * Map a validation error to an Issue
 *
 * @param error - Validation error
 * @returns Issue object
 */
export function mapValidationError(error: ValidationError): Issue {
  // Map error type to issue code
  const code = ERROR_TYPE_TO_CODE[error.type.toLowerCase()] ?? 'UNKNOWN_ERROR';

  // Build options
  const options: IssueOptions = {
    path: error.path as SemanticPath | undefined,
    relatedFragments: error.fragmentIds,
    context: error.context,
  };

  return createIssueFromCode(code, error.message, options);
}

/**
 * Map multiple validation errors to Issues
 *
 * @param errors - Validation errors
 * @returns Issues
 */
export function mapValidationErrors(errors: ValidationError[]): Issue[] {
  return errors.map(mapValidationError);
}

// ============================================================================
// Core Issue Mapping
// ============================================================================

/**
 * Map core issue code to compiler IssueCode
 */
const CORE_CODE_TO_ISSUE_CODE: Record<string, IssueCode> = {
  // Core uses these codes (approximate mapping)
  MISSING_DEP: 'MISSING_DEPENDENCY',
  MISSING_DEPENDENCY: 'MISSING_DEPENDENCY',
  CYCLIC: 'CYCLIC_DEPENDENCY',
  CYCLIC_DEPENDENCY: 'CYCLIC_DEPENDENCY',
  INVALID_PATH: 'INVALID_PATH',
  UNKNOWN_PATH: 'PATH_NOT_FOUND',
  SCHEMA_ERROR: 'SCHEMA_MISMATCH',
  TYPE_ERROR: 'EXPRESSION_TYPE_MISMATCH',
  INVALID_EXPRESSION: 'INVALID_EXPRESSION',
  INVALID_EFFECT: 'INVALID_EFFECT',
  DOMAIN_ID_REQUIRED: 'DOMAIN_ID_REQUIRED',
  DOMAIN_NAME_REQUIRED: 'DOMAIN_NAME_REQUIRED',
};

/**
 * Map a core validation issue to a compiler Issue
 *
 * @param coreIssue - Core validation issue
 * @returns Compiler Issue
 */
export function mapCoreValidationIssue(coreIssue: CoreValidationIssue): Issue {
  // Map code
  const code = CORE_CODE_TO_ISSUE_CODE[coreIssue.code] ??
    (coreIssue.code as IssueCode) ??
    'UNKNOWN_ERROR';

  // Map severity
  let severity: IssueSeverity;
  switch (coreIssue.severity) {
    case 'error':
      severity = 'error';
      break;
    case 'warning':
      severity = 'warning';
      break;
    case 'info':
      severity = 'info';
      break;
    default:
      severity = classifySeverity(code);
  }

  return {
    id: createIssueId(),
    code,
    severity,
    message: coreIssue.message,
    path: coreIssue.path as SemanticPath | undefined,
    context: coreIssue.data,
  };
}

/**
 * Map multiple core validation issues to compiler Issues
 *
 * @param coreIssues - Core validation issues
 * @returns Compiler Issues
 */
export function mapCoreValidationIssues(coreIssues: CoreValidationIssue[]): Issue[] {
  return coreIssues.map(mapCoreValidationIssue);
}

// ============================================================================
// Specialized Issue Creators
// ============================================================================

/**
 * Create issue for missing dependency
 */
export function createMissingDependencyIssue(
  path: SemanticPath,
  missingDep: SemanticPath,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'MISSING_DEPENDENCY',
    `Path "${path}" depends on undefined path "${missingDep}"`,
    {
      path,
      relatedFragments: fragmentId ? [fragmentId] : undefined,
      context: { missingDep },
    }
  );
}

/**
 * Create issue for cyclic dependency
 */
export function createCyclicDependencyIssue(
  cycle: SemanticPath[],
  fragmentIds?: FragmentId[]
): Issue {
  return createIssueFromCode(
    'CYCLIC_DEPENDENCY',
    `Cyclic dependency detected: ${cycle.join(' -> ')}`,
    {
      path: cycle[0],
      relatedFragments: fragmentIds,
      context: { cycle },
    }
  );
}

/**
 * Create issue for invalid path
 */
export function createInvalidPathIssue(
  path: string,
  reason: string,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'INVALID_PATH',
    `Invalid path "${path}": ${reason}`,
    {
      path: path as SemanticPath,
      relatedFragments: fragmentId ? [fragmentId] : undefined,
    }
  );
}

/**
 * Create issue for duplicate provides
 */
export function createDuplicateProvidesIssue(
  target: string,
  fragmentIds: FragmentId[]
): Issue {
  return createIssueFromCode(
    'DUPLICATE_PROVIDES',
    `Multiple fragments provide "${target}": ${fragmentIds.join(', ')}`,
    {
      path: target as SemanticPath,
      relatedFragments: fragmentIds,
      context: { duplicateCount: fragmentIds.length },
    }
  );
}

/**
 * Create issue for invalid precondition path
 */
export function createInvalidPreconditionPathIssue(
  actionId: string,
  invalidPath: SemanticPath,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'INVALID_PRECONDITION_PATH',
    `Action "${actionId}" has precondition referencing undefined path "${invalidPath}"`,
    {
      path: invalidPath,
      relatedFragments: fragmentId ? [fragmentId] : undefined,
      context: { actionId },
    }
  );
}

/**
 * Create issue for action verb required
 */
export function createActionVerbRequiredIssue(
  actionId: string,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'ACTION_VERB_REQUIRED',
    `Action "${actionId}" requires a verb in semantic metadata`,
    {
      relatedFragments: fragmentId ? [fragmentId] : undefined,
      context: { actionId },
    }
  );
}

/**
 * Create issue for missing provenance
 */
export function createMissingProvenanceIssue(fragmentId: FragmentId): Issue {
  return createIssueFromCode(
    'MISSING_PROVENANCE',
    `Fragment "${fragmentId}" is missing provenance (origin or evidence)`,
    {
      relatedFragments: [fragmentId],
    }
  );
}

/**
 * Create issue for effect risk too high
 */
export function createEffectRiskTooHighIssue(
  fragmentId: FragmentId,
  risk: string,
  maxAllowed: string
): Issue {
  return createIssueFromCode(
    'EFFECT_RISK_TOO_HIGH',
    `Effect risk level "${risk}" exceeds maximum allowed "${maxAllowed}"`,
    {
      relatedFragments: [fragmentId],
      context: { risk, maxAllowed },
    }
  );
}

/**
 * Create issue for unknown schema type
 */
export function createUnknownSchemaTypeIssue(
  path: SemanticPath,
  fieldType: string,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'SCHEMA_MISMATCH',
    `Unknown field type "${fieldType}" at path "${path}" - using z.unknown()`,
    {
      path,
      relatedFragments: fragmentId ? [fragmentId] : undefined,
      context: { fieldType },
      severity: 'warning', // Override to warning since we can continue with z.unknown()
    }
  );
}

/**
 * Create issue for invalid expression
 */
export function createInvalidExpressionIssue(
  path: SemanticPath,
  reason: string,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'INVALID_EXPRESSION',
    `Invalid expression at "${path}": ${reason}`,
    {
      path,
      relatedFragments: fragmentId ? [fragmentId] : undefined,
    }
  );
}

/**
 * Create issue for invalid effect
 */
export function createInvalidEffectIssue(
  actionId: string,
  reason: string,
  fragmentId?: FragmentId
): Issue {
  return createIssueFromCode(
    'INVALID_EFFECT',
    `Invalid effect in action "${actionId}": ${reason}`,
    {
      relatedFragments: fragmentId ? [fragmentId] : undefined,
      context: { actionId },
    }
  );
}

// ============================================================================
// Issue Utilities
// ============================================================================

/**
 * Check if any issues are blocking (error severity)
 *
 * @deprecated Use import from '../internal/index.js' directly for new code
 */
export function hasBlockingIssues(issues: Issue[]): boolean {
  return internalHasBlockingIssues(issues);
}

/**
 * Get only blocking issues
 *
 * @deprecated Use import from '../internal/index.js' directly for new code
 */
export function getBlockingIssues(issues: Issue[]): Issue[] {
  return internalGetBlockingIssues(issues);
}

/**
 * Sort issues by severity (errors first), then by code, then by path
 *
 * @deprecated Use import from '../internal/index.js' directly for new code
 */
export function sortIssues(issues: Issue[]): Issue[] {
  return internalSortIssues(issues);
}

/**
 * Group issues by code
 */
export function groupIssuesByCode(issues: Issue[]): Map<IssueCode, Issue[]> {
  const groups = new Map<IssueCode, Issue[]>();

  for (const issue of issues) {
    const existing = groups.get(issue.code) ?? [];
    existing.push(issue);
    groups.set(issue.code, existing);
  }

  return groups;
}

/**
 * Get issue summary
 */
export function getIssueSummary(issues: Issue[]): {
  total: number;
  errors: number;
  warnings: number;
  infos: number;
} {
  let errors = 0;
  let warnings = 0;
  let infos = 0;

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        errors++;
        break;
      case 'warning':
        warnings++;
        break;
      case 'info':
      case 'suggestion':
        infos++;
        break;
    }
  }

  return {
    total: issues.length,
    errors,
    warnings,
    infos,
  };
}

export default {
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
};
