/**
 * Transformer Domain Types
 *
 * Summarizer가 생성한 스키마 제안을 실제 Manifesto 도메인 파일로 변환합니다.
 */

import type { SchemaProposal, DomainSummary } from '../summarizer/types.js';

// ============================================================
// Schema & Output Types
// ============================================================

/**
 * Manifesto 도메인 JSON 스키마 (최종 출력물)
 */
export interface ManifestoDomainJson {
  $schema: string;
  domain: string;
  version: string;
  entities: Record<string, ManifestoEntity>;
  state: Record<string, ManifestoStateField>;
  intents: Record<string, ManifestoIntent>;
  metadata: ManifestoDomainMetadata;
}

/**
 * Manifesto 엔티티
 */
export interface ManifestoEntity {
  type: 'object' | 'enum' | 'union';
  description?: string;
  fields?: Record<string, ManifestoField>;
  values?: string[]; // for enum
  variants?: ManifestoEntity[]; // for union
}

/**
 * Manifesto 필드
 */
export interface ManifestoField {
  type: string;
  description?: string;
  optional?: boolean;
  default?: unknown;
}

/**
 * Manifesto 상태 필드
 */
export interface ManifestoStateField {
  type: string;
  description?: string;
  initial?: unknown;
  derived?: string; // 표현식
}

/**
 * Manifesto 인텐트 (액션)
 */
export interface ManifestoIntent {
  type: 'command' | 'query' | 'event';
  description?: string;
  input?: Record<string, ManifestoField>;
  output?: Record<string, ManifestoField>;
  effects?: string[];
}

/**
 * 도메인 메타데이터
 */
export interface ManifestoDomainMetadata {
  generatedAt: number;
  generatedBy: string;
  sourceFiles: string[];
  confidence: number;
  reviewedBy?: string;
  reviewedAt?: number;
}

// ============================================================
// Transformation Types
// ============================================================

/**
 * 변환 태스크 상태
 */
export type TransformationStatus =
  | 'pending'
  | 'in_progress'
  | 'validating'
  | 'review'
  | 'writing'
  | 'done'
  | 'failed';

/**
 * 변환 태스크
 */
export interface TransformationTask {
  id: string;
  domainId: string;
  domainName: string;
  status: TransformationStatus;
  proposal: SchemaProposal;
  generatedSchema: ManifestoDomainJson | null;
  validation: ValidationResult | null;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * 검증 결과
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * 검증 에러
 */
export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error';
}

/**
 * 검증 경고
 */
export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  severity: 'warning';
}

// ============================================================
// Source Mapping
// ============================================================

/**
 * 소스 매핑 (React 코드 -> Manifesto 스키마)
 */
export interface SourceMapping {
  sourcePath: string;
  sourceLocation: { line: number; column: number };
  targetPath: string; // e.g., "user.entities.Profile.name"
  confidence: number;
  patternType: string;
}

/**
 * 도메인 파일 출력
 */
export interface DomainFile {
  id: string;
  name: string;
  path: string;
  content: ManifestoDomainJson;
  sourceMappings: SourceMapping[];
  writtenAt: number | null;
}

// ============================================================
// Rollback
// ============================================================

/**
 * 롤백 포인트
 */
export interface RollbackPoint {
  id: string;
  timestamp: number;
  description: string;
  files: Array<{
    path: string;
    content: string | null; // null means file didn't exist
  }>;
}

// ============================================================
// Transformer Data & State
// ============================================================

/**
 * Transformer 설정
 */
export interface TransformerConfig {
  outputDir: string;
  schemaVersion: string;
  includeSourceMappings: boolean;
  validateBeforeWrite: boolean;
  createBackup: boolean;
}

/**
 * Transformer 데이터 (영속화되는 비즈니스 데이터)
 */
export interface TransformerData {
  summarizerRef: string;
  tasks: Record<string, TransformationTask>;
  domainFiles: Record<string, DomainFile>;
  config: TransformerConfig;
}

/**
 * Transformer 상태 (세션 중 변하는 런타임 상태)
 */
export interface TransformerState {
  currentTask: string | null;
  rollbackPoints: RollbackPoint[];
  currentRollbackPoint: string | null;
  validationCache: Record<string, ValidationResult>;
  meta: {
    attempts: number;
    llmCallCount: number;
    filesWritten: number;
    lastWrittenFile: string | null;
    processingRate: number;
    errors: TransformerError[];
  };
}

/**
 * Transformer 에러
 */
export interface TransformerError {
  taskId?: string;
  error: string;
  timestamp: number;
}

/**
 * Transformer Derived (계산된 값들)
 */
export interface TransformerDerived {
  tasksTotal: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksNeedingReview: number;
  filesGenerated: number;
  filesWritten: number;
  overallProgress: number;
  estimatedTimeRemaining: number;
}

/**
 * Transformer 스냅샷
 */
export interface TransformerSnapshot {
  data: TransformerData;
  state: TransformerState;
  derived: TransformerDerived;
}

// ============================================================
// Events
// ============================================================

/**
 * Transformer 이벤트 타입
 */
export type TransformerEventType =
  | 'transformer:started'
  | 'transformer:task:started'
  | 'transformer:task:completed'
  | 'transformer:task:failed'
  | 'transformer:schema:generated'
  | 'transformer:validation:started'
  | 'transformer:validation:completed'
  | 'transformer:file:writing'
  | 'transformer:file:written'
  | 'transformer:rollback:created'
  | 'transformer:rollback:restored'
  | 'transformer:hitl:needed'
  | 'transformer:progress'
  | 'transformer:error'
  | 'transformer:done';

/**
 * Transformer 이벤트
 */
export type TransformerEvent =
  | { type: 'transformer:started'; payload: { totalTasks: number } }
  | { type: 'transformer:task:started'; payload: { taskId: string; domainName: string } }
  | { type: 'transformer:task:completed'; payload: { taskId: string; domainName: string } }
  | { type: 'transformer:task:failed'; payload: { taskId: string; error: string } }
  | { type: 'transformer:schema:generated'; payload: { taskId: string; schema: ManifestoDomainJson } }
  | { type: 'transformer:validation:started'; payload: { taskId: string } }
  | { type: 'transformer:validation:completed'; payload: { taskId: string; result: ValidationResult } }
  | { type: 'transformer:file:writing'; payload: { path: string } }
  | { type: 'transformer:file:written'; payload: { path: string; size: number } }
  | { type: 'transformer:rollback:created'; payload: { rollbackId: string } }
  | { type: 'transformer:rollback:restored'; payload: { rollbackId: string } }
  | { type: 'transformer:hitl:needed'; payload: { type: string; taskId: string; [key: string]: unknown } }
  | { type: 'transformer:progress'; payload: { completed: number; total: number; phase: string } }
  | { type: 'transformer:error'; payload: { error: string; fatal: boolean } }
  | { type: 'transformer:done'; payload: TransformerDerived };

/**
 * 이벤트 리스너
 */
export type TransformerEventListener<T extends TransformerEventType> = (
  payload: Extract<TransformerEvent, { type: T }>['payload']
) => void;

/**
 * 이벤트 에미터
 */
export interface TransformerEventEmitter {
  on<T extends TransformerEventType>(type: T, listener: TransformerEventListener<T>): () => void;
  emit(event: TransformerEvent): void;
}

// ============================================================
// Inputs (Action Parameters)
// ============================================================

/**
 * 변환 태스크 생성 입력
 */
export interface CreateTaskInput {
  domainId: string;
  domainName: string;
  proposal: SchemaProposal;
  summary: DomainSummary;
}

/**
 * 스키마 생성 입력
 */
export interface GenerateSchemaInput {
  taskId: string;
}

/**
 * 파일 쓰기 입력
 */
export interface WriteFileInput {
  taskId: string;
  overwrite?: boolean;
}

/**
 * 롤백 입력
 */
export interface RollbackInput {
  rollbackPointId: string;
}
