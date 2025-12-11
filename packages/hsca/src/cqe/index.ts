/**
 * CQE (Context Query Engine) Module
 *
 * SCT 트리에서 관련 노드를 검색하는 핵심 엔진
 *
 * @example
 * ```typescript
 * import {
 *   createContextQueryEngine,
 *   createAsyncContextQueryEngine,
 *   createMockEmbeddingProvider,
 * } from '@manifesto-ai/hsca';
 *
 * // 동기 엔진 (keyword, path, hybrid)
 * const engine = createContextQueryEngine();
 * const result = engine.retrieve(query, tree);
 *
 * // 비동기 엔진 (semantic 포함)
 * const embeddingProvider = createMockEmbeddingProvider();
 * const asyncEngine = createAsyncContextQueryEngine(embeddingProvider);
 * const asyncResult = await asyncEngine.retrieveAsync(query, tree, queryText);
 * ```
 */

// ═══════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════
export {
  // Schemas
  RelevanceStrategySchema,
  // Types
  type RelevanceStrategy,
  type SearchOptions,
  type ProjectionOptions,
  type CQEErrorCode,
  type CQEError,
  // Interfaces
  type IContextQueryEngine,
  type IAsyncContextQueryEngine,
  // Constants
  DEFAULT_SEARCH_OPTIONS,
  DEFAULT_PROJECTION_OPTIONS,
  // Helpers
  createCQEError,
} from './types.js';

// ═══════════════════════════════════════════════════════
// Relevance
// ═══════════════════════════════════════════════════════
export {
  // Types
  type RelevanceConfig,
  // Constants
  DEFAULT_RELEVANCE_CONFIG,
  // Functions
  extractQueryKeywords,
  calculateKeywordRelevance,
  calculatePathRelevance,
  calculateHybridRelevance,
  calculateRelevance,
  pathOverlap,
  matchPathPattern,
} from './relevance.js';

// ═══════════════════════════════════════════════════════
// Embedding
// ═══════════════════════════════════════════════════════
export {
  // Interfaces
  type IEmbeddingProvider,
  // Types
  type OpenAIEmbeddingConfig,
  // Constants
  DEFAULT_OPENAI_EMBEDDING_CONFIG,
  // Classes
  OpenAIEmbeddingProvider,
  MockEmbeddingProvider,
  ControllableMockEmbeddingProvider,
  // Factory Functions
  createOpenAIEmbeddingProvider,
  createMockEmbeddingProvider,
  createControllableMockEmbeddingProvider,
} from './embedding.js';

// ═══════════════════════════════════════════════════════
// Semantic
// ═══════════════════════════════════════════════════════
export {
  // Types
  type EmbeddingCache,
  // Functions
  cosineSimilarity,
  euclideanSimilarity,
  createEmbeddingCache,
  getOrCreateEmbedding,
  calculateSemanticRelevance,
  calculateSemanticRelevanceBatch,
  calculateHybridRelevanceAsync,
  calculateHybridRelevanceBatch,
} from './semantic.js';

// ═══════════════════════════════════════════════════════
// Navigator
// ═══════════════════════════════════════════════════════
export {
  // Types
  type NodeIndex,
  // Functions
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
} from './navigator.js';

// ═══════════════════════════════════════════════════════
// Projector
// ═══════════════════════════════════════════════════════
export {
  // Types
  type ProjectedContext,
  // Functions
  toRetrievedNode,
  sortByRelevance,
  sortByDepth,
  filterByViewScope,
  projectWithinBudget,
  projectState,
  formatAsMarkdown,
  formatAsJSON,
  formatAsPlain,
  formatForLLM,
  applyProjectionOptions,
  getProjectionStats,
} from './projector.js';

// ═══════════════════════════════════════════════════════
// Engine
// ═══════════════════════════════════════════════════════
export {
  // Classes
  ContextQueryEngine,
  AsyncContextQueryEngine,
  // Factory Functions
  createContextQueryEngine,
  createAsyncContextQueryEngine,
} from './engine.js';
