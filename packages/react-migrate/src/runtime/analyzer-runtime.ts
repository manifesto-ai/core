/**
 * Analyzer Runtime
 *
 * Analyzer 도메인의 런타임 - OrchestratorRuntime 패턴을 따름
 */

import type { Storage } from '../storage/index.js';
import type { LLMProvider } from '../llm/types.js';
import type { FileAnalysis } from '../parser/types.js';
import type {
  AnalyzerData,
  AnalyzerState,
  AnalyzerDerived,
  AnalyzerConfig,
  AnalyzerEvent,
  AnalyzerEventType,
  FileTask,
  DomainCandidate,
  AmbiguousPattern,
  DependencyGraph,
} from '../domains/analyzer/types.js';
import {
  createInitialData,
  createInitialState,
  addToQueue,
  setCurrentTask,
  completeTask,
  failTask,
  skipTask,
  addDomainCandidates,
  addAmbiguousPattern,
  setDependencyGraph,
  incrementAttempts,
  setLastProcessedFile,
  updateProcessingRate,
  calculateDerived,
  isAnalysisComplete,
  needsHITL,
  getNextTask,
} from '../domains/analyzer/analyzer.js';
import {
  createFileTasks,
} from '../domains/analyzer/algorithms/priority.js';
import {
  buildDependencyGraph,
  analyzeGraph,
} from '../domains/analyzer/algorithms/dependency-graph.js';
import {
  extractDomainCandidates,
  detectAmbiguousPatterns,
} from '../domains/analyzer/algorithms/domain-extractor.js';
import { createEffectHandlers, type EffectHandlers } from './effect-handlers.js';

/**
 * Analyzer Runtime 설정
 */
export interface AnalyzerRuntimeConfig {
  storage: Storage;
  llmProvider: LLMProvider;
  sessionId: string;
  rootDir: string;
  outputDir: string;
  config?: Partial<AnalyzerConfig>;
}

/**
 * 스냅샷 변경 리스너
 */
export type AnalyzerSnapshotListener = (
  data: AnalyzerData,
  state: AnalyzerState,
  derived: AnalyzerDerived
) => void;

/**
 * 이벤트 핸들러 맵
 */
type EventHandlerMap = {
  [K in AnalyzerEventType]?: Set<(payload: Extract<AnalyzerEvent, { type: K }>['payload']) => void>;
};

/**
 * Analyzer Runtime
 */
export class AnalyzerRuntime {
  private data: AnalyzerData;
  private state: AnalyzerState;
  private effectHandlers: EffectHandlers;
  private listeners: Set<AnalyzerSnapshotListener> = new Set();
  private eventHandlers: EventHandlerMap = {};
  private sessionId: string;
  private storage: Storage;
  private rootDir: string;
  private startTime: number = 0;

  constructor(config: AnalyzerRuntimeConfig) {
    this.sessionId = config.sessionId;
    this.storage = config.storage;
    this.rootDir = config.rootDir;
    this.data = createInitialData(config.config);
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

  getData(): AnalyzerData {
    return this.data;
  }

  getState(): AnalyzerState {
    return this.state;
  }

  getDerived(): AnalyzerDerived {
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
   * 분석 실행
   */
  async run(): Promise<AnalyzerDerived> {
    this.startTime = Date.now();
    this.state = incrementAttempts(this.state);

    // 1. 파일 스캔
    const scanResult = await this.effectHandlers.scanFiles();
    if (!scanResult.success || !scanResult.data) {
      const error = scanResult.error ?? 'Unknown scan error';
      this.emit({ type: 'analyzer:error', payload: { error, fatal: true } });
      throw new Error(`Scan failed: ${error}`);
    }

    // 2. 파일 태스크 생성 및 큐에 추가
    const scannedFiles = scanResult.data.files;
    const fileTasks = createFileTasks(
      scannedFiles.map(path => ({
        path,
        relativePath: path.replace(this.rootDir, '').replace(/^\//, ''),
        extension: path.split('.').pop() ?? '',
        content: '', // 나중에 파싱할 때 읽음
        size: 0,
      })),
      this.rootDir
    );

    this.data = addToQueue(this.data, fileTasks);

    this.emit({
      type: 'analyzer:started',
      payload: { totalFiles: fileTasks.length },
    });

    // 3. 파일 분석 루프
    let processedCount = 0;
    const analyses: FileAnalysis[] = [];

    while (!isAnalysisComplete(this.data)) {
      const nextTask = getNextTask(this.data);
      if (!nextTask) break;

      this.data = setCurrentTask(this.data, nextTask);

      this.emit({
        type: 'analyzer:file:started',
        payload: { path: nextTask.path, index: processedCount },
      });

      try {
        const analysis = await this.analyzeFile(nextTask.path);
        if (analysis) {
          const result = completeTask(this.data, this.state, nextTask.path, analysis);
          this.data = result.data;
          this.state = result.state;
          analyses.push(analysis);

          // 패턴 중 HITL 필요한 것 확인
          for (const pattern of analysis.patterns) {
            if (needsHITL(pattern, this.data.config.confidenceThreshold)) {
              const ambiguous: AmbiguousPattern = {
                id: `ambig-${nextTask.path}-${pattern.name}-${Date.now()}`,
                filePath: nextTask.path,
                pattern,
                reason: pattern.needsReview
                  ? 'Pattern marked for review'
                  : `Low confidence: ${pattern.confidence.toFixed(2)}`,
                suggestedResolutions: [],
              };
              this.state = addAmbiguousPattern(this.state, ambiguous);
              this.emit({ type: 'analyzer:ambiguous', payload: ambiguous });
            }
          }

          this.emit({
            type: 'analyzer:file:completed',
            payload: {
              path: nextTask.path,
              patterns: analysis.patterns.length,
              confidence: analysis.confidence,
            },
          });
        } else {
          // 분석 실패
          const result = failTask(this.data, this.state, nextTask.path, 'Analysis returned null');
          this.data = result.data;
          this.state = result.state;

          this.emit({
            type: 'analyzer:file:failed',
            payload: { path: nextTask.path, error: 'Analysis returned null' },
          });
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const result = failTask(this.data, this.state, nextTask.path, errorMsg);
        this.data = result.data;
        this.state = result.state;

        this.emit({
          type: 'analyzer:file:failed',
          payload: { path: nextTask.path, error: errorMsg },
        });
      }

      processedCount++;

      // 진행 상황 업데이트
      this.state = setLastProcessedFile(this.state, nextTask.path);
      const elapsed = (Date.now() - this.startTime) / 1000;
      this.state = updateProcessingRate(this.state, processedCount, elapsed);

      const derived = this.getDerived();
      this.emit({
        type: 'analyzer:progress',
        payload: {
          completed: derived.filesProcessed,
          total: derived.filesTotal,
          confidence: derived.overallConfidence,
        },
      });

      // 리스너 알림
      this.notifyListeners();

      // 주기적으로 스냅샷 저장
      if (processedCount % 10 === 0) {
        await this.persistSnapshot();
      }
    }

    // 4. 의존성 그래프 구축
    if (analyses.length > 0) {
      const graph = buildDependencyGraph(analyses);
      this.state = setDependencyGraph(this.state, graph);
    }

    // 5. 도메인 후보 추출
    if (analyses.length > 0) {
      const candidates = extractDomainCandidates(
        this.state.patterns,
        analyses,
        this.state.dependencyGraph
      );

      this.data = addDomainCandidates(this.data, candidates);

      // 각 도메인 후보에 대해 이벤트 발생
      for (const candidate of candidates) {
        this.emit({
          type: 'analyzer:domain:discovered',
          payload: candidate,
        });
      }
    }

    // 6. 추가 애매한 패턴 감지
    if (analyses.length > 0) {
      const candidates = Object.values(this.data.domainCandidates);
      const newAmbiguous = detectAmbiguousPatterns(
        analyses,
        candidates,
        this.data.config.confidenceThreshold
      );

      for (const ambiguous of newAmbiguous) {
        if (!this.state.ambiguous.some(a => a.id === ambiguous.id)) {
          this.state = addAmbiguousPattern(this.state, ambiguous);
          this.emit({ type: 'analyzer:ambiguous', payload: ambiguous });
        }
      }
    }

    // 7. 최종 스냅샷 저장
    await this.persistSnapshot();

    const finalDerived = this.getDerived();
    this.emit({ type: 'analyzer:done', payload: finalDerived });
    this.notifyListeners();

    return finalDerived;
  }

  /**
   * 단일 파일 분석
   */
  private async analyzeFile(path: string): Promise<FileAnalysis | null> {
    const result = await this.effectHandlers.analyzeFile(path);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 파일 건너뛰기
   */
  async skip(path: string, reason: string): Promise<void> {
    this.data = skipTask(this.data, path, reason);
    await this.persistSnapshot();
    this.notifyListeners();
  }

  // ============================================================
  // Event Emission
  // ============================================================

  /**
   * 이벤트 발생
   */
  private emit(event: AnalyzerEvent): void {
    const handlers = this.eventHandlers[event.type as AnalyzerEventType];
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
  on<K extends AnalyzerEventType>(
    type: K,
    handler: (payload: Extract<AnalyzerEvent, { type: K }>['payload']) => void
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
    await this.effectHandlers.saveSnapshot('analyzer', this.data, this.state);
  }

  /**
   * 스냅샷 복원
   */
  async restore(): Promise<boolean> {
    const result = await this.effectHandlers.loadSnapshot<AnalyzerData, AnalyzerState>('analyzer');
    if (result.success && result.data) {
      this.data = result.data.data;
      this.state = result.data.state;

      // in_progress 상태의 태스크를 pending으로 리셋
      this.data = {
        ...this.data,
        queue: this.data.queue.map(t =>
          t.status === 'in_progress' ? { ...t, status: 'pending' as const } : t
        ),
        current: null,
      };

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
  subscribe(listener: AnalyzerSnapshotListener): () => void {
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
 * Analyzer Runtime 생성
 */
export function createAnalyzerRuntime(
  config: AnalyzerRuntimeConfig
): AnalyzerRuntime {
  return new AnalyzerRuntime(config);
}
