/**
 * Skeleton IR - LLM output structure
 *
 * ⚠️ IMPORTANT: LLM outputs targetHint (user's text), NOT taskId.
 * Resolver is responsible for resolving targetHint → taskId.
 */

import type { TaskStatus, TaskPriority, ViewMode, DateFilterType } from './prompts/schema';

// ============================================
// Base Skeleton Interface
// ============================================

export interface BaseSkeleton {
  kind: string;
  confidence: number;
  source: 'human' | 'agent';
}

// ============================================
// Task Reference Skeletons (targetHint from LLM)
// ============================================

export interface ChangeStatusSkeleton extends BaseSkeleton {
  kind: 'ChangeStatus';
  targetHint: string;  // User's text, NOT taskId
  toStatus: TaskStatus;
}

export interface UpdateTaskSkeleton extends BaseSkeleton {
  kind: 'UpdateTask';
  targetHint: string;  // User's text, NOT taskId
  changes: {
    title?: string;
    description?: string;
    priority?: TaskPriority;
    tags?: string[];
    dueDate?: string | null;
    assignee?: string;
  };
}

export interface DeleteTaskSkeleton extends BaseSkeleton {
  kind: 'DeleteTask';
  targetHint: string;  // User's text, NOT taskId
}

export interface RestoreTaskSkeleton extends BaseSkeleton {
  kind: 'RestoreTask';
  targetHint: string;  // User's text, NOT taskId
}

export interface SelectTaskSkeleton extends BaseSkeleton {
  kind: 'SelectTask';
  targetHint: string;  // User's text, NOT taskId
}

// ============================================
// Non-Reference Skeletons
// ============================================

export interface TaskToCreateSkeleton {
  title: string;
  description?: string;
  priority?: TaskPriority;
  tags?: string[];
  dueDate?: string;
}

export interface CreateTaskSkeleton extends BaseSkeleton {
  kind: 'CreateTask';
  tasks: TaskToCreateSkeleton[];
}

export interface ChangeViewSkeleton extends BaseSkeleton {
  kind: 'ChangeView';
  viewMode: ViewMode;
}

export interface SetDateFilterSkeleton extends BaseSkeleton {
  kind: 'SetDateFilter';
  filter: {
    field: 'dueDate' | 'createdAt';
    type: DateFilterType;
    startDate?: string;
    endDate?: string;
  } | null;
}

export interface QueryTasksSkeleton extends BaseSkeleton {
  kind: 'QueryTasks';
  query: string;
}

export interface ToggleAssistantSkeleton extends BaseSkeleton {
  kind: 'ToggleAssistant';
  open: boolean;
}

export interface UndoSkeleton extends BaseSkeleton {
  kind: 'Undo';
}

// ============================================
// Union Types
// ============================================

export type TaskRefSkeleton =
  | ChangeStatusSkeleton
  | UpdateTaskSkeleton
  | DeleteTaskSkeleton
  | RestoreTaskSkeleton
  | SelectTaskSkeleton;

export type NonRefSkeleton =
  | CreateTaskSkeleton
  | ChangeViewSkeleton
  | SetDateFilterSkeleton
  | QueryTasksSkeleton
  | ToggleAssistantSkeleton
  | UndoSkeleton;

export type IntentSkeleton = TaskRefSkeleton | NonRefSkeleton;

export const SKELETON_KINDS = [
  'ChangeStatus',
  'UpdateTask',
  'DeleteTask',
  'RestoreTask',
  'SelectTask',
  'CreateTask',
  'ChangeView',
  'SetDateFilter',
  'QueryTasks',
  'ToggleAssistant',
  'Undo',
] as const;

export type SkeletonKind = (typeof SKELETON_KINDS)[number];

// ============================================
// Type Guards
// ============================================

export function requiresTaskResolution(skeleton: IntentSkeleton): skeleton is TaskRefSkeleton {
  return ['ChangeStatus', 'UpdateTask', 'DeleteTask', 'RestoreTask', 'SelectTask'].includes(skeleton.kind);
}

/**
 * Check if skeleton has a targetHint for resolution
 */
export function hasTargetHint(skeleton: TaskRefSkeleton): boolean {
  return !!skeleton.targetHint && skeleton.targetHint.trim().length > 0;
}

// Legacy alias - deprecated, use hasTargetHint
export function hasTaskId(skeleton: TaskRefSkeleton): boolean {
  return hasTargetHint(skeleton);
}

// ============================================
// Validation
// ============================================

export interface SkeletonValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSkeleton(skeleton: unknown): SkeletonValidationResult {
  const errors: string[] = [];

  if (!skeleton || typeof skeleton !== 'object') {
    return { valid: false, errors: ['Skeleton must be an object'] };
  }

  const obj = skeleton as Record<string, unknown>;

  if (!obj.kind || typeof obj.kind !== 'string') {
    errors.push('Skeleton must have a "kind" field');
  } else if (!SKELETON_KINDS.includes(obj.kind as SkeletonKind)) {
    errors.push(`Unknown skeleton kind: ${obj.kind}`);
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    errors.push('Skeleton must have a valid "confidence" field (0-1)');
  }

  if (!['human', 'agent'].includes(obj.source as string)) {
    errors.push('Skeleton must have a valid "source" field');
  }

  if (obj.kind && errors.length === 0) {
    const kindErrors = validateSkeletonByKind(obj as unknown as IntentSkeleton);
    errors.push(...kindErrors);
  }

  return { valid: errors.length === 0, errors };
}

function validateSkeletonByKind(skeleton: IntentSkeleton): string[] {
  const errors: string[] = [];

  switch (skeleton.kind) {
    case 'ChangeStatus':
      // taskId can be null (LLM couldn't determine)
      if (!['todo', 'in-progress', 'review', 'done'].includes(skeleton.toStatus)) {
        errors.push('ChangeStatus: invalid toStatus');
      }
      break;

    case 'UpdateTask':
      if (!skeleton.changes || typeof skeleton.changes !== 'object') {
        errors.push('UpdateTask: changes is required');
      }
      break;

    case 'DeleteTask':
    case 'RestoreTask':
    case 'SelectTask':
      // taskId can be null
      break;

    case 'CreateTask':
      if (!skeleton.tasks || !Array.isArray(skeleton.tasks) || skeleton.tasks.length === 0) {
        errors.push('CreateTask: tasks array is required and must not be empty');
      } else {
        for (let i = 0; i < skeleton.tasks.length; i++) {
          const task = skeleton.tasks[i];
          if (!task.title || typeof task.title !== 'string') {
            errors.push(`CreateTask: tasks[${i}].title is required`);
          }
        }
      }
      break;

    case 'ChangeView':
      if (!['kanban', 'table', 'todo'].includes(skeleton.viewMode)) {
        errors.push('ChangeView: invalid viewMode');
      }
      break;

    case 'SetDateFilter':
      if (skeleton.filter !== null) {
        if (!['dueDate', 'createdAt'].includes(skeleton.filter.field)) {
          errors.push('SetDateFilter: invalid filter.field');
        }
        if (!['today', 'week', 'month', 'custom'].includes(skeleton.filter.type)) {
          errors.push('SetDateFilter: invalid filter.type');
        }
      }
      break;

    case 'QueryTasks':
      if (!skeleton.query || typeof skeleton.query !== 'string') {
        errors.push('QueryTasks: query is required');
      }
      break;

    case 'ToggleAssistant':
      if (typeof skeleton.open !== 'boolean') {
        errors.push('ToggleAssistant: open must be a boolean');
      }
      break;
  }

  return errors;
}
