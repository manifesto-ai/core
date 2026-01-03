/**
 * Symbol Resolver - resolves targetHint to taskId
 *
 * LLM outputs targetHint (user's text), Resolver finds matching task.
 * This is the ONLY place where taskId binding happens.
 *
 * Resolution strategy:
 * 1. Exact match on task title
 * 2. Substring match (hint contained in title or vice versa)
 * 3. Semantic match (keywords overlap)
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

  // Resolve targetHint to task
  const targetHint = taskRef.targetHint;
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
