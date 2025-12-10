/**
 * Analyzer Domain Pure Functions
 *
 * 상태를 변경하는 순수 함수들 - 부수효과 없음
 * Orchestrator 패턴을 따름
 */

import type {
  AnalyzerData,
  AnalyzerState,
  AnalyzerDerived,
  AnalyzerConfig,
  FileTask,
  FileTaskStatus,
  DomainCandidate,
  AmbiguousPattern,
  PatternCollection,
  DependencyGraph,
  AnalysisError,
  SuggestedResolution,
} from './types.js';
import type { FileAnalysis, DetectedPattern } from '../../parser/types.js';

// ============================================================
// Initial State Creators
// ============================================================

/**
 * 기본 설정
 */
export const DEFAULT_CONFIG: AnalyzerConfig = {
  confidenceThreshold: 0.7,
  enableLLMFallback: true,
  maxConcurrency: 1,
};

/**
 * 초기 데이터 생성
 */
export function createInitialData(config?: Partial<AnalyzerConfig>): AnalyzerData {
  return {
    queue: [],
    current: null,
    results: {},
    domainCandidates: {},
    config: { ...DEFAULT_CONFIG, ...config },
  };
}

/**
 * 초기 상태 생성
 */
export function createInitialState(): AnalyzerState {
  return {
    patterns: {
      components: [],
      hooks: [],
      contexts: [],
      reducers: [],
      effects: [],
    },
    ambiguous: [],
    dependencyGraph: {
      nodes: [],
      edges: [],
    },
    meta: {
      attempts: 0,
      confidence: 0,
      lastProcessedFile: null,
      processingRate: 0,
      errors: [],
    },
  };
}

// ============================================================
// Queue Management
// ============================================================

/**
 * 큐에 파일 태스크 추가
 */
export function addToQueue(
  data: AnalyzerData,
  tasks: FileTask[]
): AnalyzerData {
  // 중복 제거 (path 기준)
  const existingPaths = new Set(data.queue.map(t => t.path));
  const newTasks = tasks.filter(t => !existingPaths.has(t.path));

  return {
    ...data,
    queue: [...data.queue, ...newTasks].sort((a, b) => b.priority - a.priority),
  };
}

/**
 * 다음 태스크 가져오기
 */
export function getNextTask(data: AnalyzerData): FileTask | null {
  return data.queue.find(t => t.status === 'pending') ?? null;
}

/**
 * 현재 태스크 설정
 */
export function setCurrentTask(
  data: AnalyzerData,
  task: FileTask | null
): AnalyzerData {
  if (task === null) {
    return { ...data, current: null };
  }

  // 큐에서 해당 태스크의 상태를 in_progress로 변경
  const queue = data.queue.map(t =>
    t.path === task.path ? { ...t, status: 'in_progress' as const } : t
  );

  return {
    ...data,
    current: { ...task, status: 'in_progress' },
    queue,
  };
}

/**
 * 태스크 상태 업데이트
 */
export function updateTaskStatus(
  data: AnalyzerData,
  path: string,
  status: FileTaskStatus
): AnalyzerData {
  const queue = data.queue.map(t =>
    t.path === path ? { ...t, status } : t
  );

  const current = data.current?.path === path
    ? { ...data.current, status }
    : data.current;

  return { ...data, queue, current };
}

// ============================================================
// Results Management
// ============================================================

/**
 * 분석 결과 추가
 */
export function addResult(
  data: AnalyzerData,
  analysis: FileAnalysis
): AnalyzerData {
  return {
    ...data,
    results: {
      ...data.results,
      [analysis.path]: analysis,
    },
  };
}

/**
 * 태스크 완료 처리
 */
export function completeTask(
  data: AnalyzerData,
  state: AnalyzerState,
  path: string,
  analysis: FileAnalysis
): { data: AnalyzerData; state: AnalyzerState } {
  // 데이터 업데이트
  const newData = addResult(
    updateTaskStatus(data, path, 'done'),
    analysis
  );

  // 상태 업데이트 - 패턴 집계
  const newState = aggregatePatterns(state, analysis);

  return { data: newData, state: newState };
}

/**
 * 태스크 실패 처리
 */
export function failTask(
  data: AnalyzerData,
  state: AnalyzerState,
  path: string,
  error: string
): { data: AnalyzerData; state: AnalyzerState } {
  const newData = updateTaskStatus(data, path, 'failed');

  const newState: AnalyzerState = {
    ...state,
    meta: {
      ...state.meta,
      errors: [
        ...state.meta.errors,
        { file: path, error, timestamp: Date.now() },
      ],
    },
  };

  return { data: newData, state: newState };
}

/**
 * 태스크 건너뛰기
 */
export function skipTask(
  data: AnalyzerData,
  path: string,
  _reason: string
): AnalyzerData {
  return updateTaskStatus(data, path, 'skipped');
}

// ============================================================
// Pattern Aggregation
// ============================================================

/**
 * 패턴 집계
 */
export function aggregatePatterns(
  state: AnalyzerState,
  analysis: FileAnalysis
): AnalyzerState {
  const patterns = { ...state.patterns };

  for (const pattern of analysis.patterns) {
    // 파일 경로 메타데이터 추가
    const enrichedPattern: DetectedPattern = {
      ...pattern,
      metadata: {
        ...pattern.metadata,
        sourceFile: analysis.path,
      },
    };

    switch (pattern.type) {
      case 'component':
        patterns.components = [...patterns.components, enrichedPattern];
        break;
      case 'hook':
        patterns.hooks = [...patterns.hooks, enrichedPattern];
        break;
      case 'context':
        patterns.contexts = [...patterns.contexts, enrichedPattern];
        break;
      case 'reducer':
        patterns.reducers = [...patterns.reducers, enrichedPattern];
        break;
      case 'effect':
        patterns.effects = [...patterns.effects, enrichedPattern];
        break;
      // form, unknown은 무시
    }
  }

  return { ...state, patterns };
}

// ============================================================
// Domain Candidates Management
// ============================================================

/**
 * 도메인 후보 추가
 */
export function addDomainCandidate(
  data: AnalyzerData,
  candidate: DomainCandidate
): AnalyzerData {
  return {
    ...data,
    domainCandidates: {
      ...data.domainCandidates,
      [candidate.id]: candidate,
    },
  };
}

/**
 * 도메인 후보 업데이트
 */
export function updateDomainCandidate(
  data: AnalyzerData,
  id: string,
  updates: Partial<DomainCandidate>
): AnalyzerData {
  const existing = data.domainCandidates[id];
  if (!existing) return data;

  return {
    ...data,
    domainCandidates: {
      ...data.domainCandidates,
      [id]: { ...existing, ...updates },
    },
  };
}

/**
 * 여러 도메인 후보 추가
 */
export function addDomainCandidates(
  data: AnalyzerData,
  candidates: DomainCandidate[]
): AnalyzerData {
  const newCandidates = { ...data.domainCandidates };
  for (const candidate of candidates) {
    newCandidates[candidate.id] = candidate;
  }
  return { ...data, domainCandidates: newCandidates };
}

// ============================================================
// Ambiguous Patterns Management
// ============================================================

/**
 * 애매한 패턴 추가
 */
export function addAmbiguousPattern(
  state: AnalyzerState,
  ambiguous: AmbiguousPattern
): AnalyzerState {
  // 중복 체크
  if (state.ambiguous.some(a => a.id === ambiguous.id)) {
    return state;
  }

  return {
    ...state,
    ambiguous: [...state.ambiguous, ambiguous],
  };
}

/**
 * 애매한 패턴 생성
 */
export function createAmbiguousPattern(
  filePath: string,
  pattern: DetectedPattern,
  reason: string,
  suggestedResolutions: SuggestedResolution[] = []
): AmbiguousPattern {
  return {
    id: `ambig-${filePath}-${pattern.name}-${Date.now()}`,
    filePath,
    pattern,
    reason,
    suggestedResolutions,
  };
}

/**
 * 애매한 패턴 해결
 */
export function resolveAmbiguousPattern(
  state: AnalyzerState,
  ambiguousId: string,
  resolutionId: string
): AnalyzerState {
  return {
    ...state,
    ambiguous: state.ambiguous.map(a =>
      a.id === ambiguousId
        ? { ...a, resolvedAt: Date.now(), resolution: resolutionId }
        : a
    ),
  };
}

/**
 * 미해결 애매한 패턴 조회
 */
export function getUnresolvedAmbiguous(state: AnalyzerState): AmbiguousPattern[] {
  return state.ambiguous.filter(a => !a.resolution);
}

// ============================================================
// Dependency Graph Management
// ============================================================

/**
 * 의존성 그래프 설정
 */
export function setDependencyGraph(
  state: AnalyzerState,
  graph: DependencyGraph
): AnalyzerState {
  return {
    ...state,
    dependencyGraph: graph,
  };
}

// ============================================================
// Meta Updates
// ============================================================

/**
 * 메타 정보 업데이트
 */
export function updateMeta(
  state: AnalyzerState,
  updates: Partial<AnalyzerState['meta']>
): AnalyzerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      ...updates,
    },
  };
}

/**
 * 시도 횟수 증가
 */
export function incrementAttempts(state: AnalyzerState): AnalyzerState {
  return updateMeta(state, { attempts: state.meta.attempts + 1 });
}

/**
 * 마지막 처리 파일 설정
 */
export function setLastProcessedFile(
  state: AnalyzerState,
  path: string | null
): AnalyzerState {
  return updateMeta(state, { lastProcessedFile: path });
}

/**
 * 처리 속도 업데이트
 */
export function updateProcessingRate(
  state: AnalyzerState,
  filesProcessed: number,
  elapsedSeconds: number
): AnalyzerState {
  const rate = elapsedSeconds > 0 ? filesProcessed / elapsedSeconds : 0;
  return updateMeta(state, { processingRate: rate });
}

/**
 * 에러 추가
 */
export function addError(
  state: AnalyzerState,
  error: AnalysisError
): AnalyzerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      errors: [...state.meta.errors, error],
    },
  };
}

// ============================================================
// Derived Calculations
// ============================================================

/**
 * 파생 값 계산
 */
export function calculateDerived(
  data: AnalyzerData,
  state: AnalyzerState
): AnalyzerDerived {
  const filesTotal = data.queue.length;
  const filesProcessed = data.queue.filter(t => t.status === 'done').length;
  const filesSkipped = data.queue.filter(t => t.status === 'skipped').length;
  const filesFailed = data.queue.filter(t => t.status === 'failed').length;

  const parseErrors = state.meta.errors.length;
  const ambiguousPatterns = state.ambiguous.filter(a => !a.resolution).length;
  const domainsDiscovered = Object.keys(data.domainCandidates).length;

  // 전체 신뢰도 계산 (결과들의 평균)
  const results = Object.values(data.results);
  const overallConfidence = results.length > 0
    ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    : 0;

  // 진행률 계산
  const completed = filesProcessed + filesSkipped + filesFailed;
  const progress = filesTotal > 0 ? (completed / filesTotal) * 100 : 0;

  // 예상 남은 시간 (처리 속도 기반)
  const remaining = filesTotal - completed;
  const estimatedTimeRemaining = state.meta.processingRate > 0
    ? remaining / state.meta.processingRate
    : remaining; // 기본 1초/파일로 가정

  return {
    filesTotal,
    filesProcessed,
    filesSkipped,
    filesFailed,
    parseErrors,
    ambiguousPatterns,
    domainsDiscovered,
    overallConfidence,
    estimatedTimeRemaining,
    progress,
  };
}

// ============================================================
// Snapshot
// ============================================================

/**
 * 스냅샷 생성
 */
export function createSnapshot(
  data: AnalyzerData,
  state: AnalyzerState
): { data: AnalyzerData; state: AnalyzerState; derived: AnalyzerDerived } {
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
 * 분석이 완료되었는지 확인
 */
export function isAnalysisComplete(data: AnalyzerData): boolean {
  return data.queue.every(
    t => t.status === 'done' || t.status === 'skipped' || t.status === 'failed'
  );
}

/**
 * 패턴이 HITL이 필요한지 확인
 */
export function needsHITL(
  pattern: DetectedPattern,
  confidenceThreshold: number
): boolean {
  return pattern.needsReview || pattern.confidence < confidenceThreshold;
}

/**
 * ID 생성
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
