/**
 * Issue and Conflict Sorting Utilities
 *
 * Consolidated from linker/index.ts and verifier/issue-mapper.ts
 * to provide a single source of truth for issue/conflict sorting.
 *
 * TRD 1.5: internal/ 공용 유틸 폴더
 */

import type { Issue, IssueSeverity } from '../../types/issue.js';
import type { Conflict } from '../../types/conflict.js';

// ============================================================================
// Issue Sorting
// ============================================================================

/**
 * Severity order for sorting (errors first)
 */
const SEVERITY_ORDER: Record<IssueSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
  suggestion: 3,
};

/**
 * Sort issues by severity (errors first), then by code, then by path
 *
 * @param issues - Issues to sort
 * @returns Sorted copy of issues array
 */
export function sortIssues(issues: Issue[]): Issue[] {
  return [...issues].sort((a, b) => {
    // Sort by severity first
    const sevA = SEVERITY_ORDER[a.severity] ?? 4;
    const sevB = SEVERITY_ORDER[b.severity] ?? 4;
    if (sevA !== sevB) return sevA - sevB;

    // Then by code
    if (a.code !== b.code) return a.code.localeCompare(b.code);

    // Then by path
    if (a.path && b.path) return a.path.localeCompare(b.path);
    if (a.path) return -1;
    if (b.path) return 1;

    return 0;
  });
}

/**
 * Get blocking issues (errors that prevent domain generation)
 *
 * @param issues - Issues to filter
 * @returns Issues with severity 'error'
 */
export function getBlockingIssues(issues: Issue[]): Issue[] {
  return issues.filter((i) => i.severity === 'error');
}

/**
 * Check if there are any blocking issues
 *
 * @param issues - Issues to check
 * @returns true if any issues have severity 'error'
 */
export function hasBlockingIssues(issues: Issue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

// ============================================================================
// Conflict Sorting
// ============================================================================

/**
 * Conflict types that block domain generation
 */
const BLOCKING_CONFLICT_TYPES = new Set([
  'duplicate_provides',
  'schema_mismatch',
  'dependency_conflict',
]);

/**
 * Get blocking conflicts (conflicts that prevent domain generation)
 *
 * @param conflicts - Conflicts to filter
 * @returns Conflicts that block domain generation
 */
export function getBlockingConflicts(conflicts: Conflict[]): Conflict[] {
  return conflicts.filter((c) => BLOCKING_CONFLICT_TYPES.has(c.type));
}

/**
 * Check if there are any blocking conflicts
 *
 * @param conflicts - Conflicts to check
 * @returns true if any conflicts block domain generation
 */
export function hasBlockingConflicts(conflicts: Conflict[]): boolean {
  return conflicts.some((c) => BLOCKING_CONFLICT_TYPES.has(c.type));
}

/**
 * Sort conflicts by type, then by target
 *
 * @param conflicts - Conflicts to sort
 * @returns Sorted copy of conflicts array
 */
export function sortConflicts(conflicts: Conflict[]): Conflict[] {
  return [...conflicts].sort((a, b) => {
    // Sort by type first
    if (a.type !== b.type) return a.type.localeCompare(b.type);

    // Then by target
    if (a.target !== b.target) return a.target.localeCompare(b.target);

    // Finally by candidates (for determinism)
    return a.candidates.join(',').localeCompare(b.candidates.join(','));
  });
}
