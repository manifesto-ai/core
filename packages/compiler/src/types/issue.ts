/**
 * Issue Types - Validation issues
 *
 * Issues are problems detected during verification.
 * They are compatible with @manifesto-ai/core validateDomain issue codes.
 */

import type { SemanticPath } from '@manifesto-ai/core';
import type { FragmentId } from './fragment.js';
import type { PatchHint } from './patch.js';

/** Unique identifier for an issue */
export type IssueId = string;

/**
 * Issue severity levels
 */
export type IssueSeverity = 'error' | 'warning' | 'info' | 'suggestion';

/**
 * Issue codes - compatible with @manifesto-ai/core validateDomain
 *
 * These codes are used to categorize issues and suggest fixes.
 */
export type IssueCode =
  // Domain-level issues
  | 'DOMAIN_ID_REQUIRED'
  | 'DOMAIN_NAME_REQUIRED'
  // Dependency issues
  | 'MISSING_DEPENDENCY'
  | 'CYCLIC_DEPENDENCY'
  | 'UNUSED_PATH'
  // Path issues
  | 'INVALID_PATH'
  | 'PATH_NOT_FOUND'
  | 'DUPLICATE_PATH'
  // Schema issues
  | 'SCHEMA_MISMATCH'
  | 'INVALID_SCHEMA'
  | 'MISSING_DEFAULT_VALUE'
  | 'UNKNOWN_TYPE'
  | 'EMPTY_DATA_SCHEMA'
  // Action issues
  | 'INVALID_PRECONDITION_PATH'
  | 'ACTION_VERB_REQUIRED'
  | 'ACTION_NOT_FOUND'
  | 'MISSING_ACTION_EFFECT'
  | 'ACTION_WITHOUT_EFFECT'
  // Effect issues
  | 'EFFECT_RISK_TOO_HIGH'
  | 'INVALID_EFFECT'
  | 'MISSING_EFFECT_REF'
  // Expression issues
  | 'INVALID_EXPRESSION'
  | 'EXPRESSION_TYPE_MISMATCH'
  // Linker issues
  | 'DUPLICATE_PROVIDES'
  | 'UNRESOLVED_REFERENCE'
  | 'LINK_ERROR'
  // Provenance issues
  | 'MISSING_PROVENANCE'
  | 'INVALID_PROVENANCE'
  // Core validation
  | 'CORE_VALIDATION_ERROR'
  // HITL (Human-in-the-Loop) issues
  | 'HITL_APPROVAL_REQUIRED'
  | 'HITL_APPROVAL_DENIED'
  | 'HITL_APPROVAL_TIMEOUT'
  // Allowlist enforcement issues
  | 'ENDPOINT_NOT_ALLOWED'
  | 'EFFECT_TYPE_NOT_ALLOWED'
  // Core Extension Proposal issues (헌법 제7조)
  | 'UNSUPPORTED_OPERATOR'
  | 'UNSUPPORTED_EFFECT_TYPE'
  | 'CORE_EXTENSION_PROPOSAL'
  // General
  | 'UNKNOWN_ERROR';

/**
 * A validation issue
 *
 * Issues indicate problems with fragments or the linked domain.
 */
export interface Issue {
  /** Unique issue identifier */
  id: IssueId;

  /** Issue code for categorization */
  code: IssueCode;

  /** Severity level */
  severity: IssueSeverity;

  /** Human-readable issue description */
  message: string;

  /** Related semantic path (if applicable) */
  path?: SemanticPath;

  /** Related fragment IDs */
  relatedFragments?: FragmentId[];

  /** Suggested fix as a patch hint */
  suggestedFix?: PatchHint;

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * Create a unique issue ID
 */
export function createIssueId(): IssueId {
  return `issue_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a MISSING_DEPENDENCY issue
 */
export function missingDependencyIssue(
  path: SemanticPath,
  missingDep: SemanticPath,
  relatedFragments?: FragmentId[],
  suggestedFix?: PatchHint
): Issue {
  return {
    id: createIssueId(),
    code: 'MISSING_DEPENDENCY',
    severity: 'error',
    message: `Path "${path}" depends on undefined path "${missingDep}"`,
    path,
    relatedFragments,
    suggestedFix,
    context: { missingDep },
  };
}

/**
 * Create a CYCLIC_DEPENDENCY issue
 */
export function cyclicDependencyIssue(
  cycle: SemanticPath[],
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'CYCLIC_DEPENDENCY',
    severity: 'error',
    message: `Cyclic dependency detected: ${cycle.join(' -> ')}`,
    path: cycle[0],
    relatedFragments,
    context: { cycle },
  };
}

/**
 * Create an INVALID_PATH issue
 */
export function invalidPathIssue(
  path: SemanticPath,
  reason: string,
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'INVALID_PATH',
    severity: 'error',
    message: `Invalid path "${path}": ${reason}`,
    path,
    relatedFragments,
  };
}

/**
 * Create an INVALID_PRECONDITION_PATH issue
 */
export function invalidPreconditionPathIssue(
  actionId: string,
  invalidPath: SemanticPath,
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'INVALID_PRECONDITION_PATH',
    severity: 'error',
    message: `Action "${actionId}" has precondition referencing undefined path "${invalidPath}"`,
    path: invalidPath,
    relatedFragments,
    context: { actionId },
  };
}

/**
 * Create an ACTION_VERB_REQUIRED issue
 */
export function actionVerbRequiredIssue(
  actionId: string,
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'ACTION_VERB_REQUIRED',
    severity: 'warning',
    message: `Action "${actionId}" requires a verb in semantic metadata`,
    relatedFragments,
    context: { actionId },
  };
}

/**
 * Create a MISSING_PROVENANCE issue
 */
export function missingProvenanceIssue(fragmentId: FragmentId): Issue {
  return {
    id: createIssueId(),
    code: 'MISSING_PROVENANCE',
    severity: 'error',
    message: `Fragment "${fragmentId}" is missing provenance (origin or evidence)`,
    relatedFragments: [fragmentId],
  };
}

/**
 * Create an EFFECT_RISK_TOO_HIGH issue
 */
export function effectRiskTooHighIssue(
  fragmentId: FragmentId,
  risk: string,
  maxAllowed: string
): Issue {
  return {
    id: createIssueId(),
    code: 'EFFECT_RISK_TOO_HIGH',
    severity: 'warning',
    message: `Effect risk level "${risk}" exceeds maximum allowed "${maxAllowed}"`,
    relatedFragments: [fragmentId],
    context: { risk, maxAllowed },
  };
}

/**
 * Check if an issue is blocking (severity === 'error')
 */
export function isBlockingIssue(issue: Issue): boolean {
  return issue.severity === 'error';
}

/**
 * Filter issues by severity
 */
export function filterIssuesBySeverity(
  issues: Issue[],
  severity: IssueSeverity
): Issue[] {
  return issues.filter((i) => i.severity === severity);
}

/**
 * Get error issues only
 */
export function getErrorIssues(issues: Issue[]): Issue[] {
  return filterIssuesBySeverity(issues, 'error');
}

/**
 * Get warning issues only
 */
export function getWarningIssues(issues: Issue[]): Issue[] {
  return filterIssuesBySeverity(issues, 'warning');
}

// ============================================================================
// HITL Issue Factory Functions
// ============================================================================

/**
 * Create a HITL_APPROVAL_REQUIRED issue
 */
export function hitlApprovalRequiredIssue(
  fragmentId: FragmentId,
  effectType: string,
  riskLevel: string,
  description?: string
): Issue {
  return {
    id: createIssueId(),
    code: 'HITL_APPROVAL_REQUIRED',
    severity: 'error',
    message: description ?? `Effect "${effectType}" with risk level "${riskLevel}" requires human approval`,
    relatedFragments: [fragmentId],
    context: { effectType, riskLevel },
  };
}

/**
 * Create a HITL_APPROVAL_DENIED issue
 */
export function hitlApprovalDeniedIssue(
  fragmentId: FragmentId,
  effectType: string,
  reason?: string
): Issue {
  return {
    id: createIssueId(),
    code: 'HITL_APPROVAL_DENIED',
    severity: 'error',
    message: reason
      ? `Effect "${effectType}" was denied: ${reason}`
      : `Effect "${effectType}" was denied by human reviewer`,
    relatedFragments: [fragmentId],
    context: { effectType, reason },
  };
}

/**
 * Create a HITL_APPROVAL_TIMEOUT issue
 */
export function hitlApprovalTimeoutIssue(
  fragmentId: FragmentId,
  effectType: string,
  timeoutMs: number
): Issue {
  return {
    id: createIssueId(),
    code: 'HITL_APPROVAL_TIMEOUT',
    severity: 'error',
    message: `Approval for effect "${effectType}" timed out after ${timeoutMs}ms`,
    relatedFragments: [fragmentId],
    context: { effectType, timeoutMs },
  };
}

// ============================================================================
// Allowlist Issue Factory Functions
// ============================================================================

/**
 * Create an ENDPOINT_NOT_ALLOWED issue
 */
export function endpointNotAllowedIssue(
  fragmentId: FragmentId,
  endpoint: string,
  allowedEndpoints: string[]
): Issue {
  return {
    id: createIssueId(),
    code: 'ENDPOINT_NOT_ALLOWED',
    severity: 'error',
    message: `Endpoint "${endpoint}" is not in the allowed list`,
    relatedFragments: [fragmentId],
    context: { endpoint, allowedEndpoints },
  };
}

/**
 * Create an EFFECT_TYPE_NOT_ALLOWED issue
 */
export function effectTypeNotAllowedIssue(
  fragmentId: FragmentId,
  effectType: string,
  allowedEffectTypes: string[]
): Issue {
  return {
    id: createIssueId(),
    code: 'EFFECT_TYPE_NOT_ALLOWED',
    severity: 'error',
    message: `Effect type "${effectType}" is not in the allowed list`,
    relatedFragments: [fragmentId],
    context: { effectType, allowedEffectTypes },
  };
}

// ============================================================================
// Core Extension Proposal Issue Factory Functions (헌법 제7조)
// ============================================================================

/**
 * Create an UNSUPPORTED_OPERATOR issue
 *
 * 헌법 제7조: Core에 없는 operator를 발견했을 때 Issue로 노출
 */
export function unsupportedOperatorIssue(
  operator: string,
  location?: { file?: string; line?: number },
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'UNSUPPORTED_OPERATOR',
    severity: 'warning',
    message: `Unknown operator "${operator}" - Core Expression DSL에 정의되지 않았습니다. Core 확장이 필요할 수 있습니다.`,
    relatedFragments,
    context: { operator, location },
  };
}

/**
 * Create an UNSUPPORTED_EFFECT_TYPE issue
 *
 * 헌법 제7조: Core에 없는 effect type을 발견했을 때 Issue로 노출
 */
export function unsupportedEffectTypeIssue(
  effectType: string,
  callee?: string,
  relatedFragments?: FragmentId[]
): Issue {
  return {
    id: createIssueId(),
    code: 'UNSUPPORTED_EFFECT_TYPE',
    severity: 'warning',
    message: `Unknown effect pattern "${effectType}" - Core Effect에 정의되지 않았습니다. Core 확장이 필요할 수 있습니다.`,
    relatedFragments,
    context: { effectType, callee },
  };
}

/**
 * Create a CORE_EXTENSION_PROPOSAL issue
 *
 * 헌법 제7조: Core 확장이 필요할 때 사용자/Agent에게 명시적으로 제안
 */
export function coreExtensionProposalIssue(
  feature: string,
  description: string,
  alternative?: string,
  relatedFragments?: FragmentId[]
): Issue {
  const message = alternative
    ? `Core 확장 제안: "${feature}" - ${description}. 대안: ${alternative}`
    : `Core 확장 제안: "${feature}" - ${description}`;

  return {
    id: createIssueId(),
    code: 'CORE_EXTENSION_PROPOSAL',
    severity: 'suggestion',
    message,
    relatedFragments,
    context: { feature, description, alternative },
  };
}
