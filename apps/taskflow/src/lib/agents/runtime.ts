/**
 * Intent-Native Runtime
 *
 * ADR 섹션 5: Runtime 실행 규칙
 * - Intent Schema 검증
 * - 권한/맥락 검증
 * - Intent → Effect 변환 (결정론)
 * - Snapshot 업데이트
 *
 * Runtime은 Intent를 해석하지 않는다. 오직 구조적으로 처리한다.
 */

import type { Task } from '@/manifesto';
import type { AgentEffect, PatchOp } from './types';
import { generateEffectId } from './types';
import type {
  Intent,
  ChangeViewIntent,
  SetDateFilterIntent,
  CreateTaskIntent,
  UpdateTaskIntent,
  ChangeStatusIntent,
  DeleteTaskIntent,
  RestoreTaskIntent,
  SelectTaskIntent,
  QueryTasksIntent,
  ToggleAssistantIntent,
  UndoIntent,
} from './intent';
import { validateIntent, isReadOnlyIntent } from './intent';

// ============================================
// Snapshot Types
// ============================================

export interface Snapshot {
  data: {
    tasks: Task[];
  };
  state: {
    viewMode: 'kanban' | 'table' | 'todo';
    dateFilter: {
      field: 'dueDate' | 'createdAt';
      type: 'today' | 'week' | 'month' | 'custom';
      startDate?: string;
      endDate?: string;
    } | null;
    selectedTaskId: string | null;
    /** IDs of recently created tasks (for "what I just added" queries) */
    lastCreatedTaskIds?: string[];
    /** ID of recently modified task (for "the one I just changed" queries) */
    lastModifiedTaskId?: string | null;
  };
}

// ============================================
// Runtime Execution Result
// ============================================

export interface ExecutionResult {
  success: boolean;
  effects: AgentEffect[];
  error?: string;
  intent: Intent;
}

// ============================================
// Main Runtime Function
// ============================================

/**
 * Intent를 실행하고 Effects를 생성
 *
 * ADR: Runtime은 Intent를 해석하지 않는다. 오직 구조적으로 처리한다.
 *
 * @param intent - 실행할 Intent
 * @param snapshot - 현재 Snapshot
 * @returns ExecutionResult
 */
export function executeIntent(intent: Intent, snapshot: Snapshot): ExecutionResult {
  // 1. Intent Schema 검증
  const validation = validateIntent(intent);
  if (!validation.valid) {
    return {
      success: false,
      effects: [],
      error: `Intent validation failed: ${validation.errors.join(', ')}`,
      intent,
    };
  }

  // 2. 읽기 전용 Intent는 Effects 없이 성공
  if (isReadOnlyIntent(intent)) {
    return {
      success: true,
      effects: [],
      intent,
    };
  }

  // 3. Intent → Effect 변환 (결정론적)
  try {
    const effects = generateEffects(intent, snapshot);
    return {
      success: true,
      effects,
      intent,
    };
  } catch (e) {
    return {
      success: false,
      effects: [],
      error: e instanceof Error ? e.message : 'Unknown error during effect generation',
      intent,
    };
  }
}

// ============================================
// Effect Generation (Deterministic)
// ============================================

/**
 * Intent로부터 Effects 생성 (결정론적)
 */
function generateEffects(intent: Intent, snapshot: Snapshot): AgentEffect[] {
  const ops: PatchOp[] = [];

  switch (intent.kind) {
    case 'ChangeView':
      ops.push(...generateChangeViewEffects(intent));
      break;

    case 'SetDateFilter':
      ops.push(...generateSetDateFilterEffects(intent));
      break;

    case 'CreateTask':
      ops.push(...generateCreateTaskEffects(intent));
      break;

    case 'UpdateTask':
      ops.push(...generateUpdateTaskEffects(intent, snapshot));
      break;

    case 'ChangeStatus':
      ops.push(...generateChangeStatusEffects(intent, snapshot));
      break;

    case 'DeleteTask':
      ops.push(...generateDeleteTaskEffects(intent));
      break;

    case 'RestoreTask':
      ops.push(...generateRestoreTaskEffects(intent));
      break;

    case 'SelectTask':
      ops.push(...generateSelectTaskEffects(intent));
      break;

    case 'QueryTasks':
      // 읽기 전용 - Effects 없음
      break;

    case 'ToggleAssistant':
      ops.push(...generateToggleAssistantEffects(intent));
      break;

    case 'Undo':
      // Undo returns special effect - FE handles history pop
      return [{
        type: 'snapshot.undo',
        id: generateEffectId(),
      }];

    case 'RequestClarification':
      // Clarification은 상태 변경 없음 - Effects 없음
      // 사용자에게 되묻기만 하고 후속 응답을 기다림
      break;
  }

  if (ops.length === 0) {
    return [];
  }

  return [{
    type: 'snapshot.patch',
    id: generateEffectId(),
    ops,
  }];
}

// ============================================
// Effect Generators by Intent Kind
// ============================================

function generateChangeViewEffects(intent: ChangeViewIntent): PatchOp[] {
  return [{
    op: 'set',
    path: 'state.viewMode',
    value: intent.viewMode,
  }];
}

function generateSetDateFilterEffects(intent: SetDateFilterIntent): PatchOp[] {
  return [{
    op: 'set',
    path: 'state.dateFilter',
    value: intent.filter,
  }];
}

function generateCreateTaskEffects(intent: CreateTaskIntent): PatchOp[] {
  const now = new Date().toISOString();
  const ops: PatchOp[] = [];

  // 모든 tasks를 순회하며 각각 append operation 생성
  for (let i = 0; i < intent.tasks.length; i++) {
    const taskDef = intent.tasks[i];
    const task: Task = {
      id: `task-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      title: taskDef.title,
      description: taskDef.description ?? null,
      status: 'todo', // 새 태스크는 항상 todo
      priority: taskDef.priority || 'medium',
      assignee: null,
      tags: taskDef.tags || [],
      dueDate: taskDef.dueDate ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    ops.push({
      op: 'append',
      path: 'data.tasks',
      value: task,
    });
  }

  return ops;
}

function generateUpdateTaskEffects(intent: UpdateTaskIntent, snapshot: Snapshot): PatchOp[] {
  // Task 존재 여부 확인
  const task = snapshot.data.tasks.find(t => t.id === intent.taskId);
  if (!task) {
    throw new Error(`Task not found: ${intent.taskId}`);
  }

  const ops: PatchOp[] = [];
  const now = new Date().toISOString();

  // 각 변경 사항에 대해 set operation 생성 (taskId 사용)
  for (const [key, value] of Object.entries(intent.changes)) {
    if (value !== undefined) {
      ops.push({
        op: 'set',
        path: `data.tasks.id:${intent.taskId}.${key}`,
        value,
      });
    }
  }

  // updatedAt 자동 업데이트
  if (ops.length > 0) {
    ops.push({
      op: 'set',
      path: `data.tasks.id:${intent.taskId}.updatedAt`,
      value: now,
    });
  }

  return ops;
}

/**
 * ChangeStatus Intent → Effects
 *
 * 상태 전이 전용 핸들러 (1급 Intent)
 * UpdateTask.changes.status와 별개로 존재하는 이유:
 * - 상태 전이는 도메인에서 가장 빈번하고 중요한 동작
 * - 명확한 의미 단위로 처리됨
 */
function generateChangeStatusEffects(intent: ChangeStatusIntent, snapshot: Snapshot): PatchOp[] {
  // Task 존재 여부 확인
  const task = snapshot.data.tasks.find(t => t.id === intent.taskId);
  if (!task) {
    throw new Error(`Task not found: ${intent.taskId}`);
  }

  const now = new Date().toISOString();

  return [
    {
      op: 'set',
      path: `data.tasks.id:${intent.taskId}.status`,
      value: intent.toStatus,
    },
    {
      op: 'set',
      path: `data.tasks.id:${intent.taskId}.updatedAt`,
      value: now,
    },
  ];
}

function generateDeleteTaskEffects(intent: DeleteTaskIntent): PatchOp[] {
  // Support both single taskId and multiple taskIds
  const ids = intent.taskIds ?? (intent.taskId ? [intent.taskId] : []);

  return ids.map(id => ({
    op: 'remove' as const,
    path: 'data.tasks',
    value: id,
  }));
}

function generateRestoreTaskEffects(intent: RestoreTaskIntent): PatchOp[] {
  return [{
    op: 'restore',
    path: 'data.tasks',
    value: intent.taskId,
  }];
}

function generateSelectTaskEffects(intent: SelectTaskIntent): PatchOp[] {
  return [{
    op: 'set',
    path: 'state.selectedTaskId',
    value: intent.taskId,
  }];
}

function generateToggleAssistantEffects(intent: ToggleAssistantIntent): PatchOp[] {
  return [{
    op: 'set',
    path: 'state.assistantOpen',
    value: intent.open,
  }];
}

// ============================================
// Utility Functions
// ============================================

/**
 * Snapshot에서 Task 찾기
 */
export function findTask(snapshot: Snapshot, taskId: string): Task | undefined {
  return snapshot.data.tasks.find(t => t.id === taskId);
}

/**
 * Snapshot에서 Task 인덱스 찾기
 */
export function findTaskIndex(snapshot: Snapshot, taskId: string): number {
  return snapshot.data.tasks.findIndex(t => t.id === taskId);
}

/**
 * Task가 삭제되었는지 확인
 */
export function isTaskDeleted(task: Task): boolean {
  return !!task.deletedAt;
}

/**
 * 활성 Task 목록 가져오기
 */
export function getActiveTasks(snapshot: Snapshot): Task[] {
  return snapshot.data.tasks.filter(t => !t.deletedAt);
}

/**
 * 삭제된 Task 목록 가져오기 (휴지통)
 */
export function getDeletedTasks(snapshot: Snapshot): Task[] {
  return snapshot.data.tasks.filter(t => !!t.deletedAt);
}

// ============================================
// Snapshot Diff (for Result Interpreter)
// ============================================

export interface SnapshotDiff {
  viewModeChanged?: {
    from: Snapshot['state']['viewMode'];
    to: Snapshot['state']['viewMode'];
  };
  dateFilterChanged?: {
    from: Snapshot['state']['dateFilter'];
    to: Snapshot['state']['dateFilter'];
  };
  selectedTaskChanged?: {
    from: string | null;
    to: string | null;
  };
  tasksAdded?: Task[];
  tasksUpdated?: Array<{ taskId: string; changes: Record<string, unknown> }>;
  tasksDeleted?: string[];
  tasksRestored?: string[];
}

/**
 * 두 Snapshot의 차이 계산
 */
export function calculateSnapshotDiff(before: Snapshot, after: Snapshot): SnapshotDiff {
  const diff: SnapshotDiff = {};

  // View mode 변경
  if (before.state.viewMode !== after.state.viewMode) {
    diff.viewModeChanged = {
      from: before.state.viewMode,
      to: after.state.viewMode,
    };
  }

  // Date filter 변경
  if (JSON.stringify(before.state.dateFilter) !== JSON.stringify(after.state.dateFilter)) {
    diff.dateFilterChanged = {
      from: before.state.dateFilter,
      to: after.state.dateFilter,
    };
  }

  // Selected task 변경
  if (before.state.selectedTaskId !== after.state.selectedTaskId) {
    diff.selectedTaskChanged = {
      from: before.state.selectedTaskId,
      to: after.state.selectedTaskId,
    };
  }

  // Task 추가
  const beforeTaskIds = new Set(before.data.tasks.map(t => t.id));
  const addedTasks = after.data.tasks.filter(t => !beforeTaskIds.has(t.id));
  if (addedTasks.length > 0) {
    diff.tasksAdded = addedTasks;
  }

  // Task 삭제 (soft delete)
  const beforeDeleted = new Set(before.data.tasks.filter(t => t.deletedAt).map(t => t.id));
  const afterDeleted = new Set(after.data.tasks.filter(t => t.deletedAt).map(t => t.id));
  const newlyDeleted = [...afterDeleted].filter(id => !beforeDeleted.has(id));
  if (newlyDeleted.length > 0) {
    diff.tasksDeleted = newlyDeleted;
  }

  // Task 복원
  const restored = [...beforeDeleted].filter(id => !afterDeleted.has(id));
  if (restored.length > 0) {
    diff.tasksRestored = restored;
  }

  // Task 업데이트
  const updatedTasks: Array<{ taskId: string; changes: Record<string, unknown> }> = [];
  for (const afterTask of after.data.tasks) {
    const beforeTask = before.data.tasks.find(t => t.id === afterTask.id);
    if (beforeTask && JSON.stringify(beforeTask) !== JSON.stringify(afterTask)) {
      const changes: Record<string, unknown> = {};
      for (const key of Object.keys(afterTask) as (keyof Task)[]) {
        if (beforeTask[key] !== afterTask[key]) {
          changes[key] = afterTask[key];
        }
      }
      if (Object.keys(changes).length > 0) {
        updatedTasks.push({ taskId: afterTask.id, changes });
      }
    }
  }
  if (updatedTasks.length > 0) {
    diff.tasksUpdated = updatedTasks;
  }

  return diff;
}
