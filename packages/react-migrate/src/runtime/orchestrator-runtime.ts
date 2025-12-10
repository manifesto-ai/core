import type { Storage } from '../storage/index.js';
import type { LLMProvider } from '../llm/types.js';
import type {
  OrchestratorData,
  OrchestratorState,
  HITLRequest,
  DiscoveredDomain,
  MigrationPhase,
} from '../domains/types.js';
import {
  createInitialData,
  createInitialState,
  startAnalysis,
  updateProgress,
  setPhase,
  requestHITL,
  resolveHITL,
  upgradeModel,
  setError,
  addDiscoveredDomain,
  updateDiscoveredDomain,
  complete,
  calculateConfidence,
  calculateCanProceed,
  calculateEstimatedTimeRemaining,
} from '../domains/orchestrator.js';
import { createEffectHandlers, type EffectHandlers } from './effect-handlers.js';

/**
 * Orchestrator Runtime 설정
 */
export interface OrchestratorRuntimeConfig {
  storage: Storage;
  llmProvider: LLMProvider;
  sessionId: string;
  rootDir: string;
  outputDir: string;
}

/**
 * 스냅샷 변경 리스너
 */
export type SnapshotListener = (
  data: OrchestratorData,
  state: OrchestratorState,
  derived: { confidence: number; canProceed: boolean; estimatedTimeRemaining: number }
) => void;

/**
 * Orchestrator Runtime
 */
export class OrchestratorRuntime {
  private data: OrchestratorData;
  private state: OrchestratorState;
  private effectHandlers: EffectHandlers;
  private listeners: Set<SnapshotListener> = new Set();
  private sessionId: string;
  private storage: Storage;

  constructor(config: OrchestratorRuntimeConfig) {
    this.sessionId = config.sessionId;
    this.storage = config.storage;
    this.data = createInitialData(config.rootDir, config.outputDir);
    this.state = createInitialState();
    this.effectHandlers = createEffectHandlers({
      storage: config.storage,
      llmProvider: config.llmProvider,
      sessionId: config.sessionId,
      rootDir: config.rootDir,
      outputDir: config.outputDir,
    });
  }

  // ============================================================
  // Getters
  // ============================================================

  getData(): OrchestratorData {
    return this.data;
  }

  getState(): OrchestratorState {
    return this.state;
  }

  getDerived() {
    return {
      confidence: calculateConfidence(this.data),
      canProceed: calculateCanProceed(this.data, this.state),
      estimatedTimeRemaining: calculateEstimatedTimeRemaining(this.data),
    };
  }

  getSnapshot() {
    return {
      data: this.data,
      state: this.state,
      derived: this.getDerived(),
    };
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 분석 시작
   */
  async start(rootDir: string, outputDir: string): Promise<void> {
    const result = startAnalysis(this.data, this.state, { rootDir, outputDir });
    this.data = result.data;
    this.state = result.state;

    await this.effectHandlers.logEffect('startAnalysis', { rootDir, outputDir });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 진행 상황 업데이트
   */
  async setProgress(progress: Partial<typeof this.data.progress>): Promise<void> {
    this.data = updateProgress(this.data, progress);
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * Phase 변경
   */
  async setPhase(phase: MigrationPhase): Promise<void> {
    this.data = setPhase(this.data, phase);
    await this.effectHandlers.logEffect('setPhase', { phase });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * HITL 요청
   */
  async requestHumanInput(request: HITLRequest): Promise<void> {
    this.state = requestHITL(this.state, request);
    await this.effectHandlers.logEffect('requestHITL', { request });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * HITL 해결
   */
  async resolveHumanInput(optionId: string, customInput?: string | null): Promise<void> {
    this.state = resolveHITL(this.state, optionId, customInput ?? null);
    await this.effectHandlers.logEffect('resolveHITL', { optionId, customInput });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 모델 업그레이드
   */
  async upgradeModel(model: 'gpt-4o-mini' | 'gpt-4o' | 'claude-sonnet'): Promise<void> {
    this.state = upgradeModel(this.state, model);
    await this.effectHandlers.logEffect('upgradeModel', { model });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 에러 설정
   */
  async setError(error: string): Promise<void> {
    const result = setError(this.data, this.state, error);
    this.data = result.data;
    this.state = result.state;
    await this.effectHandlers.logEffect('setError', { error });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 도메인 추가
   */
  async addDomain(domain: DiscoveredDomain): Promise<void> {
    this.data = addDiscoveredDomain(this.data, domain);
    await this.effectHandlers.logEffect('addDomain', { domain });
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 도메인 업데이트
   */
  async updateDomain(name: string, updates: Partial<DiscoveredDomain>): Promise<void> {
    this.data = updateDiscoveredDomain(this.data, name, updates);
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 완료
   */
  async complete(): Promise<void> {
    this.data = complete(this.data);
    await this.effectHandlers.logEffect('complete', {});
    await this.persistSnapshot();
    this.notifyListeners();
  }

  // ============================================================
  // Effect Handlers
  // ============================================================

  /**
   * 파일 스캔
   */
  async scanFiles() {
    return this.effectHandlers.scanFiles();
  }

  /**
   * 파일 분석
   */
  async analyzeFile(path: string) {
    return this.effectHandlers.analyzeFile(path);
  }

  /**
   * LLM 호출
   */
  async llmCall(prompt: string, context?: unknown) {
    return this.effectHandlers.llmCall(prompt, context);
  }

  /**
   * 도메인 파일 출력
   */
  async writeDomainFile(name: string, content: unknown) {
    return this.effectHandlers.writeDomainFile(name, content);
  }

  // ============================================================
  // Persistence
  // ============================================================

  /**
   * 스냅샷 영속화
   */
  private async persistSnapshot(): Promise<void> {
    await this.effectHandlers.saveSnapshot('orchestrator', this.data, this.state);
  }

  /**
   * 스냅샷 복원
   */
  async restore(): Promise<boolean> {
    const result = await this.effectHandlers.loadSnapshot<OrchestratorData, OrchestratorState>('orchestrator');
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
  subscribe(listener: SnapshotListener): () => void {
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
 * Orchestrator Runtime 생성
 */
export function createOrchestratorRuntime(
  config: OrchestratorRuntimeConfig
): OrchestratorRuntime {
  return new OrchestratorRuntime(config);
}
