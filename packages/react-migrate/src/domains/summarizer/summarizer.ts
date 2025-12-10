/**
 * Summarizer Domain Pure Functions
 *
 * Summarizer 도메인의 순수 함수들 - 상태 변경, 계산 로직
 */

import type {
  SummarizerData,
  SummarizerState,
  SummarizerDerived,
  SummarizerConfig,
  SummarizerSnapshot,
  DomainSummary,
  DomainRelationship,
  DomainConflict,
  ConflictResolution,
  SchemaProposal,
  ClusteringState,
  SummarizerError,
  RelationshipsByType,
} from './types.js';
import type { DomainCandidate, AmbiguousPattern } from '../analyzer/types.js';

// ============================================================
// Default Config
// ============================================================

export const DEFAULT_SUMMARIZER_CONFIG: SummarizerConfig = {
  minClusterSize: 2,
  confidenceThreshold: 0.7,
  enableLLMEnrichment: true,
  maxAlternatives: 3,
};

// ============================================================
// Initial State Creators
// ============================================================

/**
 * 초기 데이터 생성
 */
export function createInitialData(
  analyzerRef: string = '',
  config?: Partial<SummarizerConfig>
): SummarizerData {
  return {
    analyzerRef,
    domains: {},
    conflicts: [],
    config: {
      ...DEFAULT_SUMMARIZER_CONFIG,
      ...config,
    },
  };
}

/**
 * 초기 상태 생성
 */
export function createInitialState(): SummarizerState {
  return {
    relationships: {
      dependencies: [],
      sharedState: [],
      eventFlows: [],
    },
    schemaProposals: {},
    clustering: {
      status: 'idle',
      currentPhase: '',
      progress: 0,
    },
    ambiguous: [],
    meta: {
      attempts: 0,
      llmCallCount: 0,
      lastProcessedDomain: null,
      processingRate: 0,
      errors: [],
    },
  };
}

// ============================================================
// Domain Management
// ============================================================

/**
 * 도메인 요약 추가
 */
export function addDomain(
  data: SummarizerData,
  domain: DomainSummary
): SummarizerData {
  return {
    ...data,
    domains: {
      ...data.domains,
      [domain.id]: domain,
    },
  };
}

/**
 * 도메인 요약 업데이트 (ID + 부분 업데이트)
 */
export function updateDomain(
  data: SummarizerData,
  domainIdOrSummary: string | DomainSummary,
  updates?: Partial<DomainSummary>
): SummarizerData {
  // DomainSummary 전체를 받은 경우
  if (typeof domainIdOrSummary !== 'string') {
    const domain = domainIdOrSummary;
    return {
      ...data,
      domains: {
        ...data.domains,
        [domain.id]: domain,
      },
    };
  }

  // ID + 부분 업데이트인 경우
  const domainId = domainIdOrSummary;
  const existing = data.domains[domainId];
  if (!existing) return data;

  return {
    ...data,
    domains: {
      ...data.domains,
      [domainId]: { ...existing, ...updates },
    },
  };
}

/**
 * 도메인 삭제
 */
export function removeDomain(
  data: SummarizerData,
  domainId: string
): SummarizerData {
  const { [domainId]: _, ...rest } = data.domains;
  return { ...data, domains: rest };
}

/**
 * DomainCandidate에서 DomainSummary 생성
 */
export function createDomainSummary(
  candidate: DomainCandidate,
  description: string = ''
): DomainSummary {
  return {
    id: `summary-${candidate.id}`,
    name: candidate.name,
    description: description || `Domain ${candidate.name}`,
    sourceFiles: candidate.sourceFiles,
    entities: [],
    actions: [],
    boundaries: {
      imports: [],
      exports: [],
      sharedState: [],
    },
    suggestedBy: candidate.id,
    confidence: candidate.confidence,
    needsReview: candidate.confidence < 0.7,
    reviewNotes: [],
  };
}

// ============================================================
// Relationship Management
// ============================================================

/**
 * 모든 관계를 flat list로 가져오기
 */
function getAllRelationships(state: SummarizerState): DomainRelationship[] {
  return [
    ...state.relationships.dependencies,
    ...state.relationships.sharedState,
    ...state.relationships.eventFlows,
  ];
}

/**
 * 관계 타입에 따라 분류
 */
function categorizeRelationship(rel: DomainRelationship): keyof RelationshipsByType {
  switch (rel.type) {
    case 'dependency':
    case 'composition':
      return 'dependencies';
    case 'shared_state':
      return 'sharedState';
    case 'event_flow':
      return 'eventFlows';
    default:
      return 'dependencies';
  }
}

/**
 * 관계 추가
 */
export function addRelationship(
  state: SummarizerState,
  relationship: DomainRelationship
): SummarizerState {
  const all = getAllRelationships(state);
  const exists = all.some(r => r.id === relationship.id);
  if (exists) return state;

  const category = categorizeRelationship(relationship);

  return {
    ...state,
    relationships: {
      ...state.relationships,
      [category]: [...state.relationships[category], relationship],
    },
  };
}

/**
 * 여러 관계 추가
 */
export function addRelationships(
  state: SummarizerState,
  relationships: DomainRelationship[]
): SummarizerState {
  const all = getAllRelationships(state);
  const existingIds = new Set(all.map(r => r.id));
  const newRelationships = relationships.filter(r => !existingIds.has(r.id));

  // 카테고리별로 분류
  const byCategory: RelationshipsByType = {
    dependencies: [...state.relationships.dependencies],
    sharedState: [...state.relationships.sharedState],
    eventFlows: [...state.relationships.eventFlows],
  };

  for (const rel of newRelationships) {
    const category = categorizeRelationship(rel);
    byCategory[category].push(rel);
  }

  return {
    ...state,
    relationships: byCategory,
  };
}

/**
 * 특정 도메인의 관계 조회
 */
export function getRelationshipsForDomain(
  state: SummarizerState,
  domainId: string
): DomainRelationship[] {
  return getAllRelationships(state).filter(
    r => r.from === domainId || r.to === domainId
  );
}

/**
 * 두 도메인 사이의 관계 조회
 */
export function getRelationshipBetween(
  state: SummarizerState,
  domainId1: string,
  domainId2: string
): DomainRelationship | null {
  return getAllRelationships(state).find(
    r => (r.from === domainId1 && r.to === domainId2) ||
         (r.from === domainId2 && r.to === domainId1)
  ) ?? null;
}

// ============================================================
// Conflict Management
// ============================================================

/**
 * 충돌 추가
 */
export function addConflict(
  data: SummarizerData,
  conflict: DomainConflict
): SummarizerData {
  // 중복 체크
  const exists = data.conflicts.some(c => c.id === conflict.id);
  if (exists) return data;

  return {
    ...data,
    conflicts: [...data.conflicts, conflict],
  };
}

/**
 * 충돌 해결
 */
export function resolveConflict(
  data: SummarizerData,
  conflictId: string,
  resolution: ConflictResolution
): SummarizerData {
  return {
    ...data,
    conflicts: data.conflicts.filter(c => c.id !== conflictId),
    // TODO: resolution.action에 따라 도메인 수정
  };
}

/**
 * 미해결 충돌 조회
 */
export function getUnresolvedConflicts(
  data: SummarizerData
): DomainConflict[] {
  return data.conflicts;
}

/**
 * 충돌 생성 헬퍼
 */
export function createOwnershipConflict(
  file: string,
  domainIds: string[],
  suggestedResolutions: ConflictResolution[] = []
): DomainConflict {
  return {
    id: `conflict-ownership-${file}-${Date.now()}`,
    type: 'ownership',
    domains: domainIds,
    file,
    description: `File "${file}" is claimed by multiple domains`,
    suggestedResolutions,
  };
}

export function createNamingConflict(
  domainIds: string[],
  suggestedResolutions: ConflictResolution[] = []
): DomainConflict {
  return {
    id: `conflict-naming-${domainIds.join('-')}-${Date.now()}`,
    type: 'naming',
    domains: domainIds,
    description: `Multiple domains have similar names`,
    suggestedResolutions,
  };
}

// ============================================================
// Schema Proposal Management
// ============================================================

/**
 * 스키마 제안 추가
 */
export function addSchemaProposal(
  state: SummarizerState,
  proposal: SchemaProposal
): SummarizerState {
  return {
    ...state,
    schemaProposals: {
      ...state.schemaProposals,
      [proposal.domainId]: proposal,
    },
  };
}

/**
 * 스키마 제안 업데이트
 */
export function updateSchemaProposal(
  state: SummarizerState,
  domainId: string,
  updates: Partial<SchemaProposal>
): SummarizerState {
  const existing = state.schemaProposals[domainId];
  if (!existing) return state;

  return {
    ...state,
    schemaProposals: {
      ...state.schemaProposals,
      [domainId]: { ...existing, ...updates },
    },
  };
}

/**
 * 리뷰 완료 처리
 */
export function markProposalReviewed(
  state: SummarizerState,
  domainId: string
): SummarizerState {
  return updateSchemaProposal(state, domainId, { needsReview: false });
}

// ============================================================
// Clustering State Management
// ============================================================

/**
 * 클러스터링 상태 업데이트
 */
export function setClusteringState(
  state: SummarizerState,
  clustering: Partial<ClusteringState>
): SummarizerState {
  return {
    ...state,
    clustering: {
      ...state.clustering,
      ...clustering,
    },
  };
}

/**
 * 클러스터링 시작
 */
export function startClustering(state: SummarizerState): SummarizerState {
  return setClusteringState(state, {
    status: 'clustering',
    currentPhase: 'Analyzing domain candidates',
    progress: 0,
  });
}

/**
 * 클러스터링 완료
 */
export function completeClustering(
  state: SummarizerState,
  _clustersCount?: number
): SummarizerState {
  return setClusteringState(state, {
    status: 'done',
    currentPhase: 'Completed',
    progress: 100,
  });
}

// ============================================================
// Ambiguous Pattern Management
// ============================================================

/**
 * 애매한 패턴 추가 (Analyzer에서 넘어온 것 포함)
 */
export function addAmbiguousPatterns(
  state: SummarizerState,
  patterns: AmbiguousPattern[]
): SummarizerState {
  const existingIds = new Set(state.ambiguous.map(a => a.id));
  const newPatterns = patterns.filter(p => !existingIds.has(p.id));

  return {
    ...state,
    ambiguous: [...state.ambiguous, ...newPatterns],
  };
}

// ============================================================
// Meta Updates
// ============================================================

/**
 * 시도 횟수 증가
 */
export function incrementAttempts(state: SummarizerState): SummarizerState {
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
export function incrementLLMCalls(state: SummarizerState): SummarizerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      llmCallCount: state.meta.llmCallCount + 1,
    },
  };
}

/**
 * 마지막 처리된 도메인 설정
 */
export function setLastProcessedDomain(
  state: SummarizerState,
  domainId: string
): SummarizerState {
  return {
    ...state,
    meta: {
      ...state.meta,
      lastProcessedDomain: domainId,
    },
  };
}

/**
 * 처리 속도 업데이트
 */
export function updateProcessingRate(
  state: SummarizerState,
  domainsProcessed: number,
  elapsedSeconds: number
): SummarizerState {
  const rate = elapsedSeconds > 0 ? domainsProcessed / elapsedSeconds : 0;
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
  state: SummarizerState,
  error: string | { code: string; message: string; recoverable: boolean },
  domain?: string
): SummarizerState {
  const errorMessage = typeof error === 'string' ? error : error.message;
  const newError: SummarizerError = {
    domain,
    error: errorMessage,
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
  data: SummarizerData,
  state: SummarizerState
): SummarizerDerived {
  const domains = Object.values(data.domains);
  const domainsTotal = domains.length;

  // 스키마 제안이 생성된 도메인 수
  const proposalsReady = Object.keys(state.schemaProposals).length;
  const domainsProcessed = proposalsReady;

  const conflictsUnresolved = data.conflicts.length;

  // 전체 신뢰도 계산
  const overallConfidence = domains.length > 0
    ? domains.reduce((sum, d) => sum + d.confidence, 0) / domains.length
    : 0;

  // 진행률 계산
  const progress = domainsTotal > 0 ? (domainsProcessed / domainsTotal) * 100 : 0;

  // 예상 남은 시간
  const remaining = domainsTotal - domainsProcessed;
  const estimatedTimeRemaining = state.meta.processingRate > 0
    ? remaining / state.meta.processingRate
    : remaining;

  return {
    domainsTotal,
    domainsProcessed,
    conflictsUnresolved,
    proposalsReady,
    overallConfidence,
    progress,
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
  data: SummarizerData,
  state: SummarizerState
): SummarizerSnapshot {
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
 * 요약이 완료되었는지 확인
 */
export function isSummarizationComplete(
  data: SummarizerData,
  state: SummarizerState
): boolean {
  const domainCount = Object.keys(data.domains).length;
  const proposalCount = Object.keys(state.schemaProposals).length;
  const hasUnresolvedConflicts = data.conflicts.length > 0;

  return domainCount > 0 &&
         proposalCount >= domainCount &&
         !hasUnresolvedConflicts;
}

/**
 * 도메인이 리뷰 필요한지 확인
 */
export function needsReview(domain: DomainSummary, threshold: number): boolean {
  return domain.needsReview || domain.confidence < threshold;
}

/**
 * ID 생성
 */
export function generateId(prefix: string = ''): string {
  const random = Math.random().toString(36).substring(2, 9);
  const timestamp = Date.now().toString(36);
  return prefix ? `${prefix}-${timestamp}-${random}` : `${timestamp}-${random}`;
}
