/**
 * Analyzer Domain Types
 *
 * Analyzer는 React 파일을 분석하여 패턴을 감지하고 도메인 후보를 추출합니다.
 */

import type { DetectedPattern, FileAnalysis, SourceLocation, ImportInfo } from '../../parser/types.js';

// ============================================================
// File Task Types
// ============================================================

/**
 * 파일 태스크 상태
 */
export type FileTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped' | 'failed';

/**
 * 분석할 파일 태스크
 */
export interface FileTask {
  /** 절대 경로 */
  path: string;
  /** rootDir 기준 상대 경로 */
  relativePath: string;
  /** 우선순위 (0-100, 높을수록 먼저 처리) */
  priority: number;
  /** 의존하는 파일 경로들 */
  dependencies: string[];
  /** 태스크 상태 */
  status: FileTaskStatus;
  /** 콘텐츠 해시 (캐싱용) */
  hash?: string;
}

// ============================================================
// Domain Candidate Types
// ============================================================

/**
 * 도메인 후보 발견 방법
 */
export type DomainSuggestedBy =
  | 'context'        // createContext() 감지
  | 'reducer'        // useReducer 감지
  | 'hook'           // 유의미한 커스텀 훅
  | 'file_structure' // 디렉토리 구조 기반
  | 'llm';           // LLM 분석 결과

/**
 * 도메인 간 관계
 */
export interface DomainRelationship {
  /** 관계 유형 */
  type: 'imports' | 'provides_context' | 'consumes_context' | 'shared_state';
  /** 대상 도메인 ID */
  targetDomainId: string;
  /** 관계 강도 (0-1) */
  strength: number;
}

/**
 * 도메인 후보
 */
export interface DomainCandidate {
  /** 고유 ID */
  id: string;
  /** 도메인 이름 */
  name: string;
  /** 발견 방법 */
  suggestedBy: DomainSuggestedBy;
  /** 소스 파일 경로들 */
  sourceFiles: string[];
  /** 관련 패턴들 */
  patterns: DetectedPattern[];
  /** 신뢰도 (0-1) */
  confidence: number;
  /** 다른 도메인과의 관계 */
  relationships: DomainRelationship[];
}

// ============================================================
// Ambiguous Pattern Types
// ============================================================

/**
 * 해결 제안 액션
 */
export type ResolutionAction = 'classify_as' | 'skip' | 'merge_with' | 'split';

/**
 * 해결 제안
 */
export interface SuggestedResolution {
  /** 고유 ID */
  id: string;
  /** 표시 라벨 */
  label: string;
  /** 액션 유형 */
  action: ResolutionAction;
  /** 액션 파라미터 */
  params: Record<string, unknown>;
  /** 신뢰도 */
  confidence: number;
}

/**
 * HITL이 필요한 애매한 패턴
 */
export interface AmbiguousPattern {
  /** 고유 ID */
  id: string;
  /** 파일 경로 */
  filePath: string;
  /** 감지된 패턴 */
  pattern: DetectedPattern;
  /** 애매한 이유 */
  reason: string;
  /** 해결 제안들 */
  suggestedResolutions: SuggestedResolution[];
  /** 해결 시각 */
  resolvedAt?: number;
  /** 선택된 해결 ID */
  resolution?: string;
}

// ============================================================
// Analysis Error Types
// ============================================================

/**
 * 분석 에러
 */
export interface AnalysisError {
  /** 파일 경로 */
  file: string;
  /** 에러 메시지 */
  error: string;
  /** 발생 시각 */
  timestamp: number;
}

// ============================================================
// Dependency Graph Types
// ============================================================

/**
 * Import 엣지
 */
export interface ImportEdge {
  /** 소스 파일 (import하는 쪽) */
  source: string;
  /** 타겟 파일/모듈 (import되는 쪽) */
  target: string;
  /** import하는 항목들 */
  specifiers: string[];
  /** re-export 여부 */
  isReexport: boolean;
}

/**
 * 의존성 그래프
 */
export interface DependencyGraph {
  /** 노드 (파일 경로들) */
  nodes: string[];
  /** 엣지 (import 관계들) */
  edges: ImportEdge[];
}

// ============================================================
// Analyzer Config Types
// ============================================================

/**
 * Analyzer 설정
 */
export interface AnalyzerConfig {
  /** 신뢰도 임계값 (이 미만이면 HITL 트리거) */
  confidenceThreshold: number;
  /** LLM 폴백 활성화 */
  enableLLMFallback: boolean;
  /** 최대 동시 분석 파일 수 */
  maxConcurrency: number;
}

// ============================================================
// Analyzer Data (data.* namespace)
// ============================================================

/**
 * Analyzer 데이터 - 태스크 관련 원시 데이터
 */
export interface AnalyzerData {
  /** 분석 대기열 */
  queue: FileTask[];
  /** 현재 분석 중인 파일 */
  current: FileTask | null;
  /** 분석 결과 (path → FileAnalysis) */
  results: Record<string, FileAnalysis>;
  /** 발견된 도메인 후보들 (id → DomainCandidate) */
  domainCandidates: Record<string, DomainCandidate>;
  /** 설정 */
  config: AnalyzerConfig;
}

// ============================================================
// Analyzer State (state.* namespace)
// ============================================================

/**
 * 패턴 집합
 */
export interface PatternCollection {
  components: DetectedPattern[];
  hooks: DetectedPattern[];
  contexts: DetectedPattern[];
  reducers: DetectedPattern[];
  effects: DetectedPattern[];
}

/**
 * Analyzer 상태 - 런타임 상태
 */
export interface AnalyzerState {
  /** 타입별로 집계된 패턴들 */
  patterns: PatternCollection;
  /** HITL이 필요한 애매한 패턴들 */
  ambiguous: AmbiguousPattern[];
  /** 의존성 그래프 */
  dependencyGraph: DependencyGraph;
  /** 메타 정보 */
  meta: {
    /** 시도 횟수 */
    attempts: number;
    /** 전체 신뢰도 */
    confidence: number;
    /** 마지막 처리 파일 */
    lastProcessedFile: string | null;
    /** 처리 속도 (파일/초) */
    processingRate: number;
    /** 에러 목록 */
    errors: AnalysisError[];
  };
}

// ============================================================
// Analyzer Derived (derived.* namespace)
// ============================================================

/**
 * Analyzer 파생 값 - 계산된 값들
 */
export interface AnalyzerDerived {
  /** 전체 파일 수 */
  filesTotal: number;
  /** 처리된 파일 수 */
  filesProcessed: number;
  /** 건너뛴 파일 수 */
  filesSkipped: number;
  /** 실패한 파일 수 */
  filesFailed: number;
  /** 파싱 에러 수 */
  parseErrors: number;
  /** 애매한 패턴 수 */
  ambiguousPatterns: number;
  /** 발견된 도메인 수 */
  domainsDiscovered: number;
  /** 전체 신뢰도 */
  overallConfidence: number;
  /** 예상 남은 시간 (초) */
  estimatedTimeRemaining: number;
  /** 진행률 (0-100) */
  progress: number;
}

// ============================================================
// Analyzer Snapshot
// ============================================================

/**
 * Analyzer 스냅샷
 */
export interface AnalyzerSnapshot {
  data: AnalyzerData;
  state: AnalyzerState;
  derived: AnalyzerDerived;
}

// ============================================================
// Analyzer Events
// ============================================================

/**
 * Analyzer 이벤트 타입
 */
export type AnalyzerEventType =
  | 'analyzer:started'
  | 'analyzer:file:started'
  | 'analyzer:file:completed'
  | 'analyzer:file:failed'
  | 'analyzer:ambiguous'
  | 'analyzer:domain:discovered'
  | 'analyzer:progress'
  | 'analyzer:done'
  | 'analyzer:error';

/**
 * Analyzer 이벤트
 */
export type AnalyzerEvent =
  | { type: 'analyzer:started'; payload: { totalFiles: number } }
  | { type: 'analyzer:file:started'; payload: { path: string; index: number } }
  | { type: 'analyzer:file:completed'; payload: { path: string; patterns: number; confidence: number } }
  | { type: 'analyzer:file:failed'; payload: { path: string; error: string } }
  | { type: 'analyzer:ambiguous'; payload: AmbiguousPattern }
  | { type: 'analyzer:domain:discovered'; payload: DomainCandidate }
  | { type: 'analyzer:progress'; payload: { completed: number; total: number; confidence: number } }
  | { type: 'analyzer:done'; payload: AnalyzerDerived }
  | { type: 'analyzer:error'; payload: { error: string; fatal: boolean } };

/**
 * Analyzer 이벤트 리스너
 */
export type AnalyzerEventListener<T extends AnalyzerEvent = AnalyzerEvent> =
  (event: T) => void;

/**
 * Analyzer 이벤트 에미터
 */
export interface AnalyzerEventEmitter {
  emit(event: AnalyzerEvent): void;
  on<K extends AnalyzerEventType>(
    type: K,
    handler: (payload: Extract<AnalyzerEvent, { type: K }>['payload']) => void
  ): () => void;
}

// ============================================================
// Analyzer Actions Input Types
// ============================================================

/**
 * 파일 분석 입력
 */
export interface AnalyzeFileInput {
  path: string;
}

/**
 * 배치 분석 입력
 */
export interface AnalyzeBatchInput {
  paths: string[];
}

/**
 * 애매한 패턴 마킹 입력
 */
export interface MarkAmbiguousInput {
  path: string;
  pattern: DetectedPattern;
  reason: string;
}

/**
 * 파일 건너뛰기 입력
 */
export interface SkipFileInput {
  path: string;
  reason: string;
}

/**
 * 애매한 패턴 해결 입력
 */
export interface ResolveAmbiguousInput {
  ambiguousId: string;
  resolutionId: string;
}
