/**
 * Transformer Domain Pure Functions
 *
 * Transformer 도메인의 순수 함수들 - 상태 변경, 계산 로직
 */

import type {
  TransformerData,
  TransformerState,
  TransformerDerived,
  TransformerConfig,
  TransformerSnapshot,
  TransformationTask,
  TransformationStatus,
  ManifestoDomainJson,
  DomainFile,
  ValidationResult,
  RollbackPoint,
  SourceMapping,
  TransformerError,
} from './types.js';
import type { SchemaProposal, DomainSummary } from '../summarizer/types.js';

// ============================================================
// Default Config
// ============================================================

export const DEFAULT_TRANSFORMER_CONFIG: TransformerConfig = {
  outputDir: './manifesto',
  schemaVersion: '1.0.0',
  includeSourceMappings: true,
  validateBeforeWrite: true,
  createBackup: true,
};

// ============================================================
// Initial State Creators
// ============================================================

/**
 * 초기 데이터 생성
 */
export function createInitialData(
  summarizerRef: string = '',
  config?: Partial<TransformerConfig>
): TransformerData {
  return {
    summarizerRef,
    tasks: {},
    domainFiles: {},
    config: {
      ...DEFAULT_TRANSFORMER_CONFIG,
      ...config,
    },
  };
}

/**
 * 초기 상태 생성
 */
export function createInitialState(): TransformerState {
  return {
    currentTask: null,
    rollbackPoints: [],
    currentRollbackPoint: null,
    validationCache: {},
    meta: {
      attempts: 0,
      llmCallCount: 0,
      filesWritten: 0,
      lastWrittenFile: null,
      processingRate: 0,
      errors: [],
    },
  };
}

// ============================================================
// Task Management
// ============================================================

/**
 * 변환 태스크 생성
 */
export function createTask(
  domainId: string,
  domainName: string,
  proposal: SchemaProposal
): TransformationTask {
  return {
    id: `task-${domainId}-${Date.now()}`,
    domainId,
    domainName,
    status: 'pending',
    proposal,
    generatedSchema: null,
    validation: null,
  };
}

/**
 * 태스크 추가
 */
export function addTask(
  data: TransformerData,
  task: TransformationTask
): TransformerData {
  return {
    ...data,
    tasks: {
      ...data.tasks,
      [task.id]: task,
    },
  };
}

/**
 * 태스크 상태 업데이트
 */
export function updateTaskStatus(
  data: TransformerData,
  taskId: string,
  status: TransformationStatus,
  error?: string
): TransformerData {
  const task = data.tasks[taskId];
  if (!task) return data;

  return {
    ...data,
    tasks: {
      ...data.tasks,
      [taskId]: {
        ...task,
        status,
        error,
        startedAt: status === 'in_progress' ? Date.now() : task.startedAt,
        completedAt: status === 'done' || status === 'failed' ? Date.now() : task.completedAt,
      },
    },
  };
}

/**
 * 태스크에 생성된 스키마 설정
 */
export function setTaskSchema(
  data: TransformerData,
  taskId: string,
  schema: ManifestoDomainJson
): TransformerData {
  const task = data.tasks[taskId];
  if (!task) return data;

  return {
    ...data,
    tasks: {
      ...data.tasks,
      [taskId]: {
        ...task,
        generatedSchema: schema,
      },
    },
  };
}

/**
 * 태스크 검증 결과 설정
 */
export function setTaskValidation(
  data: TransformerData,
  taskId: string,
  validation: ValidationResult
): TransformerData {
  const task = data.tasks[taskId];
  if (!task) return data;

  return {
    ...data,
    tasks: {
      ...data.tasks,
      [taskId]: {
        ...task,
        validation,
      },
    },
  };
}

/**
 * 현재 태스크 설정
 */
export function setCurrentTask(
  state: TransformerState,
  taskId: string | null
): TransformerState {
  return {
    ...state,
    currentTask: taskId,
  };
}

/**
 * 다음 처리할 태스크 가져오기
 */
export function getNextTask(data: TransformerData): TransformationTask | null {
  const tasks = Object.values(data.tasks);
  return tasks.find(t => t.status === 'pending') ?? null;
}

/**
 * 특정 상태의 태스크들 가져오기
 */
export function getTasksByStatus(
  data: TransformerData,
  status: TransformationStatus
): TransformationTask[] {
  return Object.values(data.tasks).filter(t => t.status === status);
}

// ============================================================
// Domain File Management
// ============================================================

/**
 * 도메인 파일 생성
 */
export function createDomainFile(
  taskId: string,
  domainName: string,
  schema: ManifestoDomainJson,
  sourceMappings: SourceMapping[],
  outputDir: string
): DomainFile {
  return {
    id: `file-${taskId}`,
    name: `${domainName}.domain.json`,
    path: `${outputDir}/${domainName}.domain.json`,
    content: schema,
    sourceMappings,
    writtenAt: null,
  };
}

/**
 * 도메인 파일 추가
 */
export function addDomainFile(
  data: TransformerData,
  file: DomainFile
): TransformerData {
  return {
    ...data,
    domainFiles: {
      ...data.domainFiles,
      [file.id]: file,
    },
  };
}

/**
 * 도메인 파일 쓰기 완료 표시
 */
export function markFileWritten(
  data: TransformerData,
  fileId: string
): TransformerData {
  const file = data.domainFiles[fileId];
  if (!file) return data;

  return {
    ...data,
    domainFiles: {
      ...data.domainFiles,
      [fileId]: {
        ...file,
        writtenAt: Date.now(),
      },
    },
  };
}

// ============================================================
// Rollback Management
// ============================================================

/**
 * 롤백 포인트 생성
 */
export function createRollbackPoint(
  description: string,
  files: Array<{ path: string; content: string | null }>
): RollbackPoint {
  return {
    id: `rollback-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: Date.now(),
    description,
    files,
  };
}

/**
 * 롤백 포인트 추가
 */
export function addRollbackPoint(
  state: TransformerState,
  rollback: RollbackPoint
): TransformerState {
  return {
    ...state,
    rollbackPoints: [...state.rollbackPoints, rollback],
    currentRollbackPoint: rollback.id,
  };
}

/**
 * 롤백 포인트 가져오기
 */
export function getRollbackPoint(
  state: TransformerState,
  rollbackId: string
): RollbackPoint | null {
  return state.rollbackPoints.find(r => r.id === rollbackId) ?? null;
}

/**
 * 롤백 포인트 정리 (오래된 것 제거)
 */
export function cleanupRollbackPoints(
  state: TransformerState,
  maxPoints: number = 10
): TransformerState {
  if (state.rollbackPoints.length <= maxPoints) {
    return state;
  }

  const sorted = [...state.rollbackPoints].sort((a, b) => b.timestamp - a.timestamp);
  return {
    ...state,
    rollbackPoints: sorted.slice(0, maxPoints),
  };
}

// ============================================================
// Validation Cache
// ============================================================

/**
 * 검증 결과 캐시
 */
export function cacheValidation(
  state: TransformerState,
  taskId: string,
  result: ValidationResult
): TransformerState {
  return {
    ...state,
    validationCache: {
      ...state.validationCache,
      [taskId]: result,
    },
  };
}

/**
 * 캐시된 검증 결과 가져오기
 */
export function getCachedValidation(
  state: TransformerState,
  taskId: string
): ValidationResult | null {
  return state.validationCache[taskId] ?? null;
}

// ============================================================
// Meta Updates
// ============================================================

/**
 * 시도 횟수 증가
 */
export function incrementAttempts(state: TransformerState): TransformerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      attempts: state.meta.attempts + 1,
    },
  };
}

/**
 * LLM 호출 횟수 증가
 */
export function incrementLLMCalls(state: TransformerState): TransformerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      llmCallCount: state.meta.llmCallCount + 1,
    },
  };
}

/**
 * 파일 쓰기 완료 기록
 */
export function recordFileWritten(
  state: TransformerState,
  filePath: string
): TransformerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      filesWritten: state.meta.filesWritten + 1,
      lastWrittenFile: filePath,
    },
  };
}

/**
 * 처리 속도 업데이트
 */
export function updateProcessingRate(
  state: TransformerState,
  tasksProcessed: number,
  elapsedSeconds: number
): TransformerState {
  const rate = elapsedSeconds > 0 ? tasksProcessed / elapsedSeconds : 0;
  return {
    ...state,
    meta: {
      ...state.meta,
      processingRate: rate,
    },
  };
}

/**
 * 에러 추가
 */
export function addError(
  state: TransformerState,
  error: string,
  taskId?: string
): TransformerState {
  const newError: TransformerError = {
    taskId,
    error,
    timestamp: Date.now(),
  };

  return {
    ...state,
    meta: {
      ...state.meta,
      errors: [...state.meta.errors, newError],
    },
  };
}

// ============================================================
// Derived Calculations
// ============================================================

/**
 * Derived 값 계산
 */
export function calculateDerived(
  data: TransformerData,
  state: TransformerState
): TransformerDerived {
  const tasks = Object.values(data.tasks);
  const tasksTotal = tasks.length;
  const tasksCompleted = tasks.filter(t => t.status === 'done').length;
  const tasksFailed = tasks.filter(t => t.status === 'failed').length;
  const tasksNeedingReview = tasks.filter(t => t.status === 'review').length;

  const files = Object.values(data.domainFiles);
  const filesGenerated = files.length;
  const filesWritten = files.filter(f => f.writtenAt !== null).length;

  const overallProgress = tasksTotal > 0 ? (tasksCompleted / tasksTotal) * 100 : 0;

  const remaining = tasksTotal - tasksCompleted - tasksFailed;
  const estimatedTimeRemaining = state.meta.processingRate > 0
    ? remaining / state.meta.processingRate
    : remaining;

  return {
    tasksTotal,
    tasksCompleted,
    tasksFailed,
    tasksNeedingReview,
    filesGenerated,
    filesWritten,
    overallProgress,
    estimatedTimeRemaining,
  };
}

// ============================================================
// Snapshot
// ============================================================

/**
 * 스냅샷 생성
 */
export function createSnapshot(
  data: TransformerData,
  state: TransformerState
): TransformerSnapshot {
  return {
    data,
    state,
    derived: calculateDerived(data, state),
  };
}

// ============================================================
// Utilities
// ============================================================

/**
 * 변환이 완료되었는지 확인
 */
export function isTransformationComplete(data: TransformerData): boolean {
  const tasks = Object.values(data.tasks);
  if (tasks.length === 0) return false;

  return tasks.every(t => t.status === 'done' || t.status === 'failed');
}

/**
 * 모든 태스크가 성공했는지 확인
 */
export function allTasksSucceeded(data: TransformerData): boolean {
  const tasks = Object.values(data.tasks);
  if (tasks.length === 0) return false;

  return tasks.every(t => t.status === 'done');
}

/**
 * 리뷰가 필요한 태스크가 있는지 확인
 */
export function hasTasksNeedingReview(data: TransformerData): boolean {
  return Object.values(data.tasks).some(t => t.status === 'review');
}

/**
 * ID 생성
 */
export function generateId(prefix: string = ''): string {
  const random = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
