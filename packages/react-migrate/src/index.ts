/**
 * @manifesto-ai/react-migrate
 *
 * Agent-powered React to Manifesto migration tool
 */

// Parser
export {
  // Types
  type PatternType,
  type SourceLocation,
  type PatternMetadata,
  type DetectedPattern,
  type ImportInfo,
  type ExportInfo,
  type AnalysisIssue,
  type FileAnalysis,
  type ParseOptions,
  type ParseError,
  type ParseResult,
  type ScannedFile,
  type ScanOptions,
  type BatchAnalysisResult,
  type PatternDetector,
  // Functions
  parseFile,
  parseBatch,
  isValidAST,
  findNodes,
  scanFiles,
  countFiles,
  isReactFile,
  inferFileType,
  analyzeFile,
  analyzeFiles,
  detectAllPatterns,
} from './parser/index.js';

// LLM
export {
  // Types
  type MessageRole,
  type LLMMessage,
  type LLMCompletionOptions,
  type TokenUsage,
  type FinishReason,
  type LLMCompletionResult,
  type LLMProviderType,
  type LLMProviderConfig,
  type LLMProvider,
  type MockResponse,
  type MockCallRecord,
  // Errors
  LLMError,
  RateLimitError,
  AuthenticationError,
  ModelNotFoundError,
  // Providers
  BaseLLMProvider,
  OpenAIProvider,
  AnthropicProvider,
  OllamaProvider,
  MockLLMProvider,
  // Functions
  createProvider,
  createMockProvider,
  loadProviderFromEnv,
  createDefaultProvider,
  // Prompts
  prompts,
} from './llm/index.js';

// Storage
export {
  // Types
  type SessionStatus,
  type EffectLogStatus,
  type DatabaseOptions,
  type CreateSessionInput,
  type UpdateSessionInput,
  type Session,
  type SnapshotInput,
  type StoredSnapshot,
  type EffectLogInput,
  type StoredEffectLog,
  type Storage,
  // Classes
  MigrationDatabase,
  SessionRepository,
  SnapshotRepository,
  EffectLogRepository,
  // Functions
  getDefaultDatabasePath,
  createDatabase,
  createStorage,
} from './storage/index.js';

// Domains - Orchestrator
export {
  // Types
  type MigrationPhase,
  type AgentStatus,
  type AgentRef,
  type HITLOption,
  type HITLRequest,
  type HITLHistoryEntry,
  type Progress,
  type DiscoveredDomain,
  type OrchestratorData,
  type OrchestratorState,
  type OrchestratorSnapshot,
  type ResolveHITLInput,
  type UpgradeModelInput,
  type StartAnalysisInput,
  // Schemas
  OrchestratorDataSchema,
  OrchestratorStateSchema,
  // Functions
  createInitialData,
  createInitialState,
  calculateConfidence,
  calculateCanProceed,
  calculateEstimatedTimeRemaining,
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
  // Child Domains (namespaced)
  analyzer,
  summarizer,
  transformer,
} from './domains/index.js';

// Runtime
export {
  // Types
  type EffectHandlerConfig,
  type EffectResult,
  type EffectHandlers,
  type OrchestratorRuntimeConfig,
  type SnapshotListener,
  type AnalyzerRuntimeConfig,
  type AnalyzerSnapshotListener,
  type SummarizerRuntimeConfig,
  type SummarizerInput,
  type SummarizerSnapshotListener,
  type TransformerRuntimeConfig,
  type TransformerInput,
  type TransformerSnapshotListener,
  // Classes
  OrchestratorRuntime,
  AnalyzerRuntime,
  SummarizerRuntime,
  TransformerRuntime,
  // Functions
  createEffectHandlers,
  createOrchestratorRuntime,
  createAnalyzerRuntime,
  createSummarizerRuntime,
  createTransformerRuntime,
} from './runtime/index.js';

// Utils
export {
  type CLIConfig,
  type CLIFlags,
  loadConfig,
  validateConfig,
  serializeConfig,
  deserializeConfig,
} from './utils/index.js';

// High-level API
export {
  type MigrateOptions,
  type MigrateResult,
  migrate,
} from './cli/run.js';
