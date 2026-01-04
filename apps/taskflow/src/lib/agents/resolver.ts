/**
 * Symbol Resolver - resolves targetHint to taskId
 *
 * LLM outputs targetHint (user's text), Resolver finds matching task.
 * This is the ONLY place where taskId binding happens.
 *
 * Resolution strategy:
 * 1. Semantic filter match (priority, assignee, tags, status)
 * 2. Exact match on task title
 * 3. Substring match (hint contained in title or vice versa)
 * 4. Keyword overlap
 *
 * Bulk operations:
 * - When semantic filter matches multiple tasks, returns taskIds array
 * - Supports UpdateTask, ChangeStatus, DeleteTask with bulk
 */

import type { Task } from '@/manifesto';
import type { Snapshot } from './runtime';
import type {
  IntentSkeleton,
  TaskRefSkeleton,
  ChangeStatusSkeleton,
  UpdateTaskSkeleton,
  DeleteTaskSkeleton,
  RestoreTaskSkeleton,
  SelectTaskSkeleton,
} from './skeleton';
import { requiresTaskResolution, hasTargetHint } from './skeleton';
import type {
  Intent,
  ChangeStatusIntent,
  UpdateTaskIntent,
  DeleteTaskIntent,
  RestoreTaskIntent,
  SelectTaskIntent,
} from './intent';

// ============================================
// Semantic Filter Types
// ============================================

export interface SemanticFilter {
  priority?: 'low' | 'medium' | 'high';
  status?: 'todo' | 'in-progress' | 'review' | 'done';
  assignee?: string;
  tags?: string[];
  unassigned?: boolean;  // "할당 안 된" matches tasks where assignee is null
  isBulk: boolean;       // Whether this is a bulk operation ("전부", "모든", "다")
  titleHint?: string;    // Remaining text for title matching
}

/**
 * Parse targetHint into semantic filters
 *
 * Examples:
 * - "low priority 전부" → { priority: 'low', isBulk: true }
 * - "수진이 태스크" → { assignee: '수진', isBulk: true }
 * - "디자인 태그 있는 거" → { tags: ['디자인'], isBulk: true }
 * - "todo 상태인 것" → { status: 'todo', isBulk: true }
 * - "투자자 미팅" → { titleHint: '투자자 미팅', isBulk: false }
 */
export function parseSemanticFilter(hint: string): SemanticFilter {
  const normalizedHint = hint.toLowerCase().trim();

  const filter: SemanticFilter = {
    isBulk: false,
  };

  // Check for bulk indicators
  const bulkPatterns = ['전부', '모든', '모두', '다 ', '전체', '있는 거', '있는거', '*', 'all'];
  if (bulkPatterns.some(p => normalizedHint.includes(p))) {
    filter.isBulk = true;
  }

  // Priority patterns
  const priorityPatterns: Array<{ pattern: RegExp; value: 'low' | 'medium' | 'high' }> = [
    { pattern: /low\s*priority|낮은\s*(우선)?순위|priority\s*low/, value: 'low' },
    { pattern: /medium\s*priority|중간\s*(우선)?순위|보통\s*(우선)?순위|priority\s*medium/, value: 'medium' },
    { pattern: /high\s*priority|높은\s*(우선)?순위|긴급|중요|매우\s*중요|priority\s*high/, value: 'high' },
  ];
  for (const { pattern, value } of priorityPatterns) {
    if (pattern.test(normalizedHint)) {
      filter.priority = value;
      filter.isBulk = true; // Priority filter implies bulk
      break;
    }
  }

  // Status patterns
  const statusPatterns: Array<{ pattern: RegExp; value: 'todo' | 'in-progress' | 'review' | 'done' }> = [
    { pattern: /\btodo\b|할\s*일|대기/, value: 'todo' },
    { pattern: /in-progress|진행\s*중|작업\s*중/, value: 'in-progress' },
    { pattern: /\breview\b|리뷰|검토\s*중/, value: 'review' },
    { pattern: /\bdone\b|완료|끝난/, value: 'done' },
  ];
  for (const { pattern, value } of statusPatterns) {
    if (pattern.test(normalizedHint)) {
      filter.status = value;
      filter.isBulk = true;
      break;
    }
  }

  // Assignee patterns (Korean names)
  const assigneePattern = /(수진|민수|영희)(?:이|한테|의|가|에게|\s)?\s*(담당|할당|태스크|작업|거|것)?/;
  const assigneeMatch = normalizedHint.match(assigneePattern);
  if (assigneeMatch) {
    filter.assignee = assigneeMatch[1];
    filter.isBulk = true;
  }

  // Unassigned pattern
  if (/할당\s*(안|없|미)\s*(된|는)?|담당자?\s*(없|미정)/.test(normalizedHint)) {
    filter.unassigned = true;
    filter.isBulk = true;
  }

  // Tag patterns
  const tagPatterns = [
    /(\S+)\s*태그/,
    /(디자인|UI|UX|개발|백엔드|프론트엔드|QA|테스트|인프라|문서|미팅|투자|보안|배포)\s*(관련|있는)?/,
  ];
  for (const pattern of tagPatterns) {
    const tagMatch = normalizedHint.match(pattern);
    if (tagMatch && tagMatch[1]) {
      const tagName = tagMatch[1].trim();
      // Avoid false positives for common words
      if (!['전부', '모든', '있는', '없는'].includes(tagName)) {
        filter.tags = [tagName];
        filter.isBulk = true;
        break;
      }
    }
  }

  // If no semantic filters found, treat as title hint
  if (!filter.priority && !filter.status && !filter.assignee && !filter.tags && !filter.unassigned) {
    // Remove bulk indicators for title matching
    let titleHint = normalizedHint;
    for (const p of bulkPatterns) {
      titleHint = titleHint.replace(p, '').trim();
    }
    if (titleHint) {
      filter.titleHint = titleHint;
      filter.isBulk = false;
    }
  }

  return filter;
}

/**
 * Find tasks matching semantic filter
 */
export function findTasksByFilter(filter: SemanticFilter, tasks: Task[]): Task[] {
  return tasks.filter(task => {
    // Priority filter
    if (filter.priority && task.priority !== filter.priority) {
      return false;
    }

    // Status filter
    if (filter.status && task.status !== filter.status) {
      return false;
    }

    // Assignee filter
    if (filter.assignee && (!task.assignee || !task.assignee.includes(filter.assignee))) {
      return false;
    }

    // Unassigned filter
    if (filter.unassigned && task.assignee !== null) {
      return false;
    }

    // Tags filter (any match)
    if (filter.tags && filter.tags.length > 0) {
      const taskTags = (task.tags || []).map(t => t.toLowerCase());
      const hasMatchingTag = filter.tags.some(filterTag =>
        taskTags.some(taskTag => taskTag.includes(filterTag.toLowerCase()))
      );
      if (!hasMatchingTag) {
        return false;
      }
    }

    return true;
  });
}

// ============================================
// Error Types
// ============================================

export type ResolverErrorType = 'not_found' | 'ambiguous' | 'deleted' | 'invalid_state';

export interface ResolverError {
  type: ResolverErrorType;
  message: string;
  hint: string;
  candidates?: Task[];
  suggestedQuestion: string;
}

// ============================================
// Result Types
// ============================================

export interface ResolverSuccess {
  intent: Intent;
  resolvedTask?: Task;
}

export type ResolverResult =
  | { success: true; data: ResolverSuccess }
  | { success: false; error: ResolverError };

export function isResolverSuccess(result: ResolverResult): result is { success: true; data: ResolverSuccess } {
  return result.success === true;
}

export function isResolverError(result: ResolverResult): result is { success: false; error: ResolverError } {
  return result.success === false;
}

// ============================================
// Main Resolver
// ============================================

export function resolveSkeleton(
  skeleton: IntentSkeleton,
  snapshot: Snapshot
): ResolverResult {
  // Non-task-ref skeletons pass through
  if (!requiresTaskResolution(skeleton)) {
    return {
      success: true,
      data: { intent: skeleton as unknown as Intent },
    };
  }

  const taskRef = skeleton as TaskRefSkeleton;

  // SelectTask with no hint = deselect
  if (skeleton.kind === 'SelectTask' && !hasTargetHint(taskRef)) {
    return {
      success: true,
      data: {
        intent: {
          kind: 'SelectTask',
          taskId: null,
          confidence: skeleton.confidence,
          source: skeleton.source,
        } as SelectTaskIntent,
      },
    };
  }

  // No targetHint = LLM couldn't determine, need clarification
  if (!hasTargetHint(taskRef)) {
    return {
      success: false,
      error: {
        type: 'not_found',
        message: 'Could not determine which task',
        hint: '',
        suggestedQuestion: getIntentAppropriateQuestion(skeleton.kind),
      },
    };
  }

  const targetHint = taskRef.targetHint;
  const activeTasks = snapshot.data.tasks.filter(t => !t.deletedAt);

  // Try semantic filter first
  const semanticFilter = parseSemanticFilter(targetHint);

  // Handle bulk operations with semantic filters
  if (semanticFilter.isBulk && !semanticFilter.titleHint) {
    const matchingTasks = findTasksByFilter(semanticFilter, activeTasks);

    if (matchingTasks.length === 0) {
      return {
        success: false,
        error: {
          type: 'not_found',
          message: `No tasks matching filter "${targetHint}"`,
          hint: targetHint,
          suggestedQuestion: 'No matching tasks found. Please specify which tasks.',
        },
      };
    }

    // Bulk ChangeStatus
    if (skeleton.kind === 'ChangeStatus') {
      const changeStatusSkeleton = skeleton as ChangeStatusSkeleton;
      return {
        success: true,
        data: {
          intent: {
            kind: 'ChangeStatus',
            taskIds: matchingTasks.map(t => t.id),
            toStatus: changeStatusSkeleton.toStatus,
            confidence: changeStatusSkeleton.confidence,
            source: changeStatusSkeleton.source,
          } as ChangeStatusIntent,
        },
      };
    }

    // Bulk UpdateTask
    if (skeleton.kind === 'UpdateTask') {
      const updateSkeleton = skeleton as UpdateTaskSkeleton;
      return {
        success: true,
        data: {
          intent: {
            kind: 'UpdateTask',
            taskIds: matchingTasks.map(t => t.id),
            changes: updateSkeleton.changes,
            confidence: updateSkeleton.confidence,
            source: updateSkeleton.source,
          } as UpdateTaskIntent & { taskIds: string[] },
        },
      };
    }

    // Bulk DeleteTask
    if (skeleton.kind === 'DeleteTask') {
      const deleteSkeleton = skeleton as DeleteTaskSkeleton;
      return {
        success: true,
        data: {
          intent: {
            kind: 'DeleteTask',
            taskIds: matchingTasks.map(t => t.id),
            confidence: deleteSkeleton.confidence,
            source: deleteSkeleton.source,
          } as DeleteTaskIntent & { taskIds: string[] },
        },
      };
    }
  }

  // Legacy bulk handling for ChangeStatus with "*" or "all"
  if (skeleton.kind === 'ChangeStatus') {
    const changeStatusSkeleton = skeleton as ChangeStatusSkeleton;
    const hint = changeStatusSkeleton.targetHint.toLowerCase().trim();

    if ((hint === '*' || hint === 'all') && changeStatusSkeleton.fromStatus) {
      const matchingTasks = activeTasks.filter(t => t.status === changeStatusSkeleton.fromStatus);

      if (matchingTasks.length === 0) {
        return {
          success: false,
          error: {
            type: 'not_found',
            message: `No tasks with status "${changeStatusSkeleton.fromStatus}" found`,
            hint: hint,
            suggestedQuestion: 'No matching tasks to change.',
          },
        };
      }

      return {
        success: true,
        data: {
          intent: {
            kind: 'ChangeStatus',
            taskIds: matchingTasks.map(t => t.id),
            toStatus: changeStatusSkeleton.toStatus,
            confidence: changeStatusSkeleton.confidence,
            source: changeStatusSkeleton.source,
          } as ChangeStatusIntent,
        },
      };
    }
  }

  // Single task resolution - use title hint if available
  const isRestore = skeleton.kind === 'RestoreTask';
  const searchPool = isRestore
    ? snapshot.data.tasks.filter(t => t.deletedAt)
    : snapshot.data.tasks.filter(t => !t.deletedAt);

  // Find matching tasks
  const matches = findMatchingTasks(targetHint, searchPool);

  if (matches.length === 0) {
    return {
      success: false,
      error: {
        type: 'not_found',
        message: `No task found matching "${targetHint}"`,
        hint: targetHint,
        suggestedQuestion: getIntentAppropriateQuestion(skeleton.kind),
      },
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      error: {
        type: 'ambiguous',
        message: `Multiple tasks match "${targetHint}"`,
        hint: targetHint,
        candidates: matches,
        suggestedQuestion: `Which one: ${matches.map(t => `"${t.title}"`).join(' or ')}?`,
      },
    };
  }

  // Exactly one match - success
  const task = matches[0]!;
  const intent = skeletonToIntent(skeleton, task.id);

  return {
    success: true,
    data: { intent, resolvedTask: task },
  };
}

// ============================================
// Task Matching (targetHint resolution)
// ============================================

/**
 * Find tasks matching the given hint
 * Resolution priority:
 * 1. Exact match (case-insensitive)
 * 2. Substring match (hint in title or title in hint)
 * 3. Keyword overlap
 */
function findMatchingTasks(hint: string, tasks: Task[]): Task[] {
  const normalizedHint = hint.toLowerCase().trim();

  // 1. Exact match
  const exactMatches = tasks.filter(
    t => t.title.toLowerCase() === normalizedHint
  );
  if (exactMatches.length > 0) return exactMatches;

  // 2. Substring match (bidirectional)
  const substringMatches = tasks.filter(t => {
    const title = t.title.toLowerCase();
    return title.includes(normalizedHint) || normalizedHint.includes(title);
  });
  if (substringMatches.length > 0) return substringMatches;

  // 3. Keyword overlap (for multi-word hints)
  const hintWords = normalizedHint.split(/\s+/).filter(w => w.length > 1);
  if (hintWords.length > 0) {
    const keywordMatches = tasks.filter(t => {
      const titleLower = t.title.toLowerCase();
      return hintWords.some(word => titleLower.includes(word));
    });
    if (keywordMatches.length > 0) return keywordMatches;
  }

  return [];
}

// ============================================
// Helpers
// ============================================

function getIntentAppropriateQuestion(kind: string): string {
  switch (kind) {
    case 'SelectTask': return 'Which task would you like to view?';
    case 'UpdateTask': return 'Which task would you like to modify?';
    case 'DeleteTask': return 'Which task would you like to delete?';
    case 'RestoreTask': return 'Which task would you like to restore?';
    case 'ChangeStatus': return 'Which task would you like to change?';
    default: return 'Which task do you mean?';
  }
}

function skeletonToIntent(skeleton: TaskRefSkeleton, taskId: string): Intent {
  switch (skeleton.kind) {
    case 'ChangeStatus': {
      const s = skeleton as ChangeStatusSkeleton;
      return {
        kind: 'ChangeStatus',
        taskId,
        toStatus: s.toStatus,
        confidence: s.confidence,
        source: s.source,
      } as ChangeStatusIntent;
    }

    case 'UpdateTask': {
      const s = skeleton as UpdateTaskSkeleton;
      return {
        kind: 'UpdateTask',
        taskId,
        changes: s.changes,
        confidence: s.confidence,
        source: s.source,
      } as UpdateTaskIntent;
    }

    case 'DeleteTask': {
      const s = skeleton as DeleteTaskSkeleton;
      return {
        kind: 'DeleteTask',
        taskId,
        confidence: s.confidence,
        source: s.source,
      } as DeleteTaskIntent;
    }

    case 'RestoreTask': {
      const s = skeleton as RestoreTaskSkeleton;
      return {
        kind: 'RestoreTask',
        taskId,
        confidence: s.confidence,
        source: s.source,
      } as RestoreTaskIntent;
    }

    case 'SelectTask': {
      const s = skeleton as SelectTaskSkeleton;
      return {
        kind: 'SelectTask',
        taskId,
        confidence: s.confidence,
        source: s.source,
      } as SelectTaskIntent;
    }

    default:
      return skeleton as unknown as Intent;
  }
}

// Legacy exports for compatibility
export function generateClarificationQuestion(
  errorType: ResolverErrorType,
  hint: string,
  candidates?: Task[]
): string {
  return getIntentAppropriateQuestion('SelectTask');
}

export function resolveSkeletonWithTaskId(
  skeleton: TaskRefSkeleton,
  taskId: string,
  snapshot: Snapshot
): ResolverResult {
  const task = snapshot.data.tasks.find(t => t.id === taskId);

  if (!task) {
    return {
      success: false,
      error: {
        type: 'not_found',
        message: `Task ${taskId} not found`,
        hint: taskId,
        suggestedQuestion: 'Task not found.',
      },
    };
  }

  return {
    success: true,
    data: {
      intent: skeletonToIntent(skeleton, taskId),
      resolvedTask: task,
    },
  };
}
