import { z } from 'zod';
import type {
  OrchestratorData,
  OrchestratorState,
  MigrationPhase,
  AgentRef,
  HITLRequest,
  HITLOption,
  HITLHistoryEntry,
  Progress,
  DiscoveredDomain,
} from './types.js';

// ============================================================
// Zod Schemas
// ============================================================

const AgentStatusSchema = z.enum(['IDLE', 'RUNNING', 'WAITING', 'DONE', 'FAILED']);

const AgentRefSchema = z.object({
  id: z.string(),
  status: AgentStatusSchema,
  snapshotRef: z.string().nullable(),
});

const HITLOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.string(),
  confidence: z.number(),
});

const HITLRequestSchema = z.object({
  file: z.string(),
  pattern: z.string().nullable(),
  question: z.string(),
  options: z.array(HITLOptionSchema),
});

const HITLHistoryEntrySchema = z.object({
  timestamp: z.number(),
  request: HITLRequestSchema,
  response: z.object({
    optionId: z.string(),
    customInput: z.string().nullable(),
  }),
});

const ProgressSchema = z.object({
  total: z.number(),
  completed: z.number(),
  blocked: z.number(),
  skipped: z.number(),
});

const DiscoveredDomainSchema = z.object({
  name: z.string(),
  description: z.string(),
  files: z.array(z.string()),
  confidence: z.number(),
  status: z.enum(['pending', 'analyzing', 'done']),
});

const MigrationPhaseSchema = z.enum([
  'INIT',
  'ANALYZING',
  'SUMMARIZING',
  'TRANSFORMING',
  'COMPLETE',
  'FAILED',
]);

/**
 * OrchestratorData Schema
 */
export const OrchestratorDataSchema = z.object({
  phase: MigrationPhaseSchema,
  progress: ProgressSchema,
  rootDir: z.string(),
  outputDir: z.string(),
  discoveredDomains: z.array(DiscoveredDomainSchema),
});

/**
 * OrchestratorState Schema
 */
export const OrchestratorStateSchema = z.object({
  children: z.object({
    analyzer: AgentRefSchema.nullable(),
    summarizer: AgentRefSchema.nullable(),
    transformer: AgentRefSchema.nullable(),
  }),
  hitl: z.object({
    pending: z.boolean(),
    request: HITLRequestSchema.nullable(),
    history: z.array(HITLHistoryEntrySchema),
  }),
  meta: z.object({
    attempts: z.number(),
    lastError: z.string().nullable(),
    currentModel: z.enum(['gpt-4o-mini', 'gpt-4o', 'claude-sonnet']),
    contextUsage: z.number(),
  }),
});

// ============================================================
// Initial Values
// ============================================================

/**
 * 초기 Data
 */
export function createInitialData(rootDir = '', outputDir = ''): OrchestratorData {
  return {
    phase: 'INIT',
    progress: {
      total: 0,
      completed: 0,
      blocked: 0,
      skipped: 0,
    },
    rootDir,
    outputDir,
    discoveredDomains: [],
  };
}

/**
 * 초기 State
 */
export function createInitialState(): OrchestratorState {
  return {
    children: {
      analyzer: null,
      summarizer: null,
      transformer: null,
    },
    hitl: {
      pending: false,
      request: null,
      history: [],
    },
    meta: {
      attempts: 0,
      lastError: null,
      currentModel: 'gpt-4o-mini',
      contextUsage: 0,
    },
  };
}

// ============================================================
// Derived Calculations
// ============================================================

/**
 * confidence 계산
 */
export function calculateConfidence(data: OrchestratorData): number {
  if (data.progress.total === 0) return 0;
  return data.progress.completed / data.progress.total;
}

/**
 * canProceed 계산
 */
export function calculateCanProceed(data: OrchestratorData, state: OrchestratorState): boolean {
  return !state.hitl.pending && data.phase !== 'FAILED';
}

/**
 * estimatedTimeRemaining 계산 (초 단위)
 */
export function calculateEstimatedTimeRemaining(data: OrchestratorData): number {
  const remaining = data.progress.total - data.progress.completed;
  // 평균 1초/파일로 가정
  return remaining;
}

// ============================================================
// Actions (Mutations)
// ============================================================

/**
 * 분석 시작
 */
export function startAnalysis(
  data: OrchestratorData,
  state: OrchestratorState,
  input: { rootDir: string; outputDir: string }
): { data: OrchestratorData; state: OrchestratorState } {
  return {
    data: {
      ...data,
      phase: 'ANALYZING',
      rootDir: input.rootDir,
      outputDir: input.outputDir,
    },
    state: {
      ...state,
      meta: {
        ...state.meta,
        attempts: state.meta.attempts + 1,
      },
    },
  };
}

/**
 * 진행 상황 업데이트
 */
export function updateProgress(
  data: OrchestratorData,
  progress: Partial<Progress>
): OrchestratorData {
  return {
    ...data,
    progress: { ...data.progress, ...progress },
  };
}

/**
 * Phase 변경
 */
export function setPhase(data: OrchestratorData, phase: MigrationPhase): OrchestratorData {
  return { ...data, phase };
}

/**
 * HITL 요청
 */
export function requestHITL(
  state: OrchestratorState,
  request: HITLRequest
): OrchestratorState {
  return {
    ...state,
    hitl: {
      ...state.hitl,
      pending: true,
      request,
    },
  };
}

/**
 * HITL 해결
 */
export function resolveHITL(
  state: OrchestratorState,
  optionId: string,
  customInput: string | null = null
): OrchestratorState {
  const request = state.hitl.request;
  if (!request) return state;

  const historyEntry: HITLHistoryEntry = {
    timestamp: Date.now(),
    request,
    response: { optionId, customInput },
  };

  return {
    ...state,
    hitl: {
      pending: false,
      request: null,
      history: [...state.hitl.history, historyEntry],
    },
  };
}

/**
 * 모델 업그레이드
 */
export function upgradeModel(
  state: OrchestratorState,
  model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet'
): OrchestratorState {
  return {
    ...state,
    meta: {
      ...state.meta,
      currentModel: model,
    },
  };
}

/**
 * 에러 설정
 */
export function setError(
  data: OrchestratorData,
  state: OrchestratorState,
  error: string
): { data: OrchestratorData; state: OrchestratorState } {
  return {
    data: { ...data, phase: 'FAILED' },
    state: {
      ...state,
      meta: {
        ...state.meta,
        lastError: error,
      },
    },
  };
}

/**
 * 도메인 추가
 */
export function addDiscoveredDomain(
  data: OrchestratorData,
  domain: DiscoveredDomain
): OrchestratorData {
  return {
    ...data,
    discoveredDomains: [...data.discoveredDomains, domain],
  };
}

/**
 * 도메인 업데이트
 */
export function updateDiscoveredDomain(
  data: OrchestratorData,
  name: string,
  updates: Partial<DiscoveredDomain>
): OrchestratorData {
  return {
    ...data,
    discoveredDomains: data.discoveredDomains.map(d =>
      d.name === name ? { ...d, ...updates } : d
    ),
  };
}

/**
 * 완료
 */
export function complete(data: OrchestratorData): OrchestratorData {
  return { ...data, phase: 'COMPLETE' };
}

// ============================================================
// Exports
// ============================================================

export type {
  OrchestratorData,
  OrchestratorState,
  MigrationPhase,
  AgentRef,
  HITLRequest,
  HITLOption,
  HITLHistoryEntry,
  Progress,
  DiscoveredDomain,
};
