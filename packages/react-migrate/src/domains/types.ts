/**
 * 마이그레이션 파이프라인 Phase
 */
export type MigrationPhase =
  | 'INIT'
  | 'ANALYZING'
  | 'SUMMARIZING'
  | 'TRANSFORMING'
  | 'COMPLETE'
  | 'FAILED';

/**
 * Agent 상태
 */
export type AgentStatus = 'IDLE' | 'RUNNING' | 'WAITING' | 'DONE' | 'FAILED';

/**
 * Agent 참조
 */
export interface AgentRef {
  id: string;
  status: AgentStatus;
  snapshotRef: string | null;
}

/**
 * HITL 옵션
 */
export interface HITLOption {
  id: string;
  label: string;
  action: string;
  confidence: number;
}

/**
 * HITL 요청
 */
export interface HITLRequest {
  file: string;
  pattern: string | null;
  question: string;
  options: HITLOption[];
}

/**
 * HITL 히스토리 엔트리
 */
export interface HITLHistoryEntry {
  timestamp: number;
  request: HITLRequest;
  response: {
    optionId: string;
    customInput: string | null;
  };
}

/**
 * 진행 상황
 */
export interface Progress {
  total: number;
  completed: number;
  blocked: number;
  skipped: number;
}

/**
 * 도메인 정보 (발견된 도메인)
 */
export interface DiscoveredDomain {
  name: string;
  description: string;
  files: string[];
  confidence: number;
  status: 'pending' | 'analyzing' | 'done';
}

/**
 * Orchestrator Data
 */
export interface OrchestratorData {
  phase: MigrationPhase;
  progress: Progress;
  rootDir: string;
  outputDir: string;
  discoveredDomains: DiscoveredDomain[];
}

/**
 * Orchestrator State
 */
export interface OrchestratorState {
  children: {
    analyzer: AgentRef | null;
    summarizer: AgentRef | null;
    transformer: AgentRef | null;
  };
  hitl: {
    pending: boolean;
    request: HITLRequest | null;
    history: HITLHistoryEntry[];
  };
  meta: {
    attempts: number;
    lastError: string | null;
    currentModel: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet';
    contextUsage: number;
  };
}

/**
 * Orchestrator 스냅샷
 */
export interface OrchestratorSnapshot {
  data: OrchestratorData;
  state: OrchestratorState;
  derived: {
    confidence: number;
    canProceed: boolean;
    estimatedTimeRemaining: number;
  };
}

/**
 * HITL 해결 입력
 */
export interface ResolveHITLInput {
  optionId: string;
  customInput?: string | null;
}

/**
 * 모델 업그레이드 입력
 */
export interface UpgradeModelInput {
  to: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet';
}

/**
 * 시작 입력
 */
export interface StartAnalysisInput {
  rootDir: string;
  outputDir: string;
}
