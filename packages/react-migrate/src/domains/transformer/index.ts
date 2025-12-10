/**
 * Transformer Domain
 *
 * Summarizer가 생성한 스키마 제안을 실제 Manifesto 도메인 파일로 변환합니다.
 */

// Types
export type {
  ManifestoDomainJson,
  ManifestoEntity,
  ManifestoField,
  ManifestoStateField,
  ManifestoIntent,
  ManifestoDomainMetadata,
  TransformationStatus,
  TransformationTask,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  SourceMapping,
  DomainFile,
  RollbackPoint,
  TransformerConfig,
  TransformerData,
  TransformerState,
  TransformerError,
  TransformerDerived,
  TransformerSnapshot,
  TransformerEventType,
  TransformerEvent,
  TransformerEventListener,
  TransformerEventEmitter,
  CreateTaskInput,
  GenerateSchemaInput,
  WriteFileInput,
  RollbackInput,
} from './types.js';

// Schemas
export {
  ManifestoFieldSchema,
  ManifestoEntitySchema,
  ManifestoStateFieldSchema,
  ManifestoIntentSchema,
  ManifestoDomainMetadataSchema,
  ManifestoDomainJsonSchema,
  TransformationStatusSchema,
  ValidationErrorSchema,
  ValidationWarningSchema,
  ValidationResultSchema,
  TransformationTaskSchema,
  SourceMappingSchema,
  DomainFileSchema,
  RollbackPointSchema,
  TransformerConfigSchema,
  TransformerDataSchema,
  TransformerErrorSchema,
  TransformerStateSchema,
  TransformerDerivedSchema,
  TransformerSnapshotSchema,
  CreateTaskInputSchema,
  GenerateSchemaInputSchema,
  WriteFileInputSchema,
  RollbackInputSchema,
} from './schema.js';

// Domain Logic (Pure Functions)
export {
  // Config
  DEFAULT_TRANSFORMER_CONFIG,
  // Initial State
  createInitialData,
  createInitialState,
  // Task Management
  createTask,
  addTask,
  updateTaskStatus,
  setTaskSchema,
  setTaskValidation,
  setCurrentTask,
  getNextTask,
  getTasksByStatus,
  // Domain File Management
  createDomainFile,
  addDomainFile,
  markFileWritten,
  // Rollback Management
  createRollbackPoint,
  addRollbackPoint,
  getRollbackPoint,
  cleanupRollbackPoints,
  // Validation Cache
  cacheValidation,
  getCachedValidation,
  // Meta Updates
  incrementAttempts,
  incrementLLMCalls,
  recordFileWritten,
  updateProcessingRate,
  addError,
  // Derived
  calculateDerived,
  // Snapshot
  createSnapshot,
  // Utilities
  isTransformationComplete,
  allTasksSucceeded,
  hasTasksNeedingReview,
  generateId,
} from './transformer.js';

// Algorithms
export {
  // Schema Generator
  type SchemaGeneratorConfig,
  generateManifestoSchema,
  validateGeneratedSchema,
  serializeSchema,
  createEmptySchema,
} from './algorithms/schema-generator.js';

export {
  // Source Mapper
  type MappingStats,
  createSourceMappings,
  createReverseIndex,
  groupMappingsByFile,
  groupMappingsByPatternType,
  calculateMappingStats,
  formatMapping,
  renderMappingsAsMarkdown,
  validateMappings,
} from './algorithms/source-mapper.js';

export {
  // File Writer
  type WriteResult,
  type BackupResult,
  type OutputStructure,
  type DomainFileInfo,
  type MetaFileInfo,
  type MigrationLog,
  type SourceMappingFile,
  type WritePlan,
  createOutputStructure,
  serializeMigrationLog,
  serializeSourceMappings,
  getOutputFilePaths,
  createRestoreCommands,
  createWritePlan,
  summarizeWritePlan,
  calculateTotalSize,
} from './algorithms/file-writer.js';
