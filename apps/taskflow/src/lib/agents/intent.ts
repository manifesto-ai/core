/**
 * Intent AST 정의
 *
 * ADR 섹션 3: Intent의 정의
 * - Intent는 "무엇을 하고 싶은가"에 대한 완결된 의미 단위(AST)
 * - 부분 JSON ❌
 * - 추론 여지 ❌
 * - 항상 검증 가능해야 함 ⭕
 *
 * 단일 Intent만 허용 - 복합 Intent는 허용하지 않음
 */

import type { Task } from '@/manifesto';
import { SCHEMA_VERSION } from './prompts/schema';

// ============================================
// Base Intent Interface
// ============================================

export interface BaseIntent {
  kind: string;
  confidence: number; // LLM 신뢰도 (0-1)
  source: 'human' | 'agent' | 'ui'; // 생성 주체
}

// ============================================
// Intent Types (v1)
// ============================================

/**
 * ChangeView - 뷰 모드 변경
 */
export interface ChangeViewIntent extends BaseIntent {
  kind: 'ChangeView';
  viewMode: 'kanban' | 'table' | 'todo';
}

/**
 * SetDateFilter - 날짜 필터 설정/해제
 */
export interface SetDateFilterIntent extends BaseIntent {
  kind: 'SetDateFilter';
  filter: {
    field: 'dueDate' | 'createdAt';
    type: 'today' | 'week' | 'month' | 'custom';
    startDate?: string; // ISO date
    endDate?: string; // ISO date
  } | null; // null = 필터 해제
}

/**
 * SetFilter - 상태/우선순위 필터 설정
 */
export interface SetFilterIntent extends BaseIntent {
  kind: 'SetFilter';
  status?: 'all' | 'todo' | 'in-progress' | 'review' | 'done' | null;
  priority?: 'all' | 'low' | 'medium' | 'high' | null;
}

/**
 * ClearFilter - 필터 초기화
 */
export interface ClearFilterIntent extends BaseIntent {
  kind: 'ClearFilter';
}

/**
 * CreateTask - 태스크 생성 (단일 또는 복수)
 */
export interface TaskToCreate {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
  dueDate?: string; // ISO date
  assignee?: string; // 담당자
}

export interface CreateTaskIntent extends BaseIntent {
  kind: 'CreateTask';
  tasks: TaskToCreate[]; // 1개 이상의 태스크
}

/**
 * UpdateTask - 태스크 수정 (제목, 설명, 우선순위, 태그, 마감일 등)
 * Note: 상태 변경은 ChangeStatus를 사용할 것을 권장
 *
 * Bulk operations:
 * - taskId: 단일 태스크 수정
 * - taskIds: 복수 태스크 일괄 수정 (semantic filter로 선택됨)
 */
export interface UpdateTaskIntent extends BaseIntent {
  kind: 'UpdateTask';
  taskId?: string;      // 단일 변경
  taskIds?: string[];   // 복수 변경 (bulk)
  changes: {
    title?: string;
    description?: string;
    status?: 'todo' | 'in-progress' | 'review' | 'done';
    priority?: 'low' | 'medium' | 'high';
    tags?: string[];
    dueDate?: string | null;
    assignee?: string | null;
  };
}

/**
 * ChangeStatus - 태스크 상태 전이 (1급 Intent)
 *
 * UpdateTask.changes.status와 별개로 존재하는 이유:
 * - 상태 전이는 도메인에서 가장 빈번하고 중요한 동작
 * - "끝났어", "done", "완료" 등의 표현을 명확하게 처리
 * - LLM이 status 변경을 명시적으로 인식하도록 함
 */
export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done';

export interface ChangeStatusIntent extends BaseIntent {
  kind: 'ChangeStatus';
  taskId?: string;      // 단일 변경
  taskIds?: string[];   // 복수 변경 (bulk)
  toStatus: TaskStatus;
  fromStatus?: TaskStatus; // optional, 검증용
}

/**
 * DeleteTask - 태스크 삭제 (soft delete)
 * taskId: 단일 삭제
 * taskIds: 복수 삭제 (bulk delete)
 * 둘 중 하나만 사용
 */
export interface DeleteTaskIntent extends BaseIntent {
  kind: 'DeleteTask';
  taskId?: string;
  taskIds?: string[];
}

/**
 * RestoreTask - 삭제된 태스크 복원
 */
export interface RestoreTaskIntent extends BaseIntent {
  kind: 'RestoreTask';
  taskId: string;
}

/**
 * SelectTask - 태스크 선택/해제
 */
export interface SelectTaskIntent extends BaseIntent {
  kind: 'SelectTask';
  taskId: string | null; // null = 선택 해제
}

/**
 * QueryTasks - 태스크 조회 (읽기 전용)
 */
export interface QueryTasksIntent extends BaseIntent {
  kind: 'QueryTasks';
  query: string; // 자연어 질문
}

/**
 * ToggleAssistant - 어시스턴트 패널 열기/닫기
 */
export interface ToggleAssistantIntent extends BaseIntent {
  kind: 'ToggleAssistant';
  open: boolean; // true = 열기, false = 닫기
}

/**
 * Undo - 마지막 액션 취소
 * FE의 undo stack을 pop하라는 신호
 */
export interface UndoIntent extends BaseIntent {
  kind: 'Undo';
}

/**
 * RequestClarification - 모호한 입력에 대해 되묻기 (HITL)
 */
export type ClarificationReason =
  | 'which_task'        // 어떤 태스크인지 불명확 (컨텍스트 부족, "그거", "저거")
  | 'missing_title'     // 태스크 제목 누락 (CreateTask에서)
  | 'ambiguous_action'  // 어떤 동작인지 불명확 ("처리해", "해줘", 혼합 의도)
  | 'missing_date'      // 날짜 정보 누락 (필수인 경우)
  | 'multiple_matches'  // 여러 태스크가 매칭됨 ("로그인 태스크" → 2개 이상)
  | 'missing_info'      // 일반적 정보 누락 (제목 외의 필수 정보)
  | 'unknown';          // 기타 불명확한 상황

export interface RequestClarificationIntent extends BaseIntent {
  kind: 'RequestClarification';
  reason: ClarificationReason;
  question: string;            // LLM이 생성한 질문 (사용자에게 표시)
  candidates?: string[];       // 후보 태스크 ID들 (선택지 제공용)
  originalInput: string;       // 원본 입력
  partialUnderstanding?: {     // 부분적으로 이해한 것
    action?: 'create' | 'update' | 'delete' | 'view' | 'query';
    taskRef?: string;          // 참조된 태스크 (불완전)
  };
}

// ============================================
// Union Type
// ============================================

export type Intent =
  | ChangeViewIntent
  | SetDateFilterIntent
  | SetFilterIntent
  | ClearFilterIntent
  | CreateTaskIntent
  | UpdateTaskIntent
  | ChangeStatusIntent
  | DeleteTaskIntent
  | RestoreTaskIntent
  | SelectTaskIntent
  | QueryTasksIntent
  | ToggleAssistantIntent
  | UndoIntent
  | RequestClarificationIntent;

/**
 * Intent kind 상수
 */
export const INTENT_KINDS = [
  'ChangeView',
  'SetDateFilter',
  'SetFilter',
  'ClearFilter',
  'CreateTask',
  'UpdateTask',
  'ChangeStatus',
  'DeleteTask',
  'RestoreTask',
  'SelectTask',
  'QueryTasks',
  'ToggleAssistant',
  'Undo',
  'RequestClarification',
] as const;

export type IntentKind = (typeof INTENT_KINDS)[number];

// ============================================
// Validation
// ============================================

/**
 * Intent 검증 결과
 */
export interface IntentValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * MEL 파라미터 이름을 Intent 필드 이름으로 정규화
 * LLM이 MEL action 파라미터 이름을 그대로 출력하는 경우를 처리
 */
function normalizeIntent(raw: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...raw };

  // ChangeView: newViewMode -> viewMode
  if (normalized.kind === 'ChangeView' && 'newViewMode' in normalized) {
    normalized.viewMode = normalized.newViewMode;
    delete normalized.newViewMode;
  }

  // ChangeStatus: newStatus -> toStatus
  if (normalized.kind === 'ChangeStatus' && 'newStatus' in normalized) {
    normalized.toStatus = normalized.newStatus;
    delete normalized.newStatus;
  }

  // DeleteTask: id -> taskId (단일 삭제)
  if (normalized.kind === 'DeleteTask' && 'id' in normalized && !('taskId' in normalized)) {
    normalized.taskId = normalized.id;
    delete normalized.id;
  }

  // DeleteTask: ids -> taskIds (복수 삭제)
  if (normalized.kind === 'DeleteTask' && 'ids' in normalized && !('taskIds' in normalized)) {
    normalized.taskIds = normalized.ids;
    delete normalized.ids;
  }

  // SetFilter: status/priority 필터 처리
  if (normalized.kind === 'SetFilter') {
    // SetDateFilter로 매핑 시도 (filter 객체가 없는 경우)
    if (!('filter' in normalized) && ('status' in normalized || 'priority' in normalized)) {
      // SetFilter는 별도 Intent로 처리 - 여기서는 그대로 둠
    }
  }

  // RestoreTask: id -> taskId
  if (normalized.kind === 'RestoreTask' && 'id' in normalized && !('taskId' in normalized)) {
    normalized.taskId = normalized.id;
    delete normalized.id;
  }

  // UpdateTask: id -> taskId
  if (normalized.kind === 'UpdateTask' && 'id' in normalized && !('taskId' in normalized)) {
    normalized.taskId = normalized.id;
    delete normalized.id;
  }

  // SelectTask: id -> taskId
  if (normalized.kind === 'SelectTask' && 'id' in normalized && !('taskId' in normalized)) {
    normalized.taskId = normalized.id;
    delete normalized.id;
  }

  return normalized;
}

/**
 * Intent 검증
 *
 * @param intent - 검증할 Intent
 * @returns 검증 결과
 */
export function validateIntent(intent: unknown): IntentValidationResult {
  const errors: string[] = [];

  if (!intent || typeof intent !== 'object') {
    return { valid: false, errors: ['Intent must be an object'] };
  }

  // Normalize field names (MEL param names -> Intent field names)
  const obj = normalizeIntent(intent as Record<string, unknown>);

  // Copy normalized values back to original object for downstream use
  Object.assign(intent, obj);

  // kind 검증
  if (!obj.kind || typeof obj.kind !== 'string') {
    errors.push('Intent must have a "kind" field');
  } else if (!INTENT_KINDS.includes(obj.kind as IntentKind)) {
    errors.push(`Unknown intent kind: ${obj.kind}`);
  }

  // confidence 검증
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) {
    errors.push('Intent must have a valid "confidence" field (0-1)');
  }

  // source 검증
  if (!['human', 'agent', 'ui'].includes(obj.source as string)) {
    errors.push('Intent must have a valid "source" field');
  }

  // Kind별 추가 검증
  if (obj.kind && errors.length === 0) {
    const kindErrors = validateIntentByKind(obj as unknown as Intent);
    errors.push(...kindErrors);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Kind별 Intent 검증
 */
function validateIntentByKind(intent: Intent): string[] {
  const errors: string[] = [];

  switch (intent.kind) {
    case 'ChangeView':
      if (!['kanban', 'table', 'todo'].includes(intent.viewMode)) {
        errors.push('ChangeView: invalid viewMode');
      }
      break;

    case 'SetDateFilter':
      if (intent.filter !== null) {
        if (!['dueDate', 'createdAt'].includes(intent.filter.field)) {
          errors.push('SetDateFilter: invalid filter.field');
        }
        if (!['today', 'week', 'month', 'custom'].includes(intent.filter.type)) {
          errors.push('SetDateFilter: invalid filter.type');
        }
      }
      break;

    case 'SetFilter':
      // status and priority are optional, but if present must be valid
      if (intent.status !== undefined && intent.status !== null) {
        if (!['all', 'todo', 'in-progress', 'review', 'done'].includes(intent.status)) {
          errors.push('SetFilter: invalid status');
        }
      }
      if (intent.priority !== undefined && intent.priority !== null) {
        if (!['all', 'low', 'medium', 'high'].includes(intent.priority)) {
          errors.push('SetFilter: invalid priority');
        }
      }
      break;

    case 'ClearFilter':
      // No additional fields required for ClearFilter
      break;

    case 'ChangeStatus': {
      const hasTaskId = intent.taskId && typeof intent.taskId === 'string';
      const hasTaskIds = intent.taskIds && Array.isArray(intent.taskIds) && intent.taskIds.length > 0;
      if (!hasTaskId && !hasTaskIds) {
        errors.push('ChangeStatus: either taskId or taskIds is required');
      }
      if (!intent.toStatus || !['todo', 'in-progress', 'review', 'done'].includes(intent.toStatus)) {
        errors.push('ChangeStatus: valid toStatus is required');
      }
      break;
    }

    case 'CreateTask':
      if (!intent.tasks || !Array.isArray(intent.tasks) || intent.tasks.length === 0) {
        errors.push('CreateTask: tasks array is required and must not be empty');
      } else {
        for (let i = 0; i < intent.tasks.length; i++) {
          const task = intent.tasks[i];
          if (!task.title || typeof task.title !== 'string') {
            errors.push(`CreateTask: tasks[${i}].title is required`);
          }
          if (task.priority && !['low', 'medium', 'high'].includes(task.priority)) {
            errors.push(`CreateTask: tasks[${i}].priority is invalid`);
          }
        }
      }
      break;

    case 'UpdateTask': {
      const hasTaskId = intent.taskId && typeof intent.taskId === 'string';
      const hasTaskIds = intent.taskIds && Array.isArray(intent.taskIds) && intent.taskIds.length > 0;
      if (!hasTaskId && !hasTaskIds) {
        errors.push('UpdateTask: either taskId or taskIds is required');
      }
      if (hasTaskIds && !intent.taskIds!.every(id => typeof id === 'string')) {
        errors.push('UpdateTask: all taskIds must be strings');
      }
      if (!intent.changes || typeof intent.changes !== 'object') {
        errors.push('UpdateTask: changes is required');
      }
      break;
    }

    case 'DeleteTask': {
      const hasTaskId = intent.taskId && typeof intent.taskId === 'string';
      const hasTaskIds = intent.taskIds && Array.isArray(intent.taskIds) && intent.taskIds.length > 0;
      if (!hasTaskId && !hasTaskIds) {
        errors.push('DeleteTask: either taskId or taskIds is required');
      }
      if (hasTaskIds && !intent.taskIds!.every(id => typeof id === 'string')) {
        errors.push('DeleteTask: all taskIds must be strings');
      }
      break;
    }

    case 'RestoreTask':
      if (!intent.taskId || typeof intent.taskId !== 'string') {
        errors.push(`${intent.kind}: taskId is required`);
      }
      break;

    case 'SelectTask':
      if (intent.taskId !== null && typeof intent.taskId !== 'string') {
        errors.push('SelectTask: taskId must be string or null');
      }
      break;

    case 'QueryTasks':
      if (!intent.query || typeof intent.query !== 'string') {
        errors.push('QueryTasks: query is required');
      }
      break;

    case 'ToggleAssistant':
      if (typeof intent.open !== 'boolean') {
        errors.push('ToggleAssistant: open must be a boolean');
      }
      break;

    case 'Undo':
      // No additional fields required for Undo
      break;

    case 'RequestClarification':
      if (!intent.reason || typeof intent.reason !== 'string') {
        errors.push('RequestClarification: reason is required');
      } else if (!['which_task', 'missing_title', 'ambiguous_action', 'missing_date', 'multiple_matches', 'missing_info', 'unknown'].includes(intent.reason)) {
        errors.push('RequestClarification: invalid reason');
      }
      if (!intent.question || typeof intent.question !== 'string') {
        errors.push('RequestClarification: question is required');
      }
      if (!intent.originalInput || typeof intent.originalInput !== 'string') {
        errors.push('RequestClarification: originalInput is required');
      }
      if (intent.candidates !== undefined && intent.candidates !== null && !Array.isArray(intent.candidates)) {
        errors.push('RequestClarification: candidates must be an array');
      }
      break;
  }

  return errors;
}

// ============================================
// Intent Builders (for UI/Agent direct creation)
// ============================================

/**
 * Intent 생성 헬퍼
 */
export const IntentBuilder = {
  changeView(viewMode: ChangeViewIntent['viewMode'], source: BaseIntent['source'] = 'ui'): ChangeViewIntent {
    return {
      kind: 'ChangeView',
      viewMode,
      confidence: 1.0,
      source,
    };
  },

  setDateFilter(
    filter: SetDateFilterIntent['filter'],
    source: BaseIntent['source'] = 'ui'
  ): SetDateFilterIntent {
    return {
      kind: 'SetDateFilter',
      filter,
      confidence: 1.0,
      source,
    };
  },

  createTask(
    tasks: TaskToCreate | TaskToCreate[],
    source: BaseIntent['source'] = 'ui'
  ): CreateTaskIntent {
    const taskArray = Array.isArray(tasks) ? tasks : [tasks];
    return {
      kind: 'CreateTask',
      tasks: taskArray,
      confidence: 1.0,
      source,
    };
  },

  updateTask(
    taskId: string,
    changes: UpdateTaskIntent['changes'],
    source: BaseIntent['source'] = 'ui'
  ): UpdateTaskIntent {
    return {
      kind: 'UpdateTask',
      taskId,
      changes,
      confidence: 1.0,
      source,
    };
  },

  deleteTask(taskId: string, source: BaseIntent['source'] = 'ui'): DeleteTaskIntent {
    return {
      kind: 'DeleteTask',
      taskId,
      confidence: 1.0,
      source,
    };
  },

  deleteTasks(taskIds: string[], source: BaseIntent['source'] = 'ui'): DeleteTaskIntent {
    return {
      kind: 'DeleteTask',
      taskIds,
      confidence: 1.0,
      source,
    };
  },

  restoreTask(taskId: string, source: BaseIntent['source'] = 'ui'): RestoreTaskIntent {
    return {
      kind: 'RestoreTask',
      taskId,
      confidence: 1.0,
      source,
    };
  },

  selectTask(taskId: string | null, source: BaseIntent['source'] = 'ui'): SelectTaskIntent {
    return {
      kind: 'SelectTask',
      taskId,
      confidence: 1.0,
      source,
    };
  },

  queryTasks(query: string, source: BaseIntent['source'] = 'human'): QueryTasksIntent {
    return {
      kind: 'QueryTasks',
      query,
      confidence: 1.0,
      source,
    };
  },

  toggleAssistant(open: boolean, source: BaseIntent['source'] = 'ui'): ToggleAssistantIntent {
    return {
      kind: 'ToggleAssistant',
      open,
      confidence: 1.0,
      source,
    };
  },

  undo(source: BaseIntent['source'] = 'human'): UndoIntent {
    return {
      kind: 'Undo',
      confidence: 1.0,
      source,
    };
  },

  requestClarification(
    reason: ClarificationReason,
    question: string,
    originalInput: string,
    options?: {
      candidates?: string[];
      partialUnderstanding?: RequestClarificationIntent['partialUnderstanding'];
      confidence?: number;
    },
    source: BaseIntent['source'] = 'agent'
  ): RequestClarificationIntent {
    return {
      kind: 'RequestClarification',
      reason,
      question,
      originalInput,
      candidates: options?.candidates,
      partialUnderstanding: options?.partialUnderstanding,
      confidence: options?.confidence ?? 0.5,
      source,
    };
  },
};

// ============================================
// Serialization
// ============================================

/**
 * Intent를 JSON 문자열로 직렬화
 */
export function serializeIntent(intent: Intent): string {
  return JSON.stringify({
    ...intent,
    _schemaVersion: SCHEMA_VERSION,
    _serializedAt: new Date().toISOString(),
  });
}

/**
 * JSON 문자열에서 Intent 역직렬화
 */
export function deserializeIntent(json: string): Intent | null {
  try {
    const obj = JSON.parse(json);
    // Remove metadata fields
    delete obj._schemaVersion;
    delete obj._serializedAt;

    const validation = validateIntent(obj);
    if (!validation.valid) {
      console.warn('Intent deserialization failed:', validation.errors);
      return null;
    }

    return obj as Intent;
  } catch (e) {
    console.error('Intent deserialization error:', e);
    return null;
  }
}

/**
 * Intent가 읽기 전용인지 확인
 */
export function isReadOnlyIntent(intent: Intent): boolean {
  return intent.kind === 'QueryTasks';
}

/**
 * Intent가 상태 변경을 유발하는지 확인
 */
export function isStateMutatingIntent(intent: Intent): boolean {
  return !isReadOnlyIntent(intent);
}
