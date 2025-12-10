/**
 * Summarizer Domain
 *
 * Analyzer가 추출한 도메인 후보들을 클러스터링하고,
 * 관계를 분석하여 Manifesto 스키마 제안을 생성합니다.
 */

// Types
export type {
  ExtractedEntity,
  ExtractedField,
  ExtractedAction,
  DomainBoundary,
  DomainSummary,
  RelationshipType,
  DomainRelationship,
  RelationshipsByType,
  DomainConflict,
  ConflictResolution,
  SchemaFieldProposal,
  SchemaProposal,
  SummarizerConfig,
  SummarizerData,
  ClusteringState,
  SummarizerState,
  SummarizerError,
  SummarizerDerived,
  SummarizerSnapshot,
  SummarizerEventType,
  SummarizerEvent,
  SummarizerEventListener,
  SummarizerEventEmitter,
  SummarizeDomainInput,
  AnalyzeRelationshipsInput,
  GenerateProposalInput,
  ResolveConflictInput,
} from './types.js';

// Schemas
export {
  ExtractedFieldSchema,
  ExtractedEntitySchema,
  ExtractedActionSchema,
  DomainBoundarySchema,
  DomainSummarySchema,
  RelationshipTypeSchema,
  DomainRelationshipSchema,
  ConflictResolutionSchema,
  DomainConflictSchema,
  SchemaFieldProposalSchema,
  SchemaProposalSchema,
  SummarizerConfigSchema,
  SummarizerDataSchema,
  ClusteringStateSchema,
  SummarizerErrorSchema,
  SummarizerStateSchema,
  SummarizerDerivedSchema,
  SummarizerSnapshotSchema,
  SummarizeDomainInputSchema,
  AnalyzeRelationshipsInputSchema,
  GenerateProposalInputSchema,
  ResolveConflictInputSchema,
} from './schema.js';

// Domain Logic (Pure Functions)
export {
  // Config
  DEFAULT_SUMMARIZER_CONFIG,
  // Initial State
  createInitialData,
  createInitialState,
  // Domain Management
  addDomain,
  updateDomain,
  removeDomain,
  createDomainSummary,
  // Relationship Management
  addRelationship,
  addRelationships,
  getRelationshipsForDomain,
  getRelationshipBetween,
  // Conflict Management
  addConflict,
  resolveConflict,
  getUnresolvedConflicts,
  createOwnershipConflict,
  createNamingConflict,
  // Schema Proposal Management
  addSchemaProposal,
  updateSchemaProposal,
  markProposalReviewed,
  // Clustering State Management
  setClusteringState,
  startClustering,
  completeClustering,
  // Ambiguous Pattern Management
  addAmbiguousPatterns,
  // Meta Updates
  incrementAttempts,
  incrementLLMCalls,
  setLastProcessedDomain,
  updateProcessingRate,
  addError,
  // Derived
  calculateDerived,
  // Snapshot
  createSnapshot,
  // Utilities
  isSummarizationComplete,
  needsReview,
  generateId,
} from './summarizer.js';

// Algorithms
export {
  // Clustering
  type FileCluster,
  type ClusteringResult,
  calculateFileSimilarity,
  clusterFiles,
  mapCandidatesToClusters,
  mergeClusters,
  clustersToDomainSummaries,
  performClustering,
} from './algorithms/clustering.js';

export {
  // Relationship Analysis
  type RelationshipAnalysisResult,
  calculateDomainRelationshipStrength,
  determineRelationshipType,
  createRelationship,
  analyzeAllRelationships,
  analyzeDomainBoundaries,
  detectCyclicDependencies,
} from './algorithms/relationship.js';

export {
  // Schema Proposal
  type SchemaProposalConfig,
  extractEntitiesFromPatterns,
  extractActionsFromPatterns,
  entitiesToSchemaFields,
  actionsToSchemaFields,
  inferStateFields,
  generateSchemaProposal,
  generateAllSchemaProposals,
  validateSchemaProposal,
  mergeSchemaProposals,
} from './algorithms/schema-proposal.js';

// LLM Service
export {
  type LLMServiceConfig,
  identifyDomainWithLLM,
  extractEntitiesWithLLM,
  extractActionsWithLLM,
  generateSchemaWithLLM,
  extractEntitiesHybrid,
  extractActionsHybrid,
} from './llm-service.js';
