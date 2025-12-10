/**
 * Analyzer Domain
 *
 * React 파일을 분석하여 패턴을 감지하고 도메인 후보를 추출합니다.
 */

// Types
export type {
  FileTask,
  FileTaskStatus,
  DomainCandidate,
  DomainSuggestedBy,
  DomainRelationship,
  AmbiguousPattern,
  SuggestedResolution,
  ResolutionAction,
  AnalysisError,
  ImportEdge,
  DependencyGraph,
  AnalyzerConfig,
  AnalyzerData,
  AnalyzerState,
  PatternCollection,
  AnalyzerDerived,
  AnalyzerSnapshot,
  AnalyzerEvent,
  AnalyzerEventType,
  AnalyzerEventListener,
  AnalyzerEventEmitter,
  AnalyzeFileInput,
  AnalyzeBatchInput,
  MarkAmbiguousInput,
  SkipFileInput,
  ResolveAmbiguousInput,
} from './types.js';

// Schemas
export {
  FileTaskSchema,
  FileTaskStatusSchema,
  DomainCandidateSchema,
  DomainSuggestedBySchema,
  DomainRelationshipSchema,
  AmbiguousPatternSchema,
  SuggestedResolutionSchema,
  ResolutionActionSchema,
  AnalysisErrorSchema,
  ImportEdgeSchema,
  DependencyGraphSchema,
  AnalyzerConfigSchema,
  AnalyzerDataSchema,
  AnalyzerStateSchema,
  PatternCollectionSchema,
  AnalyzerDerivedSchema,
  AnalyzerSnapshotSchema,
  AnalyzeFileInputSchema,
  AnalyzeBatchInputSchema,
  MarkAmbiguousInputSchema,
  SkipFileInputSchema,
  ResolveAmbiguousInputSchema,
} from './schema.js';

// Domain Logic (Pure Functions)
export {
  // Initial State
  DEFAULT_CONFIG,
  createInitialData,
  createInitialState,
  // Queue Management
  addToQueue,
  getNextTask,
  setCurrentTask,
  updateTaskStatus,
  // Results
  addResult,
  completeTask,
  failTask,
  skipTask,
  // Pattern Aggregation
  aggregatePatterns,
  // Domain Candidates
  addDomainCandidate,
  updateDomainCandidate,
  addDomainCandidates,
  // Ambiguous Patterns
  addAmbiguousPattern,
  createAmbiguousPattern,
  resolveAmbiguousPattern,
  getUnresolvedAmbiguous,
  // Dependency Graph
  setDependencyGraph,
  // Meta
  updateMeta,
  incrementAttempts,
  setLastProcessedFile,
  updateProcessingRate,
  addError,
  // Derived
  calculateDerived,
  // Snapshot
  createSnapshot,
  // Utilities
  isAnalysisComplete,
  needsHITL,
  generateId,
} from './analyzer.js';

// Algorithms - Priority
export {
  calculatePriority,
  analyzePriorityFactors,
  createFileTask,
  createFileTasks,
  isEntryPoint,
  isFeatureDirectory,
  inferDomainFromPath,
} from './algorithms/priority.js';

// Algorithms - Dependency Graph
export {
  buildDependencyGraph,
  analyzeGraph,
  findCycles,
  findConnectedComponents,
  findAllDependencies,
  findAllDependents,
  analyzeContextSharing,
  calculateRelationshipStrength,
  resolveImportPath,
} from './algorithms/dependency-graph.js';

// Algorithms - Domain Extractor
export {
  extractDomainCandidates,
  extractContextBasedCandidates,
  extractReducerBasedCandidates,
  extractHookBasedCandidates,
  extractFileStructureCandidates,
  mergeCandidates,
  calculateRelationships,
  detectAmbiguousPatterns,
  inferDomainName,
  normalizeDomainName,
  generateDomainDescription,
} from './algorithms/domain-extractor.js';
