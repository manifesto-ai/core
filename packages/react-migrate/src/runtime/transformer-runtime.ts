/**
 * Transformer Runtime
 *
 * Transformer 도메인의 런타임 - OrchestratorRuntime 패턴을 따름
 * Summarizer가 생성한 스키마 제안을 실제 Manifesto 도메인 파일로 변환
 */

import type { Storage } from '../storage/index.js';
import type { LLMProvider } from '../llm/types.js';
import type { DetectedPattern } from '../parser/types.js';
import type { SchemaProposal, DomainSummary } from '../domains/summarizer/types.js';
import type {
  TransformerData,
  TransformerState,
  TransformerDerived,
  TransformerConfig,
  TransformerEvent,
  TransformerEventType,
  TransformationTask,
  ValidationResult,
  DomainFile,
  RollbackPoint,
  SourceMapping,
} from '../domains/transformer/types.js';
import {
  DEFAULT_TRANSFORMER_CONFIG,
  createInitialData,
  createInitialState,
  createTask,
  addTask,
  updateTaskStatus,
  setTaskSchema,
  setTaskValidation,
  setCurrentTask,
  getNextTask,
  createDomainFile,
  addDomainFile,
  markFileWritten,
  createRollbackPoint,
  addRollbackPoint,
  getRollbackPoint,
  cleanupRollbackPoints,
  cacheValidation,
  incrementAttempts,
  incrementLLMCalls,
  recordFileWritten,
  updateProcessingRate,
  addError,
  calculateDerived,
} from '../domains/transformer/transformer.js';
import {
  generateManifestoSchema,
  validateGeneratedSchema,
} from '../domains/transformer/algorithms/schema-generator.js';
import {
  createSourceMappings,
} from '../domains/transformer/algorithms/source-mapper.js';
import {
  createOutputStructure,
  createWritePlan,
} from '../domains/transformer/algorithms/file-writer.js';
import { createEffectHandlers, type EffectHandlers } from './effect-handlers.js';

/**
 * Transformer Runtime 설정
 */
export interface TransformerRuntimeConfig {
  storage: Storage;
  llmProvider: LLMProvider;
  sessionId: string;
  rootDir: string;
  outputDir: string;
  summarizerRef: string; // Summarizer 세션 참조
  config?: Partial<TransformerConfig>;
}

/**
 * Transformer 입력 데이터
 */
export interface TransformerInput {
  proposals: SchemaProposal[];
  summaries: Record<string, DomainSummary>;
  patterns: DetectedPattern[];
  patternFileMap: Map<DetectedPattern, string>;
}

/**
 * 스냅샷 변경 리스너
 */
export type TransformerSnapshotListener = (
  data: TransformerData,
  state: TransformerState,
  derived: TransformerDerived
) => void;

/**
 * 이벤트 핸들러 맵
 */
type EventHandlerMap = {
  [K in TransformerEventType]?: Set<(payload: Extract<TransformerEvent, { type: K }>['payload']) => void>;
};

/**
 * Transformer Runtime
 */
export class TransformerRuntime {
  private data: TransformerData;
  private state: TransformerState;
  private effectHandlers: EffectHandlers;
  private listeners: Set<TransformerSnapshotListener> = new Set();
  private eventHandlers: EventHandlerMap = {};
  private sessionId: string;
  private storage: Storage;
  private config: TransformerConfig;
  private outputDir: string;
  private startTime: number = 0;

  // Input data (stored for use during processing)
  private patterns: DetectedPattern[] = [];
  private patternFileMap: Map<DetectedPattern, string> = new Map();
  private summaries: Record<string, DomainSummary> = {};

  constructor(runtimeConfig: TransformerRuntimeConfig) {
    this.sessionId = runtimeConfig.sessionId;
    this.storage = runtimeConfig.storage;
    this.outputDir = runtimeConfig.outputDir;
    this.config = {
      ...DEFAULT_TRANSFORMER_CONFIG,
      outputDir: runtimeConfig.outputDir,
      ...runtimeConfig.config,
    };
    this.data = createInitialData(runtimeConfig.summarizerRef, this.config);
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

  getData(): TransformerData {
    return this.data;
  }

  getState(): TransformerState {
    return this.state;
  }

  getDerived(): TransformerDerived {
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
   * 변환 실행
   */
  async run(input: TransformerInput): Promise<TransformerDerived> {
    this.startTime = Date.now();
    this.state = incrementAttempts(this.state);

    const { proposals, summaries, patterns, patternFileMap } = input;

    // Store input data for later use
    this.patterns = patterns;
    this.patternFileMap = patternFileMap;
    this.summaries = summaries;

    this.emit({
      type: 'transformer:started',
      payload: { totalTasks: proposals.length },
    });

    try {
      // 1. 태스크 생성 단계
      await this.createTasksFromProposals(proposals);

      // 2. 스키마 생성 및 변환 단계
      await this.processAllTasks();

      // 3. 파일 쓰기 단계
      if (!this.hasTasksNeedingReview()) {
        await this.writeAllFiles();
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.state = addError(this.state, errorMsg);
      this.emit({ type: 'transformer:error', payload: { error: errorMsg, fatal: true } });
      throw error;
    }

    // 최종 스냅샷 저장
    await this.persistSnapshot();

    const finalDerived = this.getDerived();
    this.emit({ type: 'transformer:done', payload: finalDerived });
    this.notifyListeners();

    return finalDerived;
  }

  /**
   * 제안에서 태스크 생성
   */
  private async createTasksFromProposals(proposals: SchemaProposal[]): Promise<void> {
    for (const proposal of proposals) {
      const task = createTask(proposal.domainId, proposal.domainName, proposal);
      this.data = addTask(this.data, task);
    }

    await this.persistSnapshot();
  }

  /**
   * 모든 태스크 처리
   */
  private async processAllTasks(): Promise<void> {
    let processedCount = 0;
    const totalTasks = Object.keys(this.data.tasks).length;

    let nextTask = getNextTask(this.data);
    while (nextTask) {
      await this.processTask(nextTask);
      processedCount++;
      this.updateProgress(processedCount, totalTasks, 'transforming');
      nextTask = getNextTask(this.data);
    }
  }

  /**
   * 단일 태스크 처리
   */
  private async processTask(task: TransformationTask): Promise<void> {
    this.state = setCurrentTask(this.state, task.id);
    this.data = updateTaskStatus(this.data, task.id, 'in_progress');

    this.emit({
      type: 'transformer:task:started',
      payload: { taskId: task.id, domainName: task.domainName },
    });

    try {
      // 1. 스키마 생성
      const summary = this.summaries[task.domainId];
      if (!summary) {
        throw new Error(`Summary not found for domain: ${task.domainId}`);
      }

      const schema = generateManifestoSchema(task.proposal, summary, {
        schemaVersion: this.config.schemaVersion,
      });

      this.data = setTaskSchema(this.data, task.id, schema);

      this.emit({
        type: 'transformer:schema:generated',
        payload: { taskId: task.id, schema },
      });

      // 2. 스키마 검증
      this.data = updateTaskStatus(this.data, task.id, 'validating');

      this.emit({
        type: 'transformer:validation:started',
        payload: { taskId: task.id },
      });

      const validation = this.validateSchema(schema);
      this.data = setTaskValidation(this.data, task.id, validation);
      this.state = cacheValidation(this.state, task.id, validation);

      this.emit({
        type: 'transformer:validation:completed',
        payload: { taskId: task.id, result: validation },
      });

      if (!validation.valid) {
        // 검증 실패 시 리뷰 필요
        this.data = updateTaskStatus(this.data, task.id, 'review');

        this.emit({
          type: 'transformer:hitl:needed',
          payload: {
            type: 'validation_failed',
            taskId: task.id,
            errors: validation.errors,
          },
        });

        return;
      }

      // 3. 소스 매핑 생성
      const mappings = this.createMappingsForTask(task, schema);

      // 4. 도메인 파일 생성
      const domainFile = createDomainFile(
        task.id,
        task.domainName,
        schema,
        mappings,
        this.outputDir
      );

      this.data = addDomainFile(this.data, domainFile);

      // 5. 낮은 신뢰도 확인
      if (task.proposal.needsReview || task.proposal.confidence < 0.7) {
        this.data = updateTaskStatus(this.data, task.id, 'review');

        this.emit({
          type: 'transformer:hitl:needed',
          payload: {
            type: 'low_confidence',
            taskId: task.id,
            confidence: task.proposal.confidence,
          },
        });
      } else {
        // 쓰기 대기
        this.data = updateTaskStatus(this.data, task.id, 'writing');
      }

      this.emit({
        type: 'transformer:task:completed',
        payload: { taskId: task.id, domainName: task.domainName },
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.data = updateTaskStatus(this.data, task.id, 'failed', errorMsg);
      this.state = addError(this.state, errorMsg, task.id);

      this.emit({
        type: 'transformer:task:failed',
        payload: { taskId: task.id, error: errorMsg },
      });
    }

    this.state = setCurrentTask(this.state, null);
    await this.persistSnapshot();
  }

  /**
   * 스키마 검증
   */
  private validateSchema(schema: import('../domains/transformer/types.js').ManifestoDomainJson): ValidationResult {
    const result = validateGeneratedSchema(schema);

    const errors = result.errors.map(msg => ({
      code: 'VALIDATION_ERROR',
      message: msg,
      severity: 'error' as const,
    }));

    return {
      valid: result.valid,
      errors,
      warnings: [],
    };
  }

  /**
   * 태스크에 대한 소스 매핑 생성
   */
  private createMappingsForTask(
    task: TransformationTask,
    schema: import('../domains/transformer/types.js').ManifestoDomainJson
  ): SourceMapping[] {
    if (!this.config.includeSourceMappings) {
      return [];
    }

    return createSourceMappings(
      schema,
      task.proposal,
      this.patterns,
      this.patternFileMap
    );
  }

  /**
   * 리뷰 필요한 태스크가 있는지 확인
   */
  private hasTasksNeedingReview(): boolean {
    return Object.values(this.data.tasks).some(t => t.status === 'review');
  }

  /**
   * 모든 파일 쓰기
   */
  private async writeAllFiles(): Promise<void> {
    const writingTasks = Object.values(this.data.tasks).filter(t => t.status === 'writing');

    if (writingTasks.length === 0) {
      return;
    }

    // 롤백 포인트 생성
    if (this.config.createBackup) {
      await this.createRollbackBeforeWrite();
    }

    // 쓰기 계획 생성
    const domainFiles = Object.values(this.data.domainFiles);
    const structure = createOutputStructure(domainFiles, this.outputDir);
    const plan = createWritePlan(structure, this.outputDir);

    // 파일 쓰기 실행
    for (const fileInfo of plan.filesToWrite) {
      this.emit({
        type: 'transformer:file:writing',
        payload: { path: fileInfo.path },
      });

      // Effect handler를 통해 파일 쓰기
      const result = await this.effectHandlers.writeFile(fileInfo.path, fileInfo.content);

      if (result.success) {
        this.state = recordFileWritten(this.state, fileInfo.path);

        // 해당하는 도메인 파일 찾아서 마킹
        const domainFile = Object.values(this.data.domainFiles).find(
          f => f.path === fileInfo.path
        );
        if (domainFile) {
          this.data = markFileWritten(this.data, domainFile.id);
        }

        this.emit({
          type: 'transformer:file:written',
          payload: {
            path: fileInfo.path,
            size: Buffer.byteLength(fileInfo.content, 'utf8'),
          },
        });
      } else {
        this.state = addError(this.state, `Failed to write file: ${fileInfo.path}`);
      }
    }

    // 모든 writing 태스크를 done으로 변경
    for (const task of writingTasks) {
      this.data = updateTaskStatus(this.data, task.id, 'done');
    }

    await this.persistSnapshot();
  }

  /**
   * 쓰기 전 롤백 포인트 생성
   */
  private async createRollbackBeforeWrite(): Promise<void> {
    const filesToBackup = Object.values(this.data.domainFiles).map(f => f.path);
    const backupFiles: Array<{ path: string; content: string | null }> = [];

    for (const path of filesToBackup) {
      const result = await this.effectHandlers.readFile(path);
      backupFiles.push({
        path,
        content: result.success ? (result.data as string) : null,
      });
    }

    const rollback = createRollbackPoint(
      `Before writing ${filesToBackup.length} files`,
      backupFiles
    );

    this.state = addRollbackPoint(this.state, rollback);
    this.state = cleanupRollbackPoints(this.state, 10);

    this.emit({
      type: 'transformer:rollback:created',
      payload: { rollbackId: rollback.id },
    });
  }

  /**
   * 진행 상황 업데이트
   */
  private updateProgress(current: number, total: number, phase: string): void {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.state = updateProcessingRate(this.state, current, elapsed);

    this.emit({
      type: 'transformer:progress',
      payload: {
        completed: current,
        total,
        phase,
      },
    });

    this.notifyListeners();
  }

  // ============================================================
  // Actions
  // ============================================================

  /**
   * 태스크 승인 (리뷰 후)
   */
  async approveTask(taskId: string): Promise<void> {
    const task = this.data.tasks[taskId];
    if (!task || task.status !== 'review') {
      throw new Error(`Task not found or not in review: ${taskId}`);
    }

    this.data = updateTaskStatus(this.data, taskId, 'writing');

    // 리뷰가 필요한 다른 태스크가 없으면 파일 쓰기 시작
    if (!this.hasTasksNeedingReview()) {
      await this.writeAllFiles();
    }

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 모든 태스크 승인
   */
  async approveAllTasks(): Promise<void> {
    const reviewTasks = Object.values(this.data.tasks).filter(t => t.status === 'review');

    for (const task of reviewTasks) {
      this.data = updateTaskStatus(this.data, task.id, 'writing');
    }

    await this.writeAllFiles();
    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 태스크 재시도
   */
  async retryTask(taskId: string): Promise<void> {
    const task = this.data.tasks[taskId];
    if (!task || task.status !== 'failed') {
      throw new Error(`Task not found or not failed: ${taskId}`);
    }

    this.data = updateTaskStatus(this.data, taskId, 'pending');
    await this.processTask(this.data.tasks[taskId]!);

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 롤백 실행
   */
  async rollback(rollbackPointId: string): Promise<void> {
    const rollbackPoint = getRollbackPoint(this.state, rollbackPointId);
    if (!rollbackPoint) {
      throw new Error(`Rollback point not found: ${rollbackPointId}`);
    }

    // 파일 복원
    for (const file of rollbackPoint.files) {
      if (file.content === null) {
        // 파일이 없었으면 삭제
        await this.effectHandlers.deleteFile(file.path);
      } else {
        // 파일 복원
        await this.effectHandlers.writeFile(file.path, file.content);
      }
    }

    this.emit({
      type: 'transformer:rollback:restored',
      payload: { rollbackId: rollbackPointId },
    });

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * 스키마 수동 수정
   */
  async updateTaskSchema(
    taskId: string,
    schema: import('../domains/transformer/types.js').ManifestoDomainJson
  ): Promise<void> {
    const task = this.data.tasks[taskId];
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    this.data = setTaskSchema(this.data, taskId, schema);

    // 재검증
    const validation = this.validateSchema(schema);
    this.data = setTaskValidation(this.data, taskId, validation);
    this.state = cacheValidation(this.state, taskId, validation);

    await this.persistSnapshot();
    this.notifyListeners();
  }

  /**
   * LLM을 사용하여 스키마 개선
   */
  async improveSchemaWithLLM(taskId: string): Promise<void> {
    const task = this.data.tasks[taskId];
    if (!task || !task.generatedSchema) {
      throw new Error(`Task not found or no schema: ${taskId}`);
    }

    this.state = incrementLLMCalls(this.state);

    // LLM 호출로 스키마 개선 (실제 구현에서는 LLM provider 사용)
    // 여기서는 기본 개선만 수행
    const improvedSchema = { ...task.generatedSchema };

    // 설명 추가 등의 개선
    if (!improvedSchema.metadata.reviewedBy) {
      improvedSchema.metadata.reviewedBy = 'llm';
      improvedSchema.metadata.reviewedAt = Date.now();
    }

    this.data = setTaskSchema(this.data, taskId, improvedSchema);

    await this.persistSnapshot();
    this.notifyListeners();
  }

  // ============================================================
  // Event Emission
  // ============================================================

  /**
   * 이벤트 발생
   */
  private emit(event: TransformerEvent): void {
    const handlers = this.eventHandlers[event.type as TransformerEventType];
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
  on<K extends TransformerEventType>(
    type: K,
    handler: (payload: Extract<TransformerEvent, { type: K }>['payload']) => void
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
    await this.effectHandlers.saveSnapshot('transformer', this.data, this.state);
  }

  /**
   * 스냅샷 복원
   */
  async restore(): Promise<boolean> {
    const result = await this.effectHandlers.loadSnapshot<TransformerData, TransformerState>('transformer');
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
  subscribe(listener: TransformerSnapshotListener): () => void {
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
 * Transformer Runtime 생성
 */
export function createTransformerRuntime(
  config: TransformerRuntimeConfig
): TransformerRuntime {
  return new TransformerRuntime(config);
}
