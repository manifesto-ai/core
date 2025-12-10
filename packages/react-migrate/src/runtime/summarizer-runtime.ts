/**
 * Summarizer Runtime
 *
 * Summarizer 도메인의 런타임 - OrchestratorRuntime 패턴을 따름
 * Analyzer가 추출한 도메인 후보들을 클러스터링하고, 관계를 분석하여 Manifesto 스키마 제안을 생성
 */

import type { Storage } from '../storage/index.js';
import type { LLMProvider } from '../llm/types.js';
import type { FileAnalysis, DetectedPattern } from '../parser/types.js';
import type { DomainCandidate, DependencyGraph } from '../domains/analyzer/types.js';
import type {
  SummarizerData,
  SummarizerState,
  SummarizerDerived,
  SummarizerConfig,
  SummarizerEvent,
  SummarizerEventType,
  DomainSummary,
  DomainRelationship,
  DomainConflict,
  SchemaProposal,
  ConflictResolution,
} from '../domains/summarizer/types.js';
import {
  DEFAULT_SUMMARIZER_CONFIG,
  createInitialData,
  createInitialState,
  addDomain,
  updateDomain,
  addRelationships,
  addConflict,
  resolveConflict,
  addSchemaProposal,
  updateSchemaProposal,
  markProposalReviewed,
  startClustering,
  completeClustering,
  incrementAttempts,
  incrementLLMCalls,
  setLastProcessedDomain,
  updateProcessingRate,
  addError,
  calculateDerived,
  createOwnershipConflict,
  createNamingConflict,
} from '../domains/summarizer/summarizer.js';
import {
  performClustering,
  clustersToDomainSummaries,
} from '../domains/summarizer/algorithms/clustering.js';
import {
  analyzeAllRelationships,
  analyzeDomainBoundaries,
  detectCyclicDependencies,
} from '../domains/summarizer/algorithms/relationship.js';
import {
  generateSchemaProposal,
  validateSchemaProposal,
  extractEntitiesFromPatterns,
  extractActionsFromPatterns,
} from '../domains/summarizer/algorithms/schema-proposal.js';
import { createEffectHandlers, type EffectHandlers } from './effect-handlers.js';

/**
 * Summarizer Runtime 설정
 */
export interface SummarizerRuntimeConfig {
  storage: Storage;
  llmProvider: LLMProvider;
  sessionId: string;
  rootDir: string;
  outputDir: string;
  analyzerRef: string; // Analyzer 세션 참조
  config?: Partial<SummarizerConfig>;
}

/**
 * Summarizer 입력 데이터
 */
export interface SummarizerInput {
  candidates: DomainCandidate[];
  patterns: DetectedPattern[];
  analyses: FileAnalysis[];
  dependencyGraph: DependencyGraph;
}

/**
 * 스냅샷 변경 리스너
 */
export type SummarizerSnapshotListener = (
  data: SummarizerData,
  state: SummarizerState,
  derived: SummarizerDerived
) => void;

/**
 * 이벤트 핸들러 맵
 */
type EventHandlerMap = {
  [K in SummarizerEventType]?: Set<(payload: Extract<SummarizerEvent, { type: K }>['payload']) => void>;
};

/**
 * Summarizer Runtime
 */
export class SummarizerRuntime {
  private data: SummarizerData;
  private state: SummarizerState;
  private effectHandlers: EffectHandlers;
  private listeners: Set<SummarizerSnapshotListener> = new Set();
  private eventHandlers: EventHandlerMap = {};
  private sessionId: string;
  private storage: Storage;
  private config: SummarizerConfig;
  private startTime: number = 0;

  constructor(runtimeConfig: SummarizerRuntimeConfig) {
    this.sessionId = runtimeConfig.sessionId;
    this.storage = runtimeConfig.storage;
    this.config = { ...DEFAULT_SUMMARIZER_CONFIG, ...runtimeConfig.config };
    this.data = createInitialData(runtimeConfig.analyzerRef, runtimeConfig.config);
    this.state = createInitialState();
    this.effectHandlers = createEffectHandlers({
      storage: runtimeConfig.storage,
      llmProvider: runtimeConfig.llmProvider,
      sessionId: runtimeConfig.sessionId,
      rootDir: runtimeConfig.rootDir,
      outputDir: runtimeConfig.outputDir,
    });
  }

  // ============================================================
  // Getters
  // ============================================================

  getData(): SummarizerData {
    return this.data;
  }

  getState(): SummarizerState {
    return this.state;
  }

  getDerived(): SummarizerDerived {
    return calculateDerived(this.data, this.state);
  }

  getSnapshot() {
    return {
      data: this.data,
      state: this.state,
      derived: this.getDerived(),
    };
  }

  // ============================================================
  // Main Run Loop
  // ============================================================

  /**
   * 요약 실행
   */
  async run(input: SummarizerInput): Promise<SummarizerDerived> {
    this.startTime = Date.now();
    this.state = incrementAttempts(this.state);

    const { candidates, patterns, analyses, dependencyGraph } = input;

    // 패턴-파일 매핑 생성 (analyses를 통해)
    const patternFileMap = new Map<DetectedPattern, string>();
    for (const analysis of analyses) {
      for (const pattern of analysis.patterns) {
        patternFileMap.set(pattern, analysis.path);
      }
    }

    this.emit({
      type: 'summarizer:started',
      payload: { totalCandidates: candidates.length },
    });

    try {
      // 1. 클러스터링 단계
      await this.performClusteringPhase(candidates, dependencyGraph);

      // 2. 관계 분석 단계
      await this.performRelationshipPhase(dependencyGraph);

      // 3. 충돌 감지 단계
      await this.detectConflicts();

      // 4. 스키마 제안 생성 단계
      await this.generateProposals(patterns, patternFileMap);

      // 5. 검증 단계
      await this.validateProposals();

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.state = addError(this.state, {
        code: 'SUMMARIZER_ERROR',
        message: errorMsg,
        recoverable: false,
      });
      this.emit({ type: 'summarizer:error', payload: { error: errorMsg, fatal: true } });
      throw error;
    }

    // 최종 스냅샷 저장
    await this.persistSnapshot();

    const finalDerived = this.getDerived();
    this.emit({ type: 'summarizer:done', payload: finalDerived });
    this.notifyListeners();

    return finalDerived;
  }

  /**
   * 클러스터링 단계
   */
  private async performClusteringPhase(
    candidates: DomainCandidate[],
    graph: DependencyGraph
  ): Promise<void> {
    this.state = startClustering(this.state);

    this.emit({
      type: 'summarizer:clustering:started',
      payload: { filesCount: candidates.flatMap(c => c.sourceFiles).length },
    });

    // 클러스터링 실행
    const clusteringResult = performClustering(
      candidates,
      graph,
      this.config.minClusterSize
    );

    // 클러스터에서 도메인 요약 생성
    const domainSummaries = clustersToDomainSummaries(
      clusteringResult.clusters,
      candidates
    );

    // 도메인 추가
    let processedCount = 0;
    for (const summary of domainSummaries) {
      this.data = addDomain(this.data, summary);

      this.emit({
        type: 'summarizer:domain:created',
        payload: summary,
      });

      processedCount++;
      this.updateProgress(processedCount, domainSummaries.length, 'clustering');
    }

    // 노이즈 파일 (클러스터에 속하지 않는 파일들) - 로그만 남김
    // AmbiguousPattern은 Analyzer에서 정의된 타입이므로 여기서는 사용하지 않음
    if (clusteringResult.noise.length > 0) {
      // 노이즈 파일들은 별도 처리 없이 로깅만
      console.warn(`Unclustered files: ${clusteringResult.noise.length} files`);
    }

    this.state = completeClustering(this.state, clusteringResult.clusters.length);

    this.emit({
      type: 'summarizer:clustering:completed',
      payload: {
        clustersCount: clusteringResult.clusters.length,
        noiseCount: clusteringResult.noise.length,
      },
    });

    await this.persistSnapshot();
  }

  /**
   * 관계 분석 단계
   */
  private async performRelationshipPhase(graph: DependencyGraph): Promise<void> {
    this.emit({
      type: 'summarizer:relationship:started',
      payload: { domainsCount: Object.keys(this.data.domains).length },
    });

    const domains = Object.values(this.data.domains);

    // 각 도메인의 경계 분석
    const analyzedDomains: DomainSummary[] = [];
    for (const domain of domains) {
      const analyzed = analyzeDomainBoundaries(domain, domains, graph);
      this.data = updateDomain(this.data, analyzed);
      analyzedDomains.push(analyzed);

      this.state = setLastProcessedDomain(this.state, domain.id);
    }

    // 모든 관계 분석
    const relationshipResult = analyzeAllRelationships(analyzedDomains, graph);

    // 관계 추가
    this.state = addRelationships(this.state, relationshipResult.relationships);

    // 강한 결합 경고 - 별도의 충돌로 추가
    for (const coupling of relationshipResult.strongCouplings) {
      const conflict: DomainConflict = {
        id: `conflict-coupling-${coupling.from}-${coupling.to}-${Date.now()}`,
        type: 'boundary',
        domains: [coupling.from, coupling.to],
        description: `Strong coupling (${(coupling.strength * 100).toFixed(0)}%) between domains`,
        suggestedResolutions: [],
      };
      this.data = addConflict(this.data, conflict);
      this.emit({
        type: 'summarizer:conflict:detected',
        payload: conflict,
      });
    }

    // 순환 의존성 감지
    const cycles = detectCyclicDependencies(analyzedDomains, relationshipResult.relationships);
    for (const cycle of cycles) {
      const conflict: DomainConflict = {
        id: `conflict-cycle-${cycle.join('-')}-${Date.now()}`,
        type: 'boundary',
        domains: cycle,
        description: `Cyclic dependency detected: ${cycle.join(' → ')} → ${cycle[0]}`,
        suggestedResolutions: [],
      };
      this.data = addConflict(this.data, conflict);
      this.emit({
        type: 'summarizer:conflict:detected',
        payload: conflict,
      });
    }

    this.emit({
      type: 'summarizer:relationship:completed',
      payload: {
        relationshipsCount: relationshipResult.relationships.length,
        strongCouplingsCount: relationshipResult.strongCouplings.length,
      },
    });

    await this.persistSnapshot();
  }

  /**
   * 충돌 감지 단계
   */
  private async detectConflicts(): Promise<void> {
    const domains = Object.values(this.data.domains);

    // 파일 소유권 충돌 감지
    const fileOwnership = new Map<string, string[]>();
    for (const domain of domains) {
      for (const file of domain.sourceFiles) {
        if (!fileOwnership.has(file)) {
          fileOwnership.set(file, []);
        }
        fileOwnership.get(file)!.push(domain.id);
      }
    }

    for (const [file, owners] of fileOwnership) {
      if (owners.length > 1) {
        const conflict = createOwnershipConflict(file, owners);
        this.data = addConflict(this.data, conflict);

        this.emit({
          type: 'summarizer:conflict:detected',
          payload: conflict,
        });

        this.emit({
          type: 'summarizer:hitl:needed',
          payload: {
            type: 'ownership',
            file,
            domains: owners,
            suggestion: owners[0],
          },
        });
      }
    }

    // 이름 충돌 감지
    const nameCount = new Map<string, string[]>();
    for (const domain of domains) {
      const normalizedName = domain.name.toLowerCase();
      if (!nameCount.has(normalizedName)) {
        nameCount.set(normalizedName, []);
      }
      nameCount.get(normalizedName)!.push(domain.id);
    }

    for (const [_name, domainIds] of nameCount) {
      if (domainIds.length > 1) {
        const conflict = createNamingConflict(domainIds);
        this.data = addConflict(this.data, conflict);

        this.emit({
          type: 'summarizer:conflict:detected',
          payload: conflict,
        });
      }
    }
  }

  /**
   * 스키마 제안 생성 단계
   */
  private async generateProposals(
    patterns: DetectedPattern[],
    patternFileMap: Map<DetectedPattern, string>
  ): Promise<void> {
    const domains = Object.values(this.data.domains);
    const relationships = [
      ...this.state.relationships.dependencies,
      ...this.state.relationships.sharedState,
      ...this.state.relationships.eventFlows,
    ];

    this.emit({
      type: 'summarizer:proposal:started',
      payload: { domainsCount: domains.length },
    });

    let processedCount = 0;
    for (const domain of domains) {
      // 도메인에 해당하는 패턴 필터링 (patternFileMap 사용)
      const domainPatterns = patterns.filter(p => {
        const patternFile = patternFileMap.get(p);
        return patternFile && domain.sourceFiles.includes(patternFile);
      });

      // 도메인 관련 관계 필터링
      const domainRelationships = relationships.filter(
        r => r.from === domain.id || r.to === domain.id
      );

      // 스키마 제안 생성
      const proposal = generateSchemaProposal(
        domain,
        domainPatterns,
        domainRelationships,
        { confidenceThreshold: this.config.confidenceThreshold }
      );

      this.state = addSchemaProposal(this.state, proposal);

      this.emit({
        type: 'summarizer:proposal:generated',
        payload: proposal,
      });

      // 리뷰 필요 여부 확인
      if (proposal.needsReview) {
        this.emit({
          type: 'summarizer:hitl:needed',
          payload: {
            type: 'schema_review',
            domainId: domain.id,
            proposal,
            reviewNotes: proposal.reviewNotes,
          },
        });
      }

      processedCount++;
      this.updateProgress(processedCount, domains.length, 'proposal');
      this.state = setLastProcessedDomain(this.state, domain.id);
    }

    this.emit({
      type: 'summarizer:proposal:completed',
      payload: {
        proposalsCount: Object.keys(this.state.schemaProposals).length,
        needsReviewCount: Object.values(this.state.schemaProposals).filter(p => p.needsReview).length,
      },
    });

    await this.persistSnapshot();
  }

  /**
   * 제안 검증 단계
   */
  private async validateProposals(): Promise<void> {
    const proposals = Object.values(this.state.schemaProposals);

    for (const proposal of proposals) {
      const validation = validateSchemaProposal(proposal);

      if (!validation.valid) {
        this.emit({
          type: 'summarizer:error',
          payload: {
            error: `Validation failed for ${proposal.domainName}: ${validation.errors.join(', ')}`,
            fatal: false,
          },
        });

        // 검증 실패한 제안은 리뷰 필요로 표시
        this.state = updateSchemaProposal(this.state, proposal.id, {
          needsReview: true,
          reviewNotes: [...proposal.reviewNotes, ...validation.errors],
        });
      }
    }
  }

  /**
   * 진행 상황 업데이트
   */
  private updateProgress(current: number, total: number, phase: string): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.state = updateProcessingRate(this.state, current, elapsed);

    const derived = this.getDerived();
    this.emit({
      type: 'summarizer:progress',
      payload: {
        phase,
        completed: current,
        total,
        overallProgress: derived.progress,
      },
    });

    this.notifyListeners();
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 충돌 해결
   */
  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    this.data = resolveConflict(this.data, conflictId, resolution);

    this.emit({
      type: 'summarizer:conflict:resolved',
      payload: { conflictId, resolution },
    });

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 스키마 제안 승인
   */
  async approveProposal(proposalId: string): Promise<void> {
    this.state = markProposalReviewed(this.state, proposalId);

    this.emit({
      type: 'summarizer:proposal:approved',
      payload: { proposalId },
    });

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 스키마 제안 수정
   */
  async updateProposal(proposalId: string, updates: Partial<SchemaProposal>): Promise<void> {
    this.state = updateSchemaProposal(this.state, proposalId, updates);

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 도메인 병합
   */
  async mergeDomains(domainIds: string[], newName: string): Promise<DomainSummary> {
    const domains = domainIds.map(id => this.data.domains[id]).filter(Boolean) as DomainSummary[];

    if (domains.length < 2) {
      throw new Error('Need at least 2 domains to merge');
    }

    // 새 도메인 생성
    const mergedDomain: DomainSummary = {
      id: `domain-merged-${Date.now()}`,
      name: newName,
      description: `Merged from: ${domains.map(d => d.name).join(', ')}`,
      sourceFiles: [...new Set(domains.flatMap(d => d.sourceFiles))],
      entities: domains.flatMap(d => d.entities),
      actions: domains.flatMap(d => d.actions),
      boundaries: {
        imports: [...new Set(domains.flatMap(d => d.boundaries.imports))],
        exports: [...new Set(domains.flatMap(d => d.boundaries.exports))],
        sharedState: [...new Set(domains.flatMap(d => d.boundaries.sharedState))],
      },
      suggestedBy: 'user_merge',
      confidence: Math.max(...domains.map(d => d.confidence)),
      needsReview: false,
      reviewNotes: [`Merged from domains: ${domainIds.join(', ')}`],
    };

    // 기존 도메인 제거
    for (const id of domainIds) {
      delete this.data.domains[id];
    }

    // 새 도메인 추가
    this.data = addDomain(this.data, mergedDomain);

    this.emit({
      type: 'summarizer:domain:merged',
      payload: { fromDomains: domainIds, toDomain: mergedDomain.id },
    });

    await this.persistSnapshot();
    this.notifyListeners();

    return mergedDomain;
  }

  /**
   * LLM을 사용하여 도메인 이름 제안
   */
  async suggestDomainName(domainId: string): Promise<string[]> {
    const domain = this.data.domains[domainId];
    if (!domain) {
      throw new Error(`Domain not found: ${domainId}`);
    }

    this.state = incrementLLMCalls(this.state);

    // LLM 호출로 이름 제안 받기 (실제 구현에서는 LLM provider 사용)
    // 여기서는 휴리스틱 기반 제안
    const suggestions: string[] = [];

    // 파일 경로에서 추출
    const pathSegments = domain.sourceFiles
      .flatMap(f => f.split('/'))
      .filter(s => !['src', 'lib', 'components', 'hooks', 'utils', 'index'].includes(s))
      .filter(s => !s.includes('.'));

    const segmentCounts = new Map<string, number>();
    for (const segment of pathSegments) {
      segmentCounts.set(segment, (segmentCounts.get(segment) ?? 0) + 1);
    }

    // 가장 빈번한 세그먼트들
    const sorted = [...segmentCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    for (const [segment] of sorted) {
      if (segment.length > 2) {
        suggestions.push(segment.toLowerCase());
      }
    }

    // 엔티티 이름에서 추출
    for (const entity of domain.entities.slice(0, 2)) {
      const name = entity.name.replace(/Props|State|Context/g, '').toLowerCase();
      if (name.length > 2 && !suggestions.includes(name)) {
        suggestions.push(name);
      }
    }

    return suggestions.slice(0, 5);
  }

  // ============================================================
  // Event Emission
  // ============================================================

  /**
   * 이벤트 발생
   */
  private emit(event: SummarizerEvent): void {
    const handlers = this.eventHandlers[event.type as SummarizerEventType];
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event.payload as never);
        } catch (e) {
          console.error(`Error in event handler for ${event.type}:`, e);
        }
      }
    }

    // Effect 로깅
    this.effectHandlers.logEffect(event.type, event.payload).catch(console.error);
  }

  /**
   * 이벤트 핸들러 등록
   */
  on<K extends SummarizerEventType>(
    type: K,
    handler: (payload: Extract<SummarizerEvent, { type: K }>['payload']) => void
  ): () => void {
    if (!this.eventHandlers[type]) {
      this.eventHandlers[type] = new Set() as EventHandlerMap[K];
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handlers = this.eventHandlers[type] as Set<any>;
    handlers.add(handler);

    return () => {
      handlers.delete(handler);
    };
  }

  // ============================================================
  // Persistence
  // ============================================================

  /**
   * 스냅샷 영속화
   */
  private async persistSnapshot(): Promise<void> {
    await this.effectHandlers.saveSnapshot('summarizer', this.data, this.state);
  }

  /**
   * 스냅샷 복원
   */
  async restore(): Promise<boolean> {
    const result = await this.effectHandlers.loadSnapshot<SummarizerData, SummarizerState>('summarizer');
    if (result.success && result.data) {
      this.data = result.data.data;
      this.state = result.data.state;
      this.notifyListeners();
      return true;
    }
    return false;
  }

  // ============================================================
  // Subscription
  // ============================================================

  /**
   * 리스너 등록
   */
  subscribe(listener: SummarizerSnapshotListener): () => void {
    this.listeners.add(listener);
    // 즉시 현재 상태 전달
    listener(this.data, this.state, this.getDerived());
    return () => this.listeners.delete(listener);
  }

  /**
   * 리스너 알림
   */
  private notifyListeners(): void {
    const derived = this.getDerived();
    for (const listener of this.listeners) {
      listener(this.data, this.state, derived);
    }
  }
}

/**
 * Summarizer Runtime 생성
 */
export function createSummarizerRuntime(
  config: SummarizerRuntimeConfig
): SummarizerRuntime {
  return new SummarizerRuntime(config);
}
