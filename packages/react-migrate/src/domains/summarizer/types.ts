/**
 * Summarizer Domain Types
 *
 * Analyzer가 추출한 도메인 후보들을 클러스터링하고,
 * 관계를 분석하여 Manifesto 스키마 제안을 생성합니다.
 */

import type { DomainCandidate, AmbiguousPattern } from '../analyzer/types.js';
import type { DetectedPattern } from '../../parser/types.js';

// ============================================================
// Domain Summary
// ============================================================

/**
 * 추출된 엔티티
 */
export interface ExtractedEntity {
  id: string;
  name: string;
  type: 'entity' | 'value_object' | 'enum';
  fields: ExtractedField[];
  sourcePatterns: string[]; // pattern IDs
  confidence: number;
}

/**
 * 추출된 필드
 */
export interface ExtractedField {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}

/**
 * 추출된 액션
 */
export interface ExtractedAction {
  id: string;
  name: string;
  type: 'command' | 'query' | 'event';
  input?: ExtractedEntity;
  output?: ExtractedEntity;
  sourcePatterns: string[]; // pattern IDs
  confidence: number;
}

/**
 * 도메인 경계
 */
export interface DomainBoundary {
  imports: string[]; // 다른 도메인으로부터의 import
  exports: string[]; // 다른 도메인으로의 export
  sharedState: string[]; // 공유하는 Context/State 이름
}

/**
 * 도메인 요약
 */
export interface DomainSummary {
  id: string;
  name: string;
  description: string;
  sourceFiles: string[];
  entities: ExtractedEntity[];
  actions: ExtractedAction[];
  boundaries: DomainBoundary;
  suggestedBy: string; // DomainCandidate ID
  confidence: number;
  needsReview: boolean;
  reviewNotes: string[];
}

// ============================================================
// Domain Relationships
// ============================================================

/**
 * 도메인 관계 타입
 */
export type RelationshipType =
  | 'dependency'    // 의존성 (A imports B)
  | 'shared_state'  // 공유 상태 (Context 공유)
  | 'event_flow'    // 이벤트 흐름 (콜백, Effect)
  | 'composition';  // 컴포지션 (컴포넌트 내포)

/**
 * 도메인 관계
 */
export interface DomainRelationship {
  id: string;
  type: RelationshipType;
  from: string; // domain ID
  to: string;   // domain ID
  strength: number; // 0-1
  evidence: string[]; // 관계를 뒷받침하는 파일들
  description?: string;
}

// ============================================================
// Conflicts
// ============================================================

/**
 * 도메인 충돌
 */
export interface DomainConflict {
  id: string;
  type: 'ownership' | 'naming' | 'boundary';
  domains: string[]; // 충돌하는 도메인 ID들
  file?: string; // 충돌이 발생한 파일 (ownership)
  description: string;
  suggestedResolutions: ConflictResolution[];
}

/**
 * 충돌 해결 방안
 */
export interface ConflictResolution {
  id: string;
  label: string;
  action: 'merge' | 'split' | 'assign' | 'rename';
  params: Record<string, unknown>;
  confidence: number;
}

// ============================================================
// Schema Proposals
// ============================================================

/**
 * 스키마 필드 제안
 */
export interface SchemaFieldProposal {
  path: string;       // semantic path (e.g., "user.profile.name")
  type: string;       // 타입 (string, number, boolean, object, array)
  description?: string;
  source: string;     // 추출된 소스 파일
  confidence: number;
}

/**
 * 스키마 제안
 */
export interface SchemaProposal {
  id: string;
  domainId: string;
  domainName: string;
  entities: SchemaFieldProposal[];
  state: SchemaFieldProposal[];
  intents: SchemaFieldProposal[];
  confidence: number;
  alternatives: SchemaProposal[];
  reviewNotes: string[];
  needsReview: boolean;
}

// ============================================================
// Summarizer Data & State
// ============================================================

/**
 * Summarizer 설정
 */
export interface SummarizerConfig {
  minClusterSize: number;
  confidenceThreshold: number;
  enableLLMEnrichment: boolean;
  maxAlternatives: number;
}

/**
 * Summarizer 데이터 (영속화되는 비즈니스 데이터)
 */
export interface SummarizerData {
  analyzerRef: string; // Analyzer 스냅샷 참조
  domains: Record<string, DomainSummary>;
  conflicts: DomainConflict[];
  config: SummarizerConfig;
}

/**
 * 클러스터링 상태
 */
export interface ClusteringState {
  status: 'idle' | 'clustering' | 'enriching' | 'proposing' | 'done';
  currentPhase: string;
  progress: number;
}

/**
 * 관계 타입별 관계 목록
 */
export interface RelationshipsByType {
  dependencies: DomainRelationship[];
  sharedState: DomainRelationship[];
  eventFlows: DomainRelationship[];
}

/**
 * Summarizer 상태 (세션 중 변하는 런타임 상태)
 */
export interface SummarizerState {
  relationships: RelationshipsByType;
  schemaProposals: Record<string, SchemaProposal>;
  clustering: ClusteringState;
  ambiguous: AmbiguousPattern[]; // Analyzer에서 넘어온 + 새로 발견된
  meta: {
    attempts: number;
    llmCallCount: number;
    lastProcessedDomain: string | null;
    processingRate: number;
    errors: SummarizerError[];
  };
}

/**
 * Summarizer 에러
 */
export interface SummarizerError {
  domain?: string;
  error: string;
  timestamp: number;
}

/**
 * Summarizer Derived (계산된 값들)
 */
export interface SummarizerDerived {
  domainsTotal: number;
  domainsProcessed: number;
  conflictsUnresolved: number;
  proposalsReady: number;
  overallConfidence: number;
  progress: number;
  estimatedTimeRemaining: number;
}

/**
 * Summarizer 스냅샷
 */
export interface SummarizerSnapshot {
  data: SummarizerData;
  state: SummarizerState;
  derived: SummarizerDerived;
}

// ============================================================
// Events
// ============================================================

/**
 * Summarizer 이벤트 타입
 */
export type SummarizerEventType =
  | 'summarizer:started'
  | 'summarizer:clustering:started'
  | 'summarizer:clustering:completed'
  | 'summarizer:domain:created'
  | 'summarizer:domain:started'
  | 'summarizer:domain:completed'
  | 'summarizer:domain:failed'
  | 'summarizer:domain:merged'
  | 'summarizer:relationship:started'
  | 'summarizer:relationship:completed'
  | 'summarizer:relationship:discovered'
  | 'summarizer:conflict:detected'
  | 'summarizer:conflict:resolved'
  | 'summarizer:proposal:started'
  | 'summarizer:proposal:generated'
  | 'summarizer:proposal:approved'
  | 'summarizer:proposal:completed'
  | 'summarizer:hitl:needed'
  | 'summarizer:progress'
  | 'summarizer:error'
  | 'summarizer:done';

/**
 * Summarizer 이벤트
 */
export type SummarizerEvent =
  | { type: 'summarizer:started'; payload: { totalCandidates: number } }
  | { type: 'summarizer:clustering:started'; payload: { filesCount: number } }
  | { type: 'summarizer:clustering:completed'; payload: { clustersCount: number; noiseCount: number } }
  | { type: 'summarizer:domain:created'; payload: DomainSummary }
  | { type: 'summarizer:domain:started'; payload: { domainId: string; domainName: string } }
  | { type: 'summarizer:domain:completed'; payload: { domainId: string; entities: number; actions: number } }
  | { type: 'summarizer:domain:failed'; payload: { domainId: string; error: string } }
  | { type: 'summarizer:domain:merged'; payload: { fromDomains: string[]; toDomain: string } }
  | { type: 'summarizer:relationship:started'; payload: { domainsCount: number } }
  | { type: 'summarizer:relationship:completed'; payload: { relationshipsCount: number; strongCouplingsCount: number } }
  | { type: 'summarizer:relationship:discovered'; payload: DomainRelationship }
  | { type: 'summarizer:conflict:detected'; payload: DomainConflict }
  | { type: 'summarizer:conflict:resolved'; payload: { conflictId: string; resolution: ConflictResolution } }
  | { type: 'summarizer:proposal:started'; payload: { domainsCount: number } }
  | { type: 'summarizer:proposal:generated'; payload: SchemaProposal }
  | { type: 'summarizer:proposal:approved'; payload: { proposalId: string } }
  | { type: 'summarizer:proposal:completed'; payload: { proposalsCount: number; needsReviewCount: number } }
  | { type: 'summarizer:hitl:needed'; payload: { type: string; [key: string]: unknown } }
  | { type: 'summarizer:progress'; payload: { phase: string; completed: number; total: number; overallProgress: number } }
  | { type: 'summarizer:error'; payload: { error: string; fatal: boolean } }
  | { type: 'summarizer:done'; payload: SummarizerDerived };

/**
 * 이벤트 리스너
 */
export type SummarizerEventListener<T extends SummarizerEventType> = (
  payload: Extract<SummarizerEvent, { type: T }>['payload']
) => void;

/**
 * 이벤트 에미터
 */
export interface SummarizerEventEmitter {
  on<T extends SummarizerEventType>(type: T, listener: SummarizerEventListener<T>): () => void;
  emit(event: SummarizerEvent): void;
}

// ============================================================
// Inputs (Action Parameters)
// ============================================================

/**
 * 도메인 요약 생성 입력
 */
export interface SummarizeDomainInput {
  candidate: DomainCandidate;
  patterns: DetectedPattern[];
}

/**
 * 관계 분석 입력
 */
export interface AnalyzeRelationshipsInput {
  domains: DomainSummary[];
  graph: { nodes: string[]; edges: Array<{ source: string; target: string }> };
}

/**
 * 스키마 제안 생성 입력
 */
export interface GenerateProposalInput {
  domain: DomainSummary;
  relationships: DomainRelationship[];
}

/**
 * 충돌 해결 입력
 */
export interface ResolveConflictInput {
  conflictId: string;
  resolutionId: string;
}
