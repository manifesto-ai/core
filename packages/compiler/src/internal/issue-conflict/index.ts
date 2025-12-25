/**
 * Issue/Conflict Utilities
 *
 * Consolidated utilities for issue and conflict handling.
 *
 * TRD 1.5: internal/ 공용 유틸 폴더
 */

export {
  // Issue sorting
  sortIssues,
  getBlockingIssues,
  hasBlockingIssues,
  // Conflict sorting
  getBlockingConflicts,
  hasBlockingConflicts,
  sortConflicts,
} from './sorting.js';
