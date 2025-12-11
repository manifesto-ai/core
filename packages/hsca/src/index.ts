/**
 * @manifesto-ai/hsca
 *
 * Hierarchical Sparse Context Architecture
 *
 * LLM 추론 시 대규모 컨텍스트를 계층적으로 압축하고
 * 필요한 부분만 동적으로 확장하여 비용과 정확도를 최적화하는 아키텍처
 */

// LLM Module
export {
  // Types
  type LLMMessageRole,
  type LLMMessage,
  type LLMCallOptions,
  type LLMUsage,
  type LLMResponse,
  type LLMErrorCode,
  type LLMError,
  type ILLMClient,
  type LLMJsonCallOptions,
  type LLMStreamChunk,
  type IStreamingLLMClient,
  // OpenAI
  OpenAIClient,
  createOpenAIClient,
  type OpenAIClientConfig,
} from './llm/index.js';

// SCT (Semantic Compression Tree) Module
export {
  // Core class
  SemanticCompressionTree,
  // Chunker functions
  chunkText,
  fixedChunker,
  semanticChunker,
  adaptiveChunker,
  // Summarizer functions
  summarizeChunk,
  summarizeGroup,
  hierarchicalSummarize,
  // Types
  type SummaryNode,
  type CompressionTree,
  type CompressionTreeMetadata,
  type SourceType,
  type Chunk,
  type ChunkResult,
  type ChunkingConfig,
  type ChunkingStrategy,
  type SummaryResult,
  type SummarizerConfig,
  type SCTBuildConfig,
  type SCTError,
  type SCTErrorCode,
  type SummarizerError,
  // Constants
  DEFAULT_CHUNKING_CONFIG,
  DEFAULT_SUMMARIZER_CONFIG,
  DEFAULT_SCT_BUILD_CONFIG,
  SummaryNodeSchema,
  CompressionTreeSchema,
} from './sct/index.js';

// Reasoning Module (Explainable Ignorance)
export {
  // Types
  type QueryIntent,
  type QueryConstraint,
  type QueryConstraintOperator,
  type ParsedQuery,
  type QueryStatus,
  type CurrentQuery,
  type RetrievedNode,
  type ReasoningStepType,
  type ReasoningStep,
  type ConclusionType,
  type Conclusion,
  // Schemas
  QueryIntentSchema,
  QueryConstraintOperatorSchema,
  QueryConstraintSchema,
  ParsedQuerySchema,
  QueryStatusSchema,
  CurrentQuerySchema,
  RetrievedNodeSchema,
  ReasoningStepTypeSchema,
  ReasoningStepSchema,
  ConclusionTypeSchema,
  ConclusionSchema,
  // State Management
  type ReasoningState,
  INITIAL_REASONING_STATE,
  createReasoningState,
  resetReasoningState,
  addReasoningStep,
  setRetrievedContext,
  addRetrievedNodes,
  setQueryStatus,
  setParsedQuery,
  setConclusion,
  getAttemptCount,
  getMaxRelevance,
  getSearchedTargets,
  // Derived Values
  type DerivedConfig,
  type DerivedValues,
  DEFAULT_DERIVED_CONFIG,
  getCurrentContextTokens,
  isWithinTokenBudget,
  getAvgRelevance,
  getMaxRelevanceFromPath,
  getDerivedAttemptCount,
  isInformationNotFound,
  isInformationNotFoundWithConfig,
  needsExpansion,
  canAnswer,
  computeDerivedValues,
  // Actions
  type ActionMeta,
  type ActionDefinition,
  type ExpandContextInput,
  type ConcludeWithAnswerInput,
  type ConcludeUncertainInput,
  type HSCAActionName,
  analyzeQuery,
  setQueryStatusAction,
  addReasoningStepAction,
  expandContext,
  concludeNotFound,
  concludeWithAnswer,
  concludeUncertain,
  HSCA_ACTIONS,
  // Explanation
  type ExplanationConfig,
  type StructuredExplanation,
  DEFAULT_EXPLANATION_CONFIG,
  buildNotFoundExplanation,
  buildConclusionExplanation,
  formatReasoningPath,
  summarizeReasoning,
  buildStructuredExplanation,
} from './reasoning/index.js';

// CQE (Context Query Engine) Module
export {
  // Types
  type RelevanceStrategy,
  type RelevanceConfig,
  type SearchOptions,
  type ProjectionOptions,
  type CQEErrorCode,
  type CQEError,
  type IContextQueryEngine,
  type IAsyncContextQueryEngine,
  // Constants
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_RELEVANCE_CONFIG,
  RelevanceStrategySchema,
  // Relevance functions
  calculateKeywordRelevance,
  calculatePathRelevance,
  calculateHybridRelevance,
  pathOverlap,
  matchPathPattern,
  calculateRelevance,
  // Embedding
  type IEmbeddingProvider,
  type OpenAIEmbeddingConfig,
  OpenAIEmbeddingProvider,
  MockEmbeddingProvider,
  ControllableMockEmbeddingProvider,
  createOpenAIEmbeddingProvider,
  createMockEmbeddingProvider,
  createControllableMockEmbeddingProvider,
  DEFAULT_OPENAI_EMBEDDING_CONFIG,
  // Semantic
  type EmbeddingCache,
  cosineSimilarity,
  euclideanSimilarity,
  createEmbeddingCache,
  getOrCreateEmbedding,
  calculateSemanticRelevance,
  calculateSemanticRelevanceBatch,
  calculateHybridRelevanceAsync,
  // Navigator
  type NodeIndex,
  buildNodeIndex,
  findNodeById,
  getAncestors,
  getDescendants,
  getSiblings,
  findByPath,
  findByExactPath,
  traverseBFS,
  traverseDFS,
  findCommonAncestor,
  getAllNodes,
  getNodesAtDepth,
  getLeafNodes,
  // Projector
  type ProjectedContext,
  toRetrievedNode,
  sortByRelevance,
  sortByDepth,
  filterByViewScope,
  projectWithinBudget,
  formatAsMarkdown,
  formatAsJSON,
  formatAsPlain,
  formatForLLM,
  getProjectionStats,
  // Engine
  ContextQueryEngine,
  AsyncContextQueryEngine,
  createContextQueryEngine,
  createAsyncContextQueryEngine,
} from './cqe/index.js';

// Loop (Reasoning Loop) Module
export {
  // Types
  type LoopConfig,
  type LoopResult,
  type LoopErrorCode,
  type LoopError,
  type IReasoningLoop,
  type LoopDependencies,
  type SelectedAction,
  // Constants
  DEFAULT_LOOP_CONFIG,
  // Selector functions
  isTerminalState,
  selectNodeToExpand,
  selectNextAction,
  diagnoseActionConditions,
  describeAction,
  // Prompts
  PARSED_QUERY_SCHEMA,
  EXPAND_DECISION_SCHEMA,
  buildAnalyzePrompt,
  buildExpandDecisionPrompt,
  buildAnswerPrompt,
  buildUncertainPrompt,
  formatReasoningPath as formatLoopReasoningPath,
  formatContextAsMarkdown,
  getSystemMessage,
  // Loop Implementation
  ReasoningLoop,
  createReasoningLoop,
} from './loop/index.js';
