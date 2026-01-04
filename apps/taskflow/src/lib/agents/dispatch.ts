/**
 * Intent Dispatch API
 *
 * ADR 섹션 7: UI/Agent 직접 Intent 생성
 * - UI 컴포넌트에서 LLM 없이 직접 Intent 생성
 * - Pattern Matcher와 동일한 결과 보장
 * - confidence: 1.0 (UI는 확실한 의도)
 * - source: 'ui' (사용자 직접 조작)
 *
 * 사용 예시:
 * ```typescript
 * const result = await dispatchIntent({
 *   kind: 'ChangeView',
 *   viewMode: 'kanban',
 *   source: 'ui',
 *   confidence: 1.0,
 * }, snapshot);
 * ```
 */

import type {
  Intent,
  ChangeViewIntent,
  SetDateFilterIntent,
  CreateTaskIntent,
  UpdateTaskIntent,
  DeleteTaskIntent,
  RestoreTaskIntent,
  SelectTaskIntent,
  TaskToCreate,
} from './intent';
import { validateIntent, IntentBuilder } from './intent';
import { executeIntent, type Snapshot, calculateSnapshotDiff } from './runtime';
import type { AgentEffect } from './types';

// ============================================
// Dispatch Types
// ============================================

export interface DispatchResult {
  success: boolean;
  intent: Intent;
  effects: AgentEffect[];
  snapshotAfter?: Snapshot;
  error?: string;
}

export interface DispatchOptions {
  /** Apply effects immediately to snapshot (returns modified snapshot) */
  applyEffects?: boolean;
}

// ============================================
// Main Dispatch Function
// ============================================

/**
 * UI에서 직접 Intent 디스패치
 *
 * LLM 호출 없이 Intent를 직접 Runtime으로 전달.
 * UI 컴포넌트에서 버튼 클릭 등 명시적 액션에 사용.
 *
 * @param intent - 디스패치할 Intent
 * @param snapshot - 현재 Snapshot
 * @param options - 디스패치 옵션
 * @returns DispatchResult
 */
export function dispatchIntent(
  intent: Intent,
  snapshot: Snapshot,
  options: DispatchOptions = {}
): DispatchResult {
  // 1. Intent 검증
  const validation = validateIntent(intent);
  if (!validation.valid) {
    return {
      success: false,
      intent,
      effects: [],
      error: `Intent validation failed: ${validation.errors.join(', ')}`,
    };
  }

  // 2. Runtime 실행 (결정론적)
  const executionResult = executeIntent(intent, snapshot);

  if (!executionResult.success) {
    return {
      success: false,
      intent,
      effects: [],
      error: executionResult.error,
    };
  }

  // 3. 결과 반환
  const result: DispatchResult = {
    success: true,
    intent,
    effects: executionResult.effects,
  };

  // 4. applyEffects 옵션이 true면 변경된 snapshot 포함
  if (options.applyEffects) {
    result.snapshotAfter = applyEffectsToSnapshot(snapshot, executionResult.effects);
  }

  return result;
}

// ============================================
// UI Intent Builders (High-Level API)
// ============================================

/**
 * 뷰 변경 Intent 디스패치
 */
export function dispatchChangeView(
  viewMode: 'kanban' | 'table' | 'todo',
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.changeView(viewMode);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 날짜 필터 설정 Intent 디스패치
 */
export function dispatchSetDateFilter(
  filter: { field: 'dueDate' | 'createdAt'; type: 'today' | 'week' | 'month' } | null,
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.setDateFilter(filter);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 태스크 생성 Intent 디스패치
 */
export function dispatchCreateTask(
  params: Omit<CreateTaskIntent, 'kind' | 'confidence' | 'source'>,
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.createTask(params.tasks);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 태스크 업데이트 Intent 디스패치
 */
export function dispatchUpdateTask(
  taskId: string,
  changes: UpdateTaskIntent['changes'],
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.updateTask(taskId, changes);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 태스크 삭제 Intent 디스패치
 */
export function dispatchDeleteTask(
  taskId: string,
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.deleteTask(taskId);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 태스크 복원 Intent 디스패치
 */
export function dispatchRestoreTask(
  taskId: string,
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.restoreTask(taskId);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

/**
 * 태스크 선택 Intent 디스패치
 */
export function dispatchSelectTask(
  taskId: string | null,
  snapshot: Snapshot,
  options?: DispatchOptions
): DispatchResult {
  const intent = IntentBuilder.selectTask(taskId);
  return dispatchIntent({ ...intent, source: 'ui', confidence: 1.0 }, snapshot, options);
}

// ============================================
// Effect Application
// ============================================

/**
 * Effects를 Snapshot에 적용
 */
function applyEffectsToSnapshot(snapshot: Snapshot, effects: AgentEffect[]): Snapshot {
  const result: Snapshot = JSON.parse(JSON.stringify(snapshot));

  for (const effect of effects) {
    if (effect.type === 'snapshot.patch' && effect.ops) {
      for (const op of effect.ops) {
        if (op.op === 'set') {
          // Handle new format: data.tasks.id:taskId.field
          const idMatch = op.path.match(/data\.tasks\.id:([^.]+)\.(\w+)/);
          if (idMatch) {
            const [, taskId, field] = idMatch;
            const task = result.data.tasks.find(t => t.id === taskId);
            if (task) {
              (task as Record<string, unknown>)[field] = op.value;
            }
          } else {
            setNestedValue(result, op.path, op.value);
          }
        } else if (op.op === 'append' && op.path === 'data.tasks') {
          result.data.tasks.push(op.value);
        } else if (op.op === 'remove' && op.path === 'data.tasks') {
          const task = result.data.tasks.find(t => t.id === op.value);
          if (task) {
            task.deletedAt = new Date().toISOString();
          }
        } else if (op.op === 'restore' && op.path === 'data.tasks') {
          const task = result.data.tasks.find(t => t.id === op.value);
          if (task) {
            task.deletedAt = null;
          }
        }
      }
    }
  }

  return result;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setNestedValue(obj: any, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;
}

// ============================================
// Batch Dispatch (Multiple Intents)
// ============================================

/**
 * 여러 Intent를 순차적으로 디스패치
 *
 * @param intents - 디스패치할 Intent 배열
 * @param initialSnapshot - 초기 Snapshot
 * @returns 각 Intent의 결과 배열 및 최종 Snapshot
 */
export function dispatchIntents(
  intents: Intent[],
  initialSnapshot: Snapshot
): { results: DispatchResult[]; finalSnapshot: Snapshot } {
  let currentSnapshot = initialSnapshot;
  const results: DispatchResult[] = [];

  for (const intent of intents) {
    const result = dispatchIntent(intent, currentSnapshot, { applyEffects: true });
    results.push(result);

    if (result.success && result.snapshotAfter) {
      currentSnapshot = result.snapshotAfter;
    }
  }

  return { results, finalSnapshot: currentSnapshot };
}

// ============================================
// React Hook Helper (for client-side use)
// ============================================

/**
 * React 컴포넌트에서 사용할 Intent 생성 헬퍼
 *
 * 사용 예시:
 * ```typescript
 * const intent = createUIIntent.changeView('kanban');
 * dispatch(intent); // React reducer에 전달
 * ```
 */
export const createUIIntent = {
  changeView: (viewMode: 'kanban' | 'table' | 'todo'): ChangeViewIntent => ({
    ...IntentBuilder.changeView(viewMode),
    source: 'ui',
    confidence: 1.0,
  }),

  setDateFilter: (
    filter: { field: 'dueDate' | 'createdAt'; type: 'today' | 'week' | 'month' } | null
  ): SetDateFilterIntent => ({
    ...IntentBuilder.setDateFilter(filter),
    source: 'ui',
    confidence: 1.0,
  }),

  createTask: (
    tasks: TaskToCreate | TaskToCreate[]
  ): CreateTaskIntent => ({
    ...IntentBuilder.createTask(tasks),
    source: 'ui',
    confidence: 1.0,
  }),

  updateTask: (taskId: string, changes: UpdateTaskIntent['changes']): UpdateTaskIntent => ({
    ...IntentBuilder.updateTask(taskId, changes),
    source: 'ui',
    confidence: 1.0,
  }),

  deleteTask: (taskId: string): DeleteTaskIntent => ({
    ...IntentBuilder.deleteTask(taskId),
    source: 'ui',
    confidence: 1.0,
  }),

  restoreTask: (taskId: string): RestoreTaskIntent => ({
    ...IntentBuilder.restoreTask(taskId),
    source: 'ui',
    confidence: 1.0,
  }),

  selectTask: (taskId: string | null): SelectTaskIntent => ({
    ...IntentBuilder.selectTask(taskId),
    source: 'ui',
    confidence: 1.0,
  }),
};
